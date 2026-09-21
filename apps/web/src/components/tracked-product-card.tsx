"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ProductCard } from "@/components/cards";
import { trackListingClick } from "@/components/analytics-hooks";
import { track } from "@/lib/analytics/track";
import { getSearchAttribution } from "@/lib/analytics/search-attribution";
import type { ProductRatingSummary } from "@/lib/product-ratings";

type ListingProduct = {
  id: string;
  title: string;
  price_aed: number;
  compare_at_price_aed?: number | null;
  image_urls?: string[];
  store_id?: string;
};

export function TrackedProductCard({
  product,
  href,
  rating,
  surface,
  position,
  category,
  collection,
  storeSlug,
  query,
  storeId,
  sharp,
  priority,
  unoptimized,
  onWishlistChange,
  searchScore,
  searchRelevance,
  searchSources,
}: {
  product: ListingProduct;
  href: string;
  rating?: ProductRatingSummary | null;
  surface: string;
  position?: number;
  category?: string | null;
  collection?: string | null;
  storeSlug?: string | null;
  query?: string | null;
  storeId?: string | null;
  sharp?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  onWishlistChange?: (isWished: boolean) => void;
  searchScore?: number;
  searchRelevance?: "exact" | "substitute";
  searchSources?: string[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);
  const resolvedStoreId = storeId ?? product.store_id ?? null;
  const searchSourcesKey = searchSources?.join(",").slice(0, 120) ?? null;
  const context = useMemo(
    () => ({
      productId: product.id,
      storeId: resolvedStoreId,
      surface,
      position,
      category: category ?? null,
      collection: collection ?? null,
      storeSlug: storeSlug ?? null,
      query: query ?? null,
      searchScore: searchScore ?? null,
      searchRelevance: searchRelevance ?? null,
      searchSources: searchSourcesKey,
    }),
    [product.id, resolvedStoreId, surface, position, category, collection, storeSlug, query, searchScore, searchRelevance, searchSourcesKey],
  );

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined" || seen.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) return;
        if (seen.current) return;
        seen.current = true;
        track("listing_impression", {
          product_id: context.productId,
          store_id: context.storeId,
          metadata: {
            surface: context.surface,
            position: context.position ?? null,
            category: context.category,
            collection: context.collection,
            store_slug: context.storeSlug,
            query: context.query,
            search_score: context.searchScore,
            relevance_class: context.searchRelevance,
            candidate_sources: context.searchSources,
            ranker_version: context.query ? "hybrid-v1" : null,
            ...(context.query ? (getSearchAttribution() ?? {}) : {}),
          },
        });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [context]);

  return (
    <div
      ref={ref}
      onClickCapture={() => trackListingClick(context)}
      className="min-w-0"
    >
      <ProductCard
        product={product}
        href={href}
        rating={rating}
        sharp={sharp}
        priority={priority}
        unoptimized={unoptimized}
        onWishlistChange={onWishlistChange}
      />
    </div>
  );
}

/** For non-ProductCard listing links (e.g. new-and-popular tiles). */
export function TrackedProductLink({
  href,
  productId,
  storeId,
  surface,
  position,
  className,
  children,
}: {
  href: string;
  productId: string;
  storeId?: string | null;
  surface: string;
  position?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined" || seen.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) return;
        if (seen.current) return;
        seen.current = true;
        track("listing_impression", {
          product_id: productId,
          store_id: storeId ?? null,
          metadata: { surface, position: position ?? null },
        });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [productId, storeId, surface, position]);

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      onClick={() =>
        trackListingClick({
          productId,
          storeId,
          surface,
          position,
        })
      }
    >
      {children}
    </Link>
  );
}
