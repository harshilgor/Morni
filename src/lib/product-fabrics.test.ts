import { describe, expect, it } from "vitest";
import { isProductFabric, PRODUCT_FABRICS } from "@/lib/product-fabrics";

describe("product fabrics", () => {
  it("contains the complete deduplicated seller fabric catalogue", () => {
    expect(PRODUCT_FABRICS).toHaveLength(23);
    expect(new Set(PRODUCT_FABRICS).size).toBe(PRODUCT_FABRICS.length);
    expect(PRODUCT_FABRICS).toContain("Printed Lawn");
    expect(PRODUCT_FABRICS).toContain("Kota Doriya");
  });

  it("accepts only canonical values", () => {
    expect(isProductFabric("Cotton")).toBe(true);
    expect(isProductFabric("cotton")).toBe(false);
    expect(isProductFabric("Polyester")).toBe(false);
    expect(isProductFabric(null)).toBe(false);
  });
});
