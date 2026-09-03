import { createClient } from "@/lib/supabase/client";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp";
export const MEDIA_ACCEPT_LABEL = "JPG, PNG or WebP · max 8 MB";
export const PRODUCT_IMAGE_LIMIT = 5;
export const PRODUCT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const PRODUCT_VIDEO_ACCEPT = "video/mp4,video/webm";
export const PRODUCT_VIDEO_ACCEPT_LABEL = "MP4 or WebM · max 50 MB";
export const PRODUCT_VIDEO_LIMIT = 2;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export type MediaBucket = "store-logos" | "product-images" | "product-videos" | "delivery-proofs";

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
  if (file.size <= 0) {
    return "This image is empty or could not be read. Choose the photo again.";
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return "Images must be smaller than 8 MB.";
  }
  return null;
}

export function validateVideoFile(file: File | null | undefined): string | null {
  if (!file) return "Choose a video.";
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) return "Use an MP4 or WebM video.";
  if (file.size > PRODUCT_VIDEO_MAX_BYTES) return "Videos must be smaller than 50 MB.";
  return null;
}

export async function uploadStoreMedia(options: {
  bucket: MediaBucket;
  storeId: string;
  file: File;
  prefix: string;
  productId?: string;
  mediaType?: "image" | "video";
}) {
  const error = options.mediaType === "video"
    ? validateVideoFile(options.file)
    : validateImageFile(options.file);
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
    throw new Error("Sign in before uploading store media.");
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
    throw new Error("You do not have permission to upload media for this store.");
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

  const uploadResult = await Promise.race([
    supabase.storage.from(options.bucket).upload(path, options.file, { upsert: false, contentType: options.file.type }),
    new Promise<{ error: Error }>((resolve) => window.setTimeout(() => resolve({ error: new Error("Image upload timed out. Check your connection and try again.") }), 45_000)),
  ]);
  const uploadError = uploadResult.error;

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return supabase.storage.from(options.bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadProductImages(options: {
  storeId: string;
  files: File[];
  productId?: string;
  onFileUploaded?: (file: File, completed: number, total: number) => void;
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
    options.onFileUploaded?.(file, index + 1, options.files.length);
  }
  return urls;
}

export async function uploadProductVideo(options: {
  storeId: string;
  productId: string;
  file: File;
  prefix: string;
}) {
  const error = validateVideoFile(options.file);
  if (error) throw new Error(error);
  return uploadStoreMedia({
    bucket: "product-videos",
    storeId: options.storeId,
    file: options.file,
    prefix: options.prefix,
    productId: options.productId,
    mediaType: "video",
  });
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

export async function uploadReturnProof(options: { returnJobId: string; file: File }) {
  const error = validateImageFile(options.file);
  if (error) throw new Error(error);

  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Could not verify your session: ${userError.message}`);
  if (!user) throw new Error("Sign in before uploading return proof.");

  const safeName = sanitizeFileName(options.file.name);
  const uploadId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${options.returnJobId}/${uploadId}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("return-proofs")
    .upload(path, options.file, { upsert: false, contentType: options.file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { error: proofError } = await supabase.from("return_proofs").insert({
    return_job_id: options.returnJobId,
    storage_path: path,
    content_type: options.file.type,
    captured_by: user.id,
  });
  if (proofError) {
    await supabase.storage.from("return-proofs").remove([path]);
    throw new Error(proofError.message);
  }
  return path;
}
