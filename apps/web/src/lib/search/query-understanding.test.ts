import { describe, expect, it } from "vitest";
import { normalizeSearchQuery, productSatisfiesCentralIntent, semanticSearchPlan, understandSearchQuery } from "./query-understanding";

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

  it("routes confident catalogue searches to lexical search first", () => {
    const intent = understandSearchQuery("black crop tops");
    expect(semanticSearchPlan(intent, 12, 48)).toEqual({ eager: false, fallback: false });
    expect(semanticSearchPlan(intent, 0, 48)).toEqual({ eager: false, fallback: true });
  });

  it("runs ambiguous natural-language searches as hybrid search", () => {
    const intent = understandSearchQuery("something relaxed for dinner by the sea");
    expect(semanticSearchPlan(intent, 20, 48)).toEqual({ eager: true, fallback: true });
  });

  it("can disable semantic search for public suggestions", () => {
    const intent = understandSearchQuery("something relaxed for dinner by the sea");
    expect(semanticSearchPlan(intent, 0, 6, false)).toEqual({ eager: false, fallback: false });
  });
});
