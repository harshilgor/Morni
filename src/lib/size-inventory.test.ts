import { describe, expect, it } from "vitest";
import { normalizeSizeStock, totalSizeStock } from "@/lib/size-inventory";
import { cartLineId } from "@/lib/cart";

describe("size inventory", () => {
  it("totals only non-negative numeric quantities", () => {
    expect(totalSizeStock({ S: 1, M: 3, L: 0, XL: -2 })).toBe(4);
  });

  it("normalizes selected sizes and fills missing quantities with zero", () => {
    expect(normalizeSizeStock(["S", "M", "L"], { S: 2, M: 1 })).toEqual({ S: 2, M: 1, L: 0 });
  });

  it("keeps different sizes in separate cart lines", () => {
    expect(cartLineId("product-1", "S")).not.toBe(cartLineId("product-1", "M"));
  });
});
