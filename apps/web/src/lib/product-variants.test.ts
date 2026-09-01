import { describe, expect, it } from "vitest";
import {
  aggregateFromColorDrafts,
  colorDraftFromVariant,
  createColorDraft,
  quantityForVariantSize,
  validateColorDrafts,
} from "@/lib/product-variants";

describe("colour variants", () => {
  it("aggregates exact stock by colour and size", () => {
    const drafts = [
      createColorDraft({ color_name: "Black", sizes: ["S", "M"], size_stock: { S: 2, M: 3 }, stock: "5", images: [{ id: "1", url: "black.jpg" }] }),
      createColorDraft({ color_name: "Ivory", sizes: ["M", "L"], size_stock: { M: 4, L: 1 }, stock: "5", images: [{ id: "2", url: "ivory.jpg" }] }),
    ];
    expect(aggregateFromColorDrafts(drafts, true)).toMatchObject({
      stock: 10,
      sizes: ["S", "M", "L"],
      size_stock: { S: 2, M: 7, L: 1 },
    });
  });

  it("rejects negative or fractional per-size quantities", () => {
    const draft = createColorDraft({ color_name: "Black", images: [{ id: "1", url: "black.jpg" }], sizes: ["S"], size_stock: { S: 1.5 } });
    expect(validateColorDrafts([draft])).toContain("whole-number");
  });

  it("preserves existing variant media and exact inventory when editing", () => {
    const draft = colorDraftFromVariant({ id: "v1", color_name: "Teal", color_hex: "#2f6f66", image_urls: ["image.jpg"], video_urls: ["video.mp4"], sizes: ["M"], size_stock: { M: 6 }, stock: 6 });
    expect(draft.id).toBe("v1");
    expect(draft.images[0].existing).toBe(true);
    expect(draft.videos[0].url).toBe("video.mp4");
    expect(quantityForVariantSize({ size_stock: { M: 6 }, stock: 6 }, "M")).toBe(6);
    expect(quantityForVariantSize({ size_stock: {}, stock: 6 }, "M")).toBeNull();
  });

  it("does not invent zero quantities for legacy aggregate-only stock", () => {
    const draft = colorDraftFromVariant({ id: "legacy", color_name: "Black", sizes: ["S", "M"], stock: 8, image_urls: ["image.jpg"] });
    expect(draft.inventory_mode).toBe("legacy");
    expect(aggregateFromColorDrafts([draft], true).stock).toBe(8);
  });
});
