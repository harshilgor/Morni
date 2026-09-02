import { describe, expect, it } from "vitest";
import { validateImageFile } from "@/lib/media-upload";

describe("media upload validation", () => {
  it("rejects empty image files before they reach storage", () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toContain("empty");
  });

  it("accepts a readable supported image", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });
});
