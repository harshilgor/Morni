import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicCatalog } from "@/lib/revalidate-catalog";
import { PRODUCT_FABRICS } from "@/lib/product-fabrics";
import { PRODUCT_OCCASION_VALUES } from "@/lib/product-occasions";
import {
  FEATURED_CATEGORY_CATALOG,
  mergeBrowseCategories,
  RETIRED_BROWSE_CATEGORY_SLUGS,
  type BrowseCategory,
} from "@/lib/browse-categories";

const MAX_PHOTOS_PER_PRODUCT = 10;
const customizationSchema = z.object({ enabled: z.boolean().default(false), instructions: z.string().trim().max(1_000).default(""), fields: z.array(z.object({ id: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(80), unit: z.string().trim().max(20), required: z.boolean() })).max(8).default([]) });
const itemSchema = z.object({ title: z.string().trim().min(3).max(120), productTag: z.union([z.string().trim().regex(/^[A-Za-z][A-Za-z0-9-]{0,39}$/), z.literal("")]).default(""), description: z.string().trim().max(2000).default(""), fabric: z.enum(PRODUCT_FABRICS).nullable().optional(), categorySlug: z.string().trim().min(1).max(80), occasion: z.enum(PRODUCT_OCCASION_VALUES), priceAed: z.number().finite().nonnegative(), stock: z.number().int().nonnegative(), sizes: z.array(z.string().trim().min(1).max(24)), sizeStock: z.record(z.string(), z.number().int().nonnegative()).default({}), customization: customizationSchema.default({ enabled: false, instructions: "", fields: [] }), images: z.array(z.string().url()).min(1).max(MAX_PHOTOS_PER_PRODUCT) });
// Validate store ownership against the authenticated membership below rather
// than assuming every deployed database formats store IDs as UUIDs.
const schema = z.object({ storeId: z.string().trim().min(1).max(200), items: z.array(itemSchema).min(1).max(100).optional(), importId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestBody = await request.json().catch(() => null);
  const parsed = schema.safeParse(requestBody);
  if (!parsed.success) {
    const rawItems = typeof requestBody === "object" && requestBody !== null && "items" in requestBody && Array.isArray(requestBody.items)
      ? requestBody.items
      : [];
    const productTitle = (index: number) => {
      const item = rawItems[index];
      return typeof item === "object" && item !== null && "title" in item && typeof item.title === "string" && item.title.trim()
        ? `“${item.title.trim()}”`
        : `Product ${index + 1}`;
    };
    const issues = parsed.error.issues.map((issue) => {
      const [scope, productIndex, field] = issue.path;
      if (scope === "items" && typeof productIndex === "number" && field === "images" && issue.code === "too_big")
        return `${productTitle(productIndex)}: a product can have a maximum of ${MAX_PHOTOS_PER_PRODUCT} photos.`;
      if (scope === "items" && typeof productIndex === "number" && field === "occasion")
        return `${productTitle(productIndex)}: choose Best occasion before publishing. If you cannot see that field, refresh this page; your saved draft will return.`;
      return `Review ${issue.path.join(" → ") || "the bulk-upload details"}: ${issue.message}`;
    });
    return NextResponse.json({ error: issues[0] ?? "Review the product fields and try again.", issues }, { status: 400 });
  }
  const { storeId } = parsed.data;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("Bulk publish server credentials are not configured", { name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Product publishing is not configured on this server yet. Add the new Supabase service-role key and try again." }, { status: 503 });
  }
  const [{ data: member }, { data: profile }] = await Promise.all([admin.from("store_members").select("store_id").eq("store_id", storeId).eq("user_id", user.id).maybeSingle(), admin.from("profiles").select("role").eq("id", user.id).maybeSingle()]);
  if (!member && profile?.role !== "admin") return NextResponse.json({ error: "You do not have access to this store." }, { status: 403 });
  let importId = parsed.data.importId;
  let items = parsed.data.items ?? [];
  if (importId) {
    const { data: existing } = await admin.from("bulk_imports").select("id,store_id,status").eq("id", importId).maybeSingle();
    if (!existing || existing.store_id !== storeId || !["needs_review", "failed", "completed_with_errors"].includes(existing.status)) return NextResponse.json({ error: "This import is not available for publishing." }, { status: 409 });
    if (!items.length) {
      const { data: pending } = await admin.from("bulk_import_items").select("title,product_tag,description,fabric,category_slug,occasion,price_aed,stock,sizes,size_stock,customization_enabled,customization_instructions,customization_fields,image_urls").eq("import_id", importId).eq("status", "failed");
      items = (pending ?? []).map((item) => ({ title: item.title, productTag: item.product_tag ?? "", description: item.description ?? "", fabric: ["gifting", "hamper", "hampers"].includes(item.category_slug) ? null : item.fabric ?? null, categorySlug: item.category_slug, occasion: item.occasion, priceAed: Number(item.price_aed), stock: item.stock, sizes: item.sizes ?? [], sizeStock: item.size_stock ?? {}, customization: { enabled: item.customization_enabled ?? false, instructions: item.customization_instructions ?? "", fields: item.customization_fields ?? [] }, images: item.image_urls ?? [] }));
    }
  }
  if (!items.length) return NextResponse.json({ error: "No products are ready to publish." }, { status: 400 });
  const missingOccasion = items.find((item) => !PRODUCT_OCCASION_VALUES.includes(item.occasion as (typeof PRODUCT_OCCASION_VALUES)[number]));
  if (missingOccasion) return NextResponse.json({ error: `Choose the best occasion for “${missingOccasion.title}” before publishing.` }, { status: 400 });
  items = items.map((item) => ({ ...item, categorySlug: item.categorySlug.trim().toLowerCase() }));
  const { data: browseCategoryRows, error: browseCategoryError } = await admin
    .from("browse_categories")
    .select("*")
    .neq("slug", "more");
  if (browseCategoryError) {
    return NextResponse.json({ error: "Could not verify product categories." }, { status: 500 });
  }
  const activeCategorySlugs = new Set(
    mergeBrowseCategories([
      ...FEATURED_CATEGORY_CATALOG,
      ...((browseCategoryRows ?? []) as BrowseCategory[]),
    ]).map((category) => category.slug),
  );
  const invalidCategory = items.find(
    (item) => RETIRED_BROWSE_CATEGORY_SLUGS.has(item.categorySlug) || !activeCategorySlugs.has(item.categorySlug),
  );
  if (invalidCategory) {
    return NextResponse.json({ error: `Choose an active category for “${invalidCategory.title}” before publishing.` }, { status: 400 });
  }
  const outOfStock = items.find((item) => {
    const sizeTotal = Object.values(item.sizeStock ?? {}).reduce((sum, quantity) => sum + quantity, 0);
    return (Object.keys(item.sizeStock ?? {}).length ? sizeTotal : item.stock) <= 0;
  });
  if (outOfStock) return NextResponse.json({ error: `Add at least 1 unit of stock before publishing “${outOfStock.title}”.` }, { status: 400 });
  const categorySlugs = [...new Set(items.map((item) => item.categorySlug.trim().toLowerCase()))];
  const { data: existingCategories, error: categoriesError } = await admin
    .from("categories")
    .select("slug")
    .eq("store_id", storeId)
    .in("slug", categorySlugs);
  if (categoriesError) return NextResponse.json({ error: "Could not verify product categories." }, { status: 500 });
  const existingSlugs = new Set((existingCategories ?? []).map((category) => category.slug));
  const missingCategories = categorySlugs
    .filter((slug) => !existingSlugs.has(slug))
    .map((slug) => ({
      store_id: storeId,
      name: slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
      slug,
      sort_order: 0,
    }));
  if (missingCategories.length) {
    const { error: categoryInsertError } = await admin
      .from("categories")
      .upsert(missingCategories, { onConflict: "store_id,slug", ignoreDuplicates: true });
    if (categoryInsertError) return NextResponse.json({ error: "Could not prepare product categories." }, { status: 500 });
  }
  if (!importId) {
    const { data: createdImport, error: importError } = await admin.from("bulk_imports").insert({ store_id: storeId, created_by: user.id, status: "publishing", total_items: items.length }).select("id").single();
    if (importError || !createdImport) return NextResponse.json({ error: "Could not start the product import." }, { status: 500 });
    importId = createdImport.id;
  } else {
    const { error: deleteError } = await admin.from("bulk_import_items").delete().eq("import_id", importId).eq("status", "failed");
    if (deleteError) return NextResponse.json({ error: `Could not prepare failed products for retry: ${deleteError.message}` }, { status: 500 });
    const { error: updateError } = await admin.from("bulk_imports").update({ status: "publishing" }).eq("id", importId);
    if (updateError) return NextResponse.json({ error: `Could not start the retry: ${updateError.message}` }, { status: 500 });
  }
      const { data: importRows, error: importItemsError } = await admin.from("bulk_import_items").insert(items.map((item) => ({ import_id: importId, title: item.title, product_tag: item.productTag?.trim().toUpperCase() || null, description: item.description || null, fabric: ["gifting", "hamper", "hampers"].includes(item.categorySlug) ? null : item.fabric || null, category_slug: item.categorySlug, occasion: item.occasion, price_aed: item.priceAed, stock: item.stock, sizes: item.sizes, size_stock: item.sizeStock, customization_enabled: item.categorySlug !== "gifting" && item.customization.enabled, customization_instructions: item.categorySlug !== "gifting" && item.customization.enabled ? item.customization.instructions || null : null, customization_fields: item.categorySlug !== "gifting" && item.customization.enabled ? item.customization.fields : [], image_urls: item.images, variant_groups: [] }))).select("id,title");
  if (importItemsError || importRows?.length !== items.length) {
    await admin.from("bulk_imports").update({ status: "failed", failed_items: items.length }).eq("id", importId);
    return NextResponse.json({ error: `Could not save the products for publishing${importItemsError ? `: ${importItemsError.message}` : "."}`, importId }, { status: 500 });
  }
  const { data: published, error: publishError } = await admin.rpc("publish_bulk_import", { p_import_id: importId });
  if (publishError) {
    await admin.from("bulk_imports").update({ status: "failed", failed_items: items.length }).eq("id", importId);
    return NextResponse.json({ error: `Could not publish this import: ${publishError.message}`, importId }, { status: 500 });
  }
  const itemById = new Map((importRows ?? []).map((row, index) => [row.id, { title: row.title, index }]));
  const results = ((published ?? []) as Array<{ item_id: string; product_id: string | null; ok: boolean; error_message: string | null }>).map((row) => ({ title: itemById.get(row.item_id)?.title ?? "Product", index: itemById.get(row.item_id)?.index, ok: row.ok, id: row.product_id ?? undefined, error: row.error_message ?? undefined }));
  const created = results.filter((result) => result.ok).length;
  if (results.length !== items.length) return NextResponse.json({ error: "Publishing returned an incomplete result. Check import history before trying again.", importId, results, created, failed: items.length - created }, { status: 500 });
  if (created > 0) await revalidatePublicCatalog();
  return NextResponse.json({ importId, results, created, failed: results.length - created });
}
