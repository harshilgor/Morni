"use client";

import { useEffect } from "react";
import { ensureSessionStart, track, trackOnce } from "@/lib/analytics/track";
import type { MarketplaceEventName } from "@/lib/analytics/events";

/** Fire a page/surface view once per tab session for the given key. */
export function AnalyticsPageView({
  event,
  onceKey,
  metadata,
  storeId,
}: {
  event: MarketplaceEventName;
  onceKey: string;
  metadata?: Record<string, string | number | boolean | null>;
  storeId?: string | null;
}) {
  const metaKey = JSON.stringify(metadata ?? {});
  useEffect(() => {
    ensureSessionStart();
    trackOnce(onceKey, event, {
      store_id: storeId ?? null,
      metadata: metadata ?? {},
    });
    // intentionally keyed by onceKey + serialized metadata
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, onceKey, storeId, metaKey]);

  return null;
}

export function SearchAnalytics({
  query,
  resultCount,
  filters,
}: {
  query: string;
  resultCount: number;
  filters: Record<string, string | number | boolean | null>;
}) {
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    const normalized = query.trim().slice(0, 120);
    if (!normalized) return;
    const key = `search:${normalized}:${filterKey}`;
    if (resultCount === 0) {
      trackOnce(key, "search_zero_results", {
        metadata: { query: normalized, result_count: 0, ...filters },
      });
      return;
    }
    trackOnce(key, "search", {
      metadata: { query: normalized, result_count: resultCount, ...filters },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, resultCount, filterKey]);

  return null;
}

export function trackListingClick(input: {
  productId: string;
  storeId?: string | null;
  surface: string;
  position?: number;
  category?: string | null;
  collection?: string | null;
  storeSlug?: string | null;
  query?: string | null;
}) {
  const metadata = {
    surface: input.surface,
    position: input.position ?? null,
    category: input.category ?? null,
    collection: input.collection ?? null,
    store_slug: input.storeSlug ?? null,
    query: input.query ?? null,
  };
  track("listing_click", {
    product_id: input.productId,
    store_id: input.storeId ?? null,
    metadata,
  });
  const query = input.query?.trim();
  if (query) {
    track("search_result_click", {
      product_id: input.productId,
      store_id: input.storeId ?? null,
      metadata: {
        query: query.slice(0, 120),
        position: input.position ?? null,
        surface: input.surface,
      },
    });
  }
}
