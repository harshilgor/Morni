import { createClient } from "@/lib/supabase/client";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp";
export const MEDIA_ACCEPT_LABEL = "JPG, PNG or WebP · max 8 MB";
export const PRODUCT_IMAGE_LIMIT = 5;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type MediaBucket = "store-logos" | "product-images";

export type ValidatedImage = {
  file: File;
  previewUrl: string;
};

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export function validateImageFile(file: File | null | undefined): string | null {
  if (!file) return "Choose an image.";
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return "Images must be smaller than 8 MB.";
  }
  return null;
}

export async function uploadStoreMedia(options: {
  bucket: MediaBucket;
  storeId: string;
  file: File;
  prefix: string;
  productId?: string;
}) {
  const error = validateImageFile(options.file);
  if (error) throw new Error(error);

  const supabase = createClient();
  const safeName = sanitizeFileName(options.file.name);
  const folder = options.productId
    ? `${options.storeId}/${options.productId}`
    : options.storeId;
  const path = `${folder}/${options.prefix}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(options.bucket)
    .upload(path, options.file, { upsert: true, contentType: options.file.type });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return supabase.storage.from(options.bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadProductImages(options: {
  storeId: string;
  files: File[];
  productId?: string;
}) {
  const urls: string[] = [];
  for (let index = 0; index < options.files.length; index += 1) {
    const file = options.files[index];
    const url = await uploadStoreMedia({
      bucket: "product-images",
      storeId: options.storeId,
      file,
      prefix: `product-${index + 1}`,
      productId: options.productId,
    });
    urls.push(url);
  }
  return urls;
}
