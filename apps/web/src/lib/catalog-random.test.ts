import { describe, expect, it } from "vitest";
import { shuffleCatalog } from "@/lib/catalog-random";

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
});
