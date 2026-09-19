import { describe, expect, it } from "vitest";
import { isJewelryOrAccessoryProduct, productMatchesBrowseCategory } from "@/lib/product-browse-category";

describe("Jewelry / Accessories browse guard", () => {
  const category = { slug: "jewelry-accessories", search_terms: ["jewelry"] };

  it.each(["Kurti", "Saree", "Anarkali Set", "Embroidered Top", "Blazer"])(
    "rejects clothing even when tagged as accessories (%s)",
    (title) => {
      expect(productMatchesBrowseCategory(category, { title, category: { slug: "accessories" } })).toBe(false);
    },
  );

  it("rejects missing or non-accessory taxonomy", () => {
    expect(isJewelryOrAccessoryProduct({ title: "Gold necklace", category: null })).toBe(false);
    expect(isJewelryOrAccessoryProduct({ title: "Gold necklace", category: { slug: "kurtis" } })).toBe(false);
  });

  it("allows valid jewelry and accessories", () => {
    expect(isJewelryOrAccessoryProduct({ title: "Pearl drop earrings", category: { slug: "jewelry" } })).toBe(true);
    expect(isJewelryOrAccessoryProduct({ title: "Beaded clutch", description: "Handmade evening accessory", category: { slug: "accessories" } })).toBe(true);
  });
});
