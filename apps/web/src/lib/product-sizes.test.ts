import { describe, expect, it } from "vitest";
import {
  defaultProductSizesForCategory,
  KIDS_CLOTHING_SIZES,
  productSizesForCategory,
} from "@/lib/product-sizes";

describe("product size options", () => {
  it("uses age-based sizes for Kids listings", () => {
    expect(productSizesForCategory("kids")).toEqual(KIDS_CLOTHING_SIZES);
    expect(KIDS_CLOTHING_SIZES[0]).toBe("0-3M");
    expect(KIDS_CLOTHING_SIZES.at(-1)).toBe("12-13Y");
    expect(defaultProductSizesForCategory("kids")).toEqual(["2-3Y", "4-5Y", "6-7Y"]);
  });

  it("keeps the standard apparel sizes for other categories", () => {
    expect(productSizesForCategory("kurtis")).toEqual(["Free Size", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]);
    expect(defaultProductSizesForCategory("kurtis")).toEqual(["S", "M", "L"]);
  });
});
