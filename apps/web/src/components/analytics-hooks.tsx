"use client";

import { useEffect } from "react";
import { ensureSessionStart, track, trackOnce } from "@/lib/analytics/track";
import { beginSearchAttribution, markSearchProductClick, getSearchAttribution } from "@/lib/analytics/search-attribution";
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
  interpretedIntent = null,
  candidateCounts = null,
  latencyMs = null,
}: {
  query: string;
  resultCount: number;
  filters: Record<string, string | number | boolean | null>;
  interpretedIntent?: { normalizedQuery?: string; category?: string | null; color?: string | null; fabric?: string | null; style?: string | null; occasion?: string | null } | null;
  candidateCounts?: { lexical: number; semantic: number; fused: number } | null;
  latencyMs?: number | null;
}) {
  const filterKey = JSON.stringify(filters);
  const intentKey = JSON.stringify(interpretedIntent);
  const candidateKey = JSON.stringify(candidateCounts);
  useEffect(() => {
    const normalized = query.trim().slice(0, 120);
    if (!normalized) return;
    const attribution = beginSearchAttribution(normalized);
    const key = `search:${normalized}:${filterKey}`;
    if (resultCount === 0) {
      trackOnce(key, "search_zero_results", {
        metadata: {
          query: normalized,
          normalized_query: interpretedIntent?.normalizedQuery ?? normalized.toLowerCase(),
          intent_category: interpretedIntent?.category ?? null,
          intent_color: interpretedIntent?.color ?? null,
          intent_fabric: interpretedIntent?.fabric ?? null,
          intent_style: interpretedIntent?.style ?? null,
          candidate_lexical: candidateCounts?.lexical ?? null,
          candidate_semantic: candidateCounts?.semantic ?? null,
          candidate_fused: candidateCounts?.fused ?? null,
          search_latency_ms: latencyMs,
          result_count: 0,
          search_session_id: attribution?.searchSessionId ?? null,
          ...filters,
        },
      });
      return;
    }
    trackOnce(key, "search", {
      metadata: {
        query: normalized,
        normalized_query: interpretedIntent?.normalizedQuery ?? normalized.toLowerCase(),
        intent_category: interpretedIntent?.category ?? null,
        intent_color: interpretedIntent?.color ?? null,
        intent_fabric: interpretedIntent?.fabric ?? null,
        intent_style: interpretedIntent?.style ?? null,
        candidate_lexical: candidateCounts?.lexical ?? null,
        candidate_semantic: candidateCounts?.semantic ?? null,
        candidate_fused: candidateCounts?.fused ?? null,
        search_latency_ms: latencyMs,
        result_count: resultCount,
        search_session_id: attribution?.searchSessionId ?? null,
        ...filters,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, resultCount, filterKey, intentKey, candidateKey, latencyMs]);

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
  searchScore?: number | null;
  searchRelevance?: string | null;
  searchSources?: string | null;
}) {
  const metadata = {
    surface: input.surface,
    position: input.position ?? null,
    category: input.category ?? null,
    collection: input.collection ?? null,
    store_slug: input.storeSlug ?? null,
    query: input.query ?? null,
    search_score: input.searchScore ?? null,
    relevance_class: input.searchRelevance ?? null,
    candidate_sources: input.searchSources ?? null,
    ranker_version: input.query ? "hybrid-v1" : null,
  };
  if (input.query?.trim()) markSearchProductClick(input.productId);
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
        ...(getSearchAttribution(input.productId) ?? {}),
      },
    });
  }
}
