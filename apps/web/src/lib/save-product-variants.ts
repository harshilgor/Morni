import { createClient } from "@/lib/supabase/client";
import type { ColorDraft } from "@/lib/product-variants";
import type { ProductVariant } from "@/lib/types";

async function uploadVariantImages(
  storeId: string,
  productId: string,
  colorKey: string,
  draft: ColorDraft,
) {
  const supabase = createClient();
  const urls: string[] = [];

  for (const image of draft.images) {
    if (image.file) {
      const safeName = image.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${storeId}/${productId}/${colorKey}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, image.file, { upsert: true });
      if (error) throw new Error(error.message);
      urls.push(
        supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl,
      );
    } else if (image.existing || image.url.startsWith("http")) {
      urls.push(image.url);
    }
  }

  return urls;
}

export async function replaceProductVariants(options: {
  storeId: string;
  productId: string;
  drafts: ColorDraft[];
}) {
  const { storeId, productId, drafts } = options;
  const supabase = createClient();

  const { data: existing, error: existingError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  if (existingError) throw new Error(existingError.message);

  const keepIds = new Set(drafts.map((draft) => draft.id).filter(Boolean));
  const toDelete = ((existing as { id: string }[]) ?? [])
    .map((row) => row.id)
    .filter((id) => !keepIds.has(id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .in("id", toDelete);
    if (deleteError) throw new Error(deleteError.message);
  }

  const saved: ProductVariant[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const imageUrls = await uploadVariantImages(
      storeId,
      productId,
      draft.key,
      draft,
    );
    const payload = {
      product_id: productId,
      color_name: draft.color_name.trim(),
      color_hex: draft.color_hex || null,
      image_urls: imageUrls,
      sizes: draft.sizes,
      stock: Number(draft.stock) || 0,
      sort_order: index,
    };

    if (draft.id) {
      const { data, error } = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", draft.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      saved.push(data as ProductVariant);
    } else {
      const { data, error } = await supabase
        .from("product_variants")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      saved.push(data as ProductVariant);
    }
  }

  return saved;
}
