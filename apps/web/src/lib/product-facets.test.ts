import { describe, expect, it } from "vitest";
import { priceBucketId } from "@/lib/product-facets";

describe("price band boundaries", () => {
  it("keeps the homepage bands ordered at their boundaries", () => {
    expect(priceBucketId(55)).toBe("under-55");
    expect(priceBucketId(56)).toBe("55-99");
    expect(priceBucketId(99)).toBe("55-99");
    expect(priceBucketId(100)).toBe("99-149");
    expect(priceBucketId(149)).toBe("99-149");
    expect(priceBucketId(150)).toBe("149-199");
  });
});
