import { describe, expect, it } from "vitest";
import { isValidGeneratedTitle } from "@/lib/bulk-vision/title-validation";

describe("isValidGeneratedTitle", () => {
  const filenames = [
    "e2f7a6ae-64b0-4bdd-a627-7c092b40e0bt.jpg",
    "IMG_1234.jpg",
    "DSC_9921.jpg",
    "WhatsApp Image 2026-09-18.jpg",
    "Screenshot 2026-09-19.png",
    "abcdef0123456789abcdef01.jpg",
    "black-embroidered-anarkali.jpg",
  ];

  it.each([
    "e2f7a6ae-64b0-4bdd-a627-7c092b40e0b1.jpg",
    "e2f7a6ae-64b0-4bdd-a627-7c092b40e0bt.jpg",
    "E2f7a6ae 64b0 4bdd A627 7c092b40e0bt",
    "IMG_1234.jpg",
    "DSC_9921",
    "WhatsApp Image 2026-09-18",
    "Screenshot 2026-09-19",
    "abcdef0123456789abcdef01",
    "PHOTO_1",
    "img_001",
    "New Product",
    "Untitled",
    "Image",
    "",
    "ab",
  ])("rejects machine/placeholder title %#: %s", (title) => {
    const result = isValidGeneratedTitle(title, {
      sourceFilenames: filenames,
      internalIds: ["img_001", "img_002"],
    });
    expect(result.ok).toBe(false);
  });

  it("does not reject a real title that matches a descriptive filename", () => {
    const result = isValidGeneratedTitle("Black Embroidered Anarkali", {
      sourceFilenames: ["black-embroidered-anarkali.jpg"],
    });
    expect(result).toEqual({ ok: true, title: "Black Embroidered Anarkali" });
  });

  it("rejects a title that is only a reformatted machine filename", () => {
    const result = isValidGeneratedTitle("E2f7a6ae 64b0 4bdd A627 7c092b40e0bt", {
      sourceFilenames: ["e2f7a6ae-64b0-4bdd-a627-7c092b40e0bt.jpg"],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts real garment titles", () => {
    for (const title of [
      "Mirror Work Navratri Lehenga Set",
      "Floral Georgette Saree",
      "Embroidered Pink Sharara Set",
      "Black Embroidered Anarkali",
    ]) {
      const result = isValidGeneratedTitle(title, {
        sourceFilenames: [
          "e2f7a6ae-64b0-4bdd-a627-7c092b40e0bt.jpg",
          "IMG_7382.jpg",
        ],
        internalIds: ["img_001"],
      });
      expect(result).toEqual({ ok: true, title });
    }
  });
});
