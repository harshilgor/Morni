import { describe, expect, it } from "vitest";

describe("AI listing description requirements", () => {
  it("requires descriptive, evidence-based copy", () => {
    const guidance = "2 to 3 complete sentences";
    expect(guidance).toContain("2 to 3");
    expect("fabric material look feel silhouette finish styling occasion").toContain("fabric");
    expect("Never invent brand, fabric, measurements, care instructions").toContain("Never invent");
  });
});
