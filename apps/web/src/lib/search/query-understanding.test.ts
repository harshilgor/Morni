import { describe, expect, it } from "vitest";
import { normalizeSearchQuery, productSatisfiesCentralIntent, understandSearchQuery } from "./query-understanding";

describe("search query understanding", () => {
  it.each(["top", "tops", "women tops"])("maps %s to the tops category", (query) => {
    expect(understandSearchQuery(query).category).toBe("tops");
  });

  it("extracts structured attributes using longest phrases", () => {
    expect(understandSearchQuery("Black cropped cotton women's top")).toMatchObject({
      category: "tops",
      color: "black",
      fabric: "cotton",
      style: "crop",
      audience: "women",
      confidence: "high",
    });
  });

  it("normalizes punctuation, accents, and whitespace", () => {
    expect(normalizeSearchQuery("  Bláck,   Crop.Top  ")).toBe("black crop top");
  });

  it("prevents a saree description from satisfying top intent", () => {
    const intent = understandSearchQuery("tops");
    expect(productSatisfiesCentralIntent(intent, {
      title: "Embroidered Green Saree",
      category: { slug: "sarees" },
    })).toBe(false);
  });

  it("allows explicit top titles even while legacy taxonomy is cleaned", () => {
    const intent = understandSearchQuery("tops");
    expect(productSatisfiesCentralIntent(intent, {
      title: "The Blush Top",
      category: { slug: "short-kurtis" },
    })).toBe(true);
  });
});
