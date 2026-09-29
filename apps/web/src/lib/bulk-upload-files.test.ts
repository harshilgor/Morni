import { describe, expect, it } from "vitest";
import { BULK_UPLOAD_MAX_PHOTOS, prepareBulkUploadFiles } from "@/lib/bulk-upload-files";

describe("bulk upload photo picker", () => {
  it("stages one phone photo with a usable MIME type for analysis and publishing", () => {
    const file = new File(["photo"], "camera.jpg", { type: "" });
    const result = prepareBulkUploadFiles([file], 0);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({ name: "camera.jpg", type: "image/jpeg" });
    expect(result.truncated).toBe(false);
  });

  it("excludes unsupported and empty files without dropping a valid photo", () => {
    const result = prepareBulkUploadFiles([
      new File(["heic"], "camera.heic", { type: "image/heic" }),
      new File([], "empty.jpg", { type: "image/jpeg" }),
      new File(["photo"], "product.png", { type: "image/png" }),
    ], 0);
    expect(result.accepted.map((file) => file.name)).toEqual(["product.png"]);
  });

  it("respects the remaining photo slots and signals a split batch", () => {
    const photos = ["one.jpg", "two.jpg"].map((name) => new File(["x"], name, { type: "image/jpeg" }));
    const result = prepareBulkUploadFiles(photos, BULK_UPLOAD_MAX_PHOTOS - 1);
    expect(result.accepted.map((file) => file.name)).toEqual(["one.jpg"]);
    expect(result.remainingPhotoSlots).toBe(1);
    expect(result.truncated).toBe(true);
  });
});
