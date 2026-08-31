import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicCatalog } from "@/lib/revalidate-catalog";
import { PRODUCT_FABRICS } from "@/lib/product-fabrics";

const itemSchema = z.object({ title: z.string().trim().min(3).max(120), productTag: z.union([z.string().trim().regex(/^[A-Za-z][A-Za-z0-9-]{0,39}$/), z.literal("")]).default(""), description: z.string().trim().max(2000).default(""), fabric: z.enum(PRODUCT_FABRICS).nullable().optional(), categorySlug: z.string().trim().min(1).max(80), priceAed: z.number().finite().nonnegative(), stock: z.number().int().nonnegative(), sizes: z.array(z.string().trim().min(1).max(24)).max(20), sizeStock: z.record(z.string(), z.number().int().nonnegative()).default({}), images: z.array(z.string().url()).min(1).max(5) });
// Validate store ownership against the authenticated membership below rather
// than assuming every deployed database formats store IDs as UUIDs.
const schema = z.object({ storeId: z.string().trim().min(1).max(200), items: z.array(itemSchema).min(1).max(100).optional(), importId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the product fields and try again." }, { status: 400 });
  const { storeId } = parsed.data;
  const admin = createAdminClient();
  const [{ data: member }, { data: profile }] = await Promise.all([admin.from("store_members").select("store_id").eq("store_id", storeId).eq("user_id", user.id).maybeSingle(), admin.from("profiles").select("role").eq("id", user.id).maybeSingle()]);
  if (!member && profile?.role !== "admin") return NextResponse.json({ error: "You do not have access to this store." }, { status: 403 });
  let importId = parsed.data.importId;
  let items = parsed.data.items ?? [];
  if (importId) {
    const { data: existing } = await admin.from("bulk_imports").select("id,store_id,status").eq("id", importId).maybeSingle();
    if (!existing || existing.store_id !== storeId || !["needs_review", "failed", "completed_with_errors"].includes(existing.status)) return NextResponse.json({ error: "This import is not available for publishing." }, { status: 409 });
    if (!items.length) {
      const { data: pending } = await admin.from("bulk_import_items").select("title,product_tag,description,fabric,category_slug,price_aed,stock,sizes,size_stock,image_urls").eq("import_id", importId).eq("status", "failed");
      items = (pending ?? []).map((item) => ({ title: item.title, productTag: item.product_tag ?? "", description: item.description ?? "", fabric: item.fabric ?? null, categorySlug: item.category_slug, priceAed: Number(item.price_aed), stock: item.stock, sizes: item.sizes ?? [], sizeStock: item.size_stock ?? {}, images: item.image_urls ?? [] }));
    }
  } else {
    const { data: createdImport, error: importError } = await admin.from("bulk_imports").insert({ store_id: storeId, created_by: user.id, status: "publishing", total_items: items.length }).select("id").single();
    if (importError || !createdImport) return NextResponse.json({ error: "Could not start the product import." }, { status: 500 });
    importId = createdImport.id;
  }
  if (!items.length) return NextResponse.json({ error: "No products are ready to publish." }, { status: 400 });
  items = items.map((item) => ({ ...item, categorySlug: item.categorySlug.trim().toLowerCase() }));
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
  await admin.from("bulk_imports").update({ status: "publishing", total_items: items.length }).eq("id", importId);
  await admin.from("bulk_import_items").delete().eq("import_id", importId).eq("status", "failed");
  const { data: importRows, error: importItemsError } = await admin.from("bulk_import_items").insert(items.map((item) => ({ import_id: importId, title: item.title, product_tag: item.productTag?.trim().toUpperCase() || null, description: item.description || null, fabric: item.fabric || null, category_slug: item.categorySlug, price_aed: item.priceAed, stock: item.stock, sizes: item.sizes, size_stock: item.sizeStock, image_urls: item.images }))).select("id,title");
  if (importItemsError) return NextResponse.json({ error: "Could not prepare import items." }, { status: 500 });
  const { data: published, error: publishError } = await admin.rpc("publish_bulk_import", { p_import_id: importId });
  if (publishError) return NextResponse.json({ error: "Could not publish this import." }, { status: 500 });
  const titleByItem = new Map((importRows ?? []).map((row) => [row.id, row.title]));
  const results = ((published ?? []) as Array<{ item_id: string; product_id: string | null; ok: boolean; error_message: string | null }>).map((row) => ({ title: titleByItem.get(row.item_id) ?? "Product", ok: row.ok, id: row.product_id ?? undefined, error: row.error_message ?? undefined }));
  const created = results.filter((result) => result.ok).length;
  if (created > 0) await revalidatePublicCatalog();
  return NextResponse.json({ importId, results, created, failed: results.length - created });
}
