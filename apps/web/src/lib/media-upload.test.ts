import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeImageFile,
  uploadProductImages,
  validateImageFile,
} from "@/lib/media-upload";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));

beforeEach(() => mocks.createClient.mockReset());

describe("media upload validation", () => {
  it("rejects empty image files before they reach storage", () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toContain("empty");
  });

  it("accepts a readable supported image", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });

  it.each(["", "image/jpg"])(
    "normalizes a phone JPEG with MIME type %j before analysis and storage",
    (type) => {
      const original = new File([new Uint8Array([1, 2, 3])], "camera.JPG", { type });
      const normalized = normalizeImageFile(original);
      expect(normalized.type).toBe("image/jpeg");
      expect(normalized.name).toBe(original.name);
      expect(normalized.size).toBe(original.size);
      expect(validateImageFile(normalized)).toBeNull();
    },
  );

  it("does not trust a supported extension when the browser reports another format", () => {
    const file = new File(["heic"], "camera.jpg", { type: "image/heic" });
    expect(validateImageFile(normalizeImageFile(file))).toContain("JPG, PNG, or WebP");
  });

  it("rejects unsupported, empty, and oversized photos", () => {
    expect(validateImageFile(normalizeImageFile(new File(["x"], "camera.heic")))).toContain("JPG, PNG, or WebP");
    expect(validateImageFile(normalizeImageFile(new File([], "empty.jpg")))).toContain("empty");
    expect(validateImageFile(normalizeImageFile(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.jpg")))).toContain("8 MB");
  });
});

describe("single-photo product upload", () => {
  function client(uploadError: Error | null = null) {
    const upload = vi.fn().mockResolvedValue({ error: uploadError });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/photo.jpg" } });
    const storageFrom = vi.fn().mockReturnValue({ upload, getPublicUrl });
    const membership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { store_id: "store-1" }, error: null }),
    };
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "seller-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(membership),
      storage: { from: storageFrom },
    });
    return { upload, getPublicUrl, storageFrom };
  }

  it("stores one mobile photo with a canonical content type and reports completion", async () => {
    const storage = client();
    const onFileUploaded = vi.fn();
    const file = new File(["photo bytes"], "camera.jpg", { type: "image/jpg" });
    const urls = await uploadProductImages({ storeId: "store-1", files: [file], onFileUploaded });

    expect(urls).toEqual(["https://example.com/photo.jpg"]);
    expect(storage.storageFrom).toHaveBeenCalledWith("product-images");
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(storage.upload.mock.calls[0]?.[1]).toMatchObject({ type: "image/jpeg", name: "camera.jpg" });
    expect(storage.upload.mock.calls[0]?.[2]).toEqual({ upsert: false, contentType: "image/jpeg" });
    expect(onFileUploaded).toHaveBeenCalledWith(file, 1, 1);
  });

  it("stops on storage failure without reporting the photo as uploaded", async () => {
    client(new Error("Storage unavailable"));
    const onFileUploaded = vi.fn();
    await expect(uploadProductImages({
      storeId: "store-1",
      files: [new File(["photo"], "camera.jpg", { type: "image/jpeg" })],
      onFileUploaded,
    })).rejects.toThrow("Storage unavailable");
    expect(onFileUploaded).not.toHaveBeenCalled();
  });
});
