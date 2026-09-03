import { describe, expect, it } from "vitest";
import { rankTrendingForYou, type TrendingCandidate } from "@/lib/trending-for-you";

const product = (id: string, slug: string, available = true): TrendingCandidate => ({ id, title: id, description: null, price_aed: 50, compare_at_price_aed: null, image_urls: ["/x.jpg"], stock: 2, is_available: available, category: { slug, name: slug } });

describe("trending for you ranking", () => {
  it("prioritizes a completed For You preference", () => {
    const products = [...Array.from({ length: 7 }, (_, i) => product(`k${i}`, "kurti")), ...Array.from({ length: 7 }, (_, i) => product(`s${i}`, "saree"))];
    const result = rankTrendingForYou({ products, preferredCategorySlugs: ["saree"] });
    expect(result.categorySlug).toBe("saree");
  });
  it("is deterministic for a user on the same day", () => {
    const input = { products: [product("a", "kurti"), product("b", "saree")], userKey: "u1", date: new Date("2026-01-02T12:00:00Z") };
    expect(rankTrendingForYou(input)).toEqual(rankTrendingForYou(input));
  });
  it("never recommends unavailable or empty-stock products", () => {
    const result = rankTrendingForYou({ products: [product("a", "kurti", false), { ...product("b", "kurti"), stock: 0 }] });
    expect(result.products).toEqual([]);
  });
  it("requires seven eligible products in a category", () => {
    const products = Array.from({ length: 6 }, (_, i) => product(String(i), "kurti"));
    expect(rankTrendingForYou({ products }).products).toEqual([]);
  });
});
