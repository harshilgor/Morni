import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProductRatingMap, type ProductRatingSummary } from "@/lib/product-ratings";
import type { BrowseCategory } from "@/lib/browse-categories";
import {
  hasCustomBrowseCategoryRules,
  productMatchesBrowseCategory,
} from "@/lib/product-browse-category";
import type { UaeEmirate } from "@/lib/types";

// Five rows in the two-column mobile grid: enough to keep scrolling smooth without
// making the first category response wait for products the shopper cannot see yet.
export const CATEGORY_PRODUCT_BATCH_SIZE = 10;
const MAX_CATEGORY_CANDIDATES = 500;

const CATEGORY_PRODUCT_SELECT =
  "id, title, description, price_aed, compare_at_price_aed, image_urls, sizes, stock, created_at, stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)";

export type CategoryProduct = {
  id: string;
  title: string;
  description: string | null;
  price_aed: number;
  compare_at_price_aed: number | null;
  image_urls: string[] | null;
  sizes: string[] | null;
  stock: number;
  created_at: string | null;
  stores: {
    slug: string;
    name: string;
    emirate: UaeEmirate;
    area: string;
    delivery_eta_minutes: number;
  };
};

export type CategoryProductPage = {
  products: CategoryProduct[];
  ratings: Record<string, ProductRatingSummary>;
  hasMore: boolean;
};

export async function getCategoryProductPage(
  supabase: SupabaseClient,
  category: BrowseCategory,
  offset = 0,
  batchSize = CATEGORY_PRODUCT_BATCH_SIZE,
): Promise<CategoryProductPage> {
  const terms = (category.search_terms ?? [])
    .map((term) => term.replace(/[,()]/g, " ").trim())
    .filter(Boolean);
  const hasCustomRules = hasCustomBrowseCategoryRules(category.slug);

  let query = supabase
    .from("storefront_products")
    .select(CATEGORY_PRODUCT_SELECT)
    .eq("is_available", true)
    .eq("stores.is_active", true)
    .order("created_at", { ascending: false })
    // One extra result tells the client whether another batch exists without an expensive count query.
    .range(
      hasCustomRules ? 0 : offset,
      hasCustomRules ? MAX_CATEGORY_CANDIDATES : offset + batchSize,
    );

  if (terms.length > 0) {
    query = query.or(
      terms
        .flatMap((term) => [`title.ilike.%${term}%`, `description.ilike.%${term}%`])
        .join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error("Unable to load this category.");

  // PostgREST's generated relation type is an array even though the inner
  // store relationship resolves to one store per product at runtime.
  const results = (data ?? []) as unknown as CategoryProduct[];
  const matchingResults = hasCustomRules
    ? results.filter((product) => productMatchesBrowseCategory(category, product))
    : results;
  const products = hasCustomRules
    ? matchingResults.slice(offset, offset + batchSize)
    : matchingResults.slice(0, batchSize);
  const ratingMap = await fetchProductRatingMap(
    supabase,
    products.map((product) => product.id),
  );

  return {
    products,
    ratings: Object.fromEntries(ratingMap),
    hasMore: hasCustomRules
      ? matchingResults.length > offset + batchSize
      : matchingResults.length > batchSize,
  };
}
