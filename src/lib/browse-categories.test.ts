import { describe, expect, it } from "vitest";
import {
  FEATURED_CATEGORY_CATALOG,
  getBrowseCategory,
  mergeBrowseCategories,
} from "@/lib/browse-categories";
import {
  hasCustomBrowseCategoryRules,
  productMatchesBrowseCategory,
} from "@/lib/product-browse-category";

describe("active browse categories", () => {
  it("does not expose retired office or casual wear categories", () => {
    const slugs = FEATURED_CATEGORY_CATALOG.map((category) => category.slug);
    expect(slugs).not.toContain("office-wear");
    expect(slugs).not.toContain("casual-wear");

    const merged = mergeBrowseCategories([
      { id: "1", name: "Office Wear", slug: "office-wear", image_url: "", badge: null, search_terms: [], sort_order: 1, is_featured: true },
      { id: "2", name: "Kurtis", slug: "kurtis", image_url: "", badge: null, search_terms: [], sort_order: 2, is_featured: true },
    ]);
    expect(merged.map((category) => category.slug)).not.toContain("office-wear");
    expect(merged.map((category) => category.slug)).not.toContain("casual-wear");
  });

  it("returns no browse route for retired categories", () => {
    expect(getBrowseCategory("office-wear", [])).toBeNull();
    expect(getBrowseCategory("casual-wear", [])).toBeNull();
  });

  it("keeps category matching rules limited to active categories", () => {
    expect(hasCustomBrowseCategoryRules("office-wear")).toBe(false);
    expect(hasCustomBrowseCategoryRules("casual-wear")).toBe(false);
    expect(
      productMatchesBrowseCategory(
        { slug: "kurtis", search_terms: ["kurti"] },
        { title: "Everyday Kurti", description: "", category: null },
      ),
    ).toBe(true);
  });
});
