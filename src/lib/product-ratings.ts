import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductRatingSummary = {
  avgRating: number;
  reviewCount: number;
};

export function aggregateProductRatings(
  rows: { product_id: string; rating: number }[],
): Map<string, ProductRatingSummary> {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const current = buckets.get(row.product_id) ?? { sum: 0, count: 0 };
    current.sum += row.rating;
    current.count += 1;
    buckets.set(row.product_id, current);
  }
  const result = new Map<string, ProductRatingSummary>();
  for (const [productId, { sum, count }] of buckets) {
    result.set(productId, {
      avgRating: Number((sum / count).toFixed(1)),
      reviewCount: count,
    });
  }
  return result;
}

export async function fetchProductRatingMap(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, ProductRatingSummary>> {
  if (productIds.length === 0) return new Map();
  const { data } = await supabase
    .from("product_reviews")
    .select("product_id, rating")
    .in("product_id", productIds);
  return aggregateProductRatings(
    (data as { product_id: string; rating: number }[] | null) ?? [],
  );
}

export function formatRatingLabel(avgRating: number) {
  return avgRating.toFixed(1);
}
