"use client";

import { useEffect, useState } from "react";
import { ProductRail, type RailProduct } from "@/components/product-rail";
import { readStoredForYouTaste } from "@/lib/for-you-storage";
import { rankTrendingForYou, type TrendingCandidate } from "@/lib/trending-for-you";

export function TrendingForYou({ products }: { products: (TrendingCandidate & { stores: { slug: string } })[] }) {
  const [result, setResult] = useState(() => rankTrendingForYou({ products }));
  useEffect(() => {
    const sync = () => {
      const taste = readStoredForYouTaste().profile;
      const preferred = Object.entries(taste.categories).filter(([, e]) => e.likes > e.passes).sort(([, a], [, b]) => (b.likes - b.passes) - (a.likes - a.passes)).map(([slug]) => slug);
      setResult(rankTrendingForYou({ products, preferredCategorySlugs: preferred, userKey: taste.likedProductIds[0] ?? "guest" }));
    };
    sync();
    window.addEventListener("morni:taste-updated", sync);
    return () => window.removeEventListener("morni:taste-updated", sync);
  }, [products]);
  if (!result.products.length) return null;
  const rail: RailProduct[] = result.products.map((p) => ({ id: p.id, title: p.title, price_aed: Number(p.price_aed), compare_at_price_aed: p.compare_at_price_aed, image_urls: p.image_urls, href: p.stores ? `/stores/${p.stores.slug}/products/${p.id}` : `/products/${p.id}` }));
  const label = result.categoryName ? `Check out the hottest ${result.categoryName}` : "Trending for you";
  return <ProductRail id="trending-for-you" title={`${label}!`} subtitle="Fresh picks selected from what is available today." products={rail} href={result.categorySlug ? `/categories/${result.categorySlug}` : "/search"} sharp unoptimized />;
}
