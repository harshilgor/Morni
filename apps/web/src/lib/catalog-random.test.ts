import { describe, expect, it } from "vitest";
import { diversifyByKey, merchandiseCatalog, shuffleCatalog } from "@/lib/catalog-random";

const items = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));

describe("catalog shuffle", () => {
  it("keeps every item exactly once", () => {
    expect(shuffleCatalog(items, "today").map((item) => item.id).sort()).toEqual(items.map((item) => item.id));
  });
  it("is stable for the same seed", () => {
    expect(shuffleCatalog(items, "today")).toEqual(shuffleCatalog(items, "today"));
  });
  it("can produce a different order for a different seed", () => {
    expect(shuffleCatalog(items, "today")).not.toEqual(shuffleCatalog(items, "tomorrow"));
  });

  it("avoids adjacent items from the same group when possible", () => {
    const grouped = [
      { id: "a1", store: "a" },
      { id: "a2", store: "a" },
      { id: "a3", store: "a" },
      { id: "b1", store: "b" },
      { id: "b2", store: "b" },
      { id: "c1", store: "c" },
    ];
    const result = diversifyByKey(grouped, (item) => item.store);
    expect(result).toHaveLength(grouped.length);
    expect(new Set(result.map((item) => item.id))).toEqual(new Set(grouped.map((item) => item.id)));
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].store).not.toBe(result[index - 1].store);
    }
  });

  it("spreads available product families before repeating one", () => {
    const products = [
      { id: "gift-1", category: "gifting", store: "gifts" },
      { id: "gift-2", category: "gifting", store: "gifts" },
      { id: "kurti-1", category: "kurtis", store: "atelier" },
      { id: "kurti-2", category: "kurtis", store: "atelier-two" },
      { id: "set-1", category: "sets", store: "house" },
    ];

    const result = merchandiseCatalog(products, {
      seed: "under-55:today",
      getCategoryKey: (product) => product.category,
      getStoreKey: (product) => product.store,
    });

    expect(result).toHaveLength(products.length);
    expect(new Set(result.map((product) => product.id))).toEqual(new Set(products.map((product) => product.id)));
    expect(new Set(result.slice(0, 3).map((product) => product.category))).toEqual(
      new Set(["gifting", "kurtis", "sets"]),
    );
    for (let index = 1; index < 4; index += 1) {
      expect(result[index].category).not.toBe(result[index - 1].category);
    }
  });

  it("prefers a different store while retaining category balance", () => {
    const products = [
      { id: "a1", category: "kurtis", store: "a" },
      { id: "a2", category: "kurtis", store: "b" },
      { id: "b1", category: "sets", store: "a" },
      { id: "b2", category: "sets", store: "b" },
      { id: "c1", category: "gifting", store: "c" },
      { id: "c2", category: "gifting", store: "d" },
    ];

    const result = merchandiseCatalog(products, {
      seed: "price:55-99:today",
      getCategoryKey: (product) => product.category,
      getStoreKey: (product) => product.store,
    });

    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].store).not.toBe(result[index - 1].store);
    }
  });
});
