"use client";

import { useEffect, useState } from "react";
import { ProductRail, type RailProduct } from "@/components/product-rail";
import {
  scoreProductForTaste,
  type TasteProfile,
} from "@/lib/for-you";
import { readStoredForYouTaste } from "@/lib/for-you-storage";
import type { BrowseCategory } from "@/lib/browse-categories";
import type { BrowsableProduct } from "@/components/product-browser";
import type { ProductRatingSummary } from "@/lib/product-ratings";

export type SearchRecommendation = BrowsableProduct & {
  recommendation_score: number;
};

function rank(
  products: SearchRecommendation[],
  categories: BrowseCategory[],
  profile: TasteProfile,
) {
  return [...products].sort((left, right) => {
    const leftTaste = profile.likes > 0
      ? scoreProductForTaste(left, categories, profile, { categorySlug: left.category?.slug })
      : 0;
    const rightTaste = profile.likes > 0
      ? scoreProductForTaste(right, categories, profile, { categorySlug: right.category?.slug })
      : 0;
    return (right.recommendation_score + rightTaste) - (left.recommendation_score + leftTaste);
  });
}

export function SearchRelatedRecommendations({
  query,
  products,
  categories,
  ratings,
}: {
  query: string;
  products: SearchRecommendation[];
  categories: BrowseCategory[];
  ratings: Record<string, ProductRatingSummary>;
}) {
  const [ranked, setRanked] = useState(() => rank(products, categories, readStoredForYouTaste().profile));

  useEffect(() => {
    const sync = () => setRanked(rank(products, categories, readStoredForYouTaste().profile));
    sync();
    window.addEventListener("morni:taste-updated", sync);
    return () => window.removeEventListener("morni:taste-updated", sync);
  }, [products, categories]);

  const rail: RailProduct[] = ranked.slice(0, 12).map((product) => ({
    id: product.id,
    title: product.title,
    price_aed: Number(product.price_aed),
    compare_at_price_aed: product.compare_at_price_aed,
    image_urls: product.image_urls ?? [],
    href: `/stores/${product.stores.slug}/products/${product.id}`,
    rating: ratings[product.id] ?? null,
  }));

  return <ProductRail
    id="search-related-recommendations"
    title="You may also like"
    subtitle={`Beyond “${query}”: similar occasions and styles chosen around your search.`}
    products={rail}
    sharp
  />;
}
