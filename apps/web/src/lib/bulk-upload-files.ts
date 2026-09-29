import { normalizeImageFile, validateImageFile } from "@/lib/media-upload";

export const BULK_UPLOAD_MAX_PHOTOS = 1_000;

export function prepareBulkUploadFiles(list: FileList | File[], queuedPhotoCount: number) {
  const files = Array.from(list);
  const valid = files.map(normalizeImageFile).filter((file) => !validateImageFile(file));
  const remainingPhotoSlots = Math.max(0, BULK_UPLOAD_MAX_PHOTOS - queuedPhotoCount);
  return {
    accepted: valid.slice(0, remainingPhotoSlots),
    remainingPhotoSlots,
    truncated: valid.length > remainingPhotoSlots,
  };
}
