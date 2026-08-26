import { createClient } from "@/lib/supabase/client";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp";
export const MEDIA_ACCEPT_LABEL = "JPG, PNG or WebP · max 8 MB";
export const PRODUCT_IMAGE_LIMIT = 5;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type MediaBucket = "store-logos" | "product-images" | "delivery-proofs";

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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(`Could not verify your session: ${userError.message}`);
  }
  if (!user) {
    throw new Error("Sign in before uploading store images.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("store_members")
    .select("store_id")
    .eq("store_id", options.storeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Could not verify store access: ${membershipError.message}`);
  }

  let canUpload = Boolean(membership);
  if (!canUpload) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      throw new Error(`Could not verify store access: ${profileError.message}`);
    }
    canUpload = profile?.role === "admin";
  }

  if (!canUpload) {
    throw new Error("You do not have permission to upload images for this store.");
  }

  const safeName = sanitizeFileName(options.file.name);
  const folder = options.productId
    ? `${options.storeId}/${options.productId}`
    : options.storeId;
  const uploadId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${folder}/${options.prefix}-${uploadId}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(options.bucket)
    .upload(path, options.file, { upsert: false, contentType: options.file.type });

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

export async function uploadDeliveryProof(options: { deliveryJobId: string; file: File }) {
  const error = validateImageFile(options.file);
  if (error) throw new Error(error);

  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Could not verify your session: ${userError.message}`);
  if (!user) throw new Error("Sign in before uploading delivery proof.");

  const safeName = sanitizeFileName(options.file.name);
  const uploadId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${options.deliveryJobId}/${uploadId}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("delivery-proofs")
    .upload(path, options.file, { upsert: false, contentType: options.file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { error: proofError } = await supabase.from("delivery_proofs").insert({
    delivery_job_id: options.deliveryJobId,
    storage_path: path,
    content_type: options.file.type,
    captured_by: user.id,
  });
  if (proofError) {
    await supabase.storage.from("delivery-proofs").remove([path]);
    throw new Error(proofError.message);
  }
  return path;
}
