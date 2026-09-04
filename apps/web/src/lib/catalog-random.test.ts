import { describe, expect, it } from "vitest";
import { diversifyByKey, shuffleCatalog } from "@/lib/catalog-random";

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
});
