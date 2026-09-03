import { describe, expect, it } from "vitest";
import { SHOPPER_EMIRATES } from "@/lib/format";
import { getBrowseCategory, mergeBrowseCategories } from "@/lib/browse-categories";

describe("shopper browse visibility", () => {
  it("only exposes Dubai as a shopper location", () => {
    expect(SHOPPER_EMIRATES.map((item) => item.value)).toEqual(["dubai"]);
  });

  it("does not expose retired Elegant Fashion", () => {
    expect(getBrowseCategory("elegant-fashion", [])).toBeNull();
    expect(mergeBrowseCategories([
      { id: "legacy", name: "Elegant Fashion", slug: "elegant-fashion", image_url: "", badge: null, search_terms: [], sort_order: 1, is_featured: true },
    ]).some((item) => item.slug === "elegant-fashion")).toBe(false);
  });
});
