import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  CATEGORY_PRODUCT_BATCH_SIZE,
  getCategoryProductPage,
  type CategoryProductPage,
} from "@/lib/category-product-page";
import {
  getBrowseCategory,
  mergeBrowseCategories,
  mergeFeaturedCategories,
  type BrowseCategory,
} from "@/lib/browse-categories";
import { fetchProductRatingMap, type ProductRatingSummary } from "@/lib/product-ratings";
import { createPublicClient } from "@/lib/supabase/public";
import type { Product, ProductReview, ProductVariant, RelatedProduct, Store, StoreCampaign } from "@/lib/types";
import { categoryForProduct } from "@/lib/for-you";
import { catalogShuffleSeed, merchandiseCatalog } from "@/lib/catalog-random";

export type ProductWithStore = Product & {
  stores: { slug: string; name: string };
  created_at?: string | null;
};

export type StoreRecommendationStats = {
  productCount: number;
  availableProductCount: number;
  categoryCounts: Record<string, number>;
};

export type { RelatedProduct, StoreCampaign };

export type CachedProductPage = {
  store: Store;
  product: Product;
  variants: ProductVariant[];
  campaign: StoreCampaign | null;
  relatedProducts: RelatedProduct[];
  reviews: ProductReview[];
};

type MerchandisingProduct = {
  id: string;
  category?: { slug?: string | null } | null;
  stores?: { slug?: string | null; name?: string | null } | null;
};

// A rail must be selected from a meaningful candidate set before we apply the
// category/store balancing rules. Keeping this bounded protects the public
// catalog query while still covering the current storefront inventory.
const HOME_RAIL_CANDIDATE_LIMIT = 500;

function merchandiseProducts<T extends MerchandisingProduct>(products: T[], railId: string): T[] {
  return merchandiseCatalog(products, {
    seed: catalogShuffleSeed(railId),
    getCategoryKey: (product) => product.category?.slug ?? "uncategorized",
    getStoreKey: (product) => product.stores?.slug ?? product.stores?.name ?? "",
  });
}

function tagCatalog(...extra: string[]) {
  cacheTag("catalog", ...extra);
}

export async function getCachedActiveStores() {
  "use cache";
  cacheLife("minutes");
  tagCatalog("stores");

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (data ?? []) as Store[];
}

/**
 * Small, cacheable store signals used for fast personalization on the client.
 * This is deliberately precomputed with the public catalog cache; the request
 * path never scans products or runs recommendation math.
 */
export async function getCachedStoreRecommendationStats(
  categories: BrowseCategory[],
) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("stores", "store-recommendation-stats", "products");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("storefront_products")
    .select("store_id, title, description, is_available, stock, stores!inner(is_active)")
    .eq("stores.is_active", true)
    .limit(5000);

  if (error) {
    console.error("Store recommendation signals query failed", error.message);
    return {} as Record<string, StoreRecommendationStats>;
  }

  const stats: Record<string, StoreRecommendationStats> = {};
  for (const row of data ?? []) {
    const storeId = String(row.store_id);
    const current =
      stats[storeId] ??
      ({ productCount: 0, availableProductCount: 0, categoryCounts: {} } satisfies StoreRecommendationStats);
    current.productCount += 1;
    if (row.is_available && Number(row.stock ?? 0) > 0) current.availableProductCount += 1;

    const category = categoryForProduct(
      { title: String(row.title ?? ""), description: row.description },
      categories,
    );
    if (category) current.categoryCounts[category.slug] = (current.categoryCounts[category.slug] ?? 0) + 1;
    stats[storeId] = current;
  }

  return stats;
}

export async function getCachedFeaturedCategories() {
  "use cache";
  cacheLife("hours");
  tagCatalog("categories", "featured-categories");

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("browse_categories")
    .select("*")
    .eq("is_featured", true)
    .order("sort_order");

  return mergeFeaturedCategories((data ?? []) as BrowseCategory[]);
}

export async function getCachedBrowseCategories() {
  "use cache";
  cacheLife("hours");
  tagCatalog("categories");

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("browse_categories")
    .select("*")
    .neq("slug", "more")
    .order("sort_order");

  return mergeBrowseCategories((data ?? []) as BrowseCategory[]);
}

async function fetchHomeProductBand(options: {
  limit: number;
  maxPrice?: number;
  minPrice?: number;
  minPriceExclusive?: number;
  tag: string;
}) {
  const supabase = createPublicClient();
  let query = supabase
    .from("storefront_products")
    .select("*, category:categories(name, slug), stores!inner(slug, name, is_active)")
    .eq("is_available", true)
    .eq("stores.is_active", true)
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (options.maxPrice != null) {
    query = query.lte("price_aed", options.maxPrice);
  }
  if (options.minPrice != null) {
    query = query.gte("price_aed", options.minPrice);
  }
  if (options.minPriceExclusive != null) {
    query = query.gt("price_aed", options.minPriceExclusive);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Home catalog query failed (${options.tag})`, error.message);
    // Throw so "use cache" does not persist a false empty catalog.
    throw new Error(`Home catalog query failed (${options.tag}): ${error.message}`);
  }

  return (data ?? []) as ProductWithStore[];
}

export async function getCachedHomeProducts(limit = 48) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", "home-products");

  const supabase = createPublicClient();
  const products = await fetchHomeProductBand({ limit, tag: "home-products" });
  const ratingMap = await fetchProductRatingMap(
    supabase,
    products.map((product) => product.id),
  );

  return {
    products,
    ratings: Object.fromEntries(ratingMap) as Record<string, ProductRatingSummary>,
  };
}

export async function getCachedHomePriceBand(options: {
  maxPrice?: number;
  minPrice?: number;
  minPriceExclusive?: number;
  limit?: number;
  tag: string;
}) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", "home-products", options.tag);

  return fetchHomeProductBand({
    limit: options.limit ?? 12,
    maxPrice: options.maxPrice,
    minPrice: options.minPrice,
    minPriceExclusive: options.minPriceExclusive,
    tag: options.tag,
  });
}

export async function getCachedHomeCatalog() {
  const [stores, featured, homeProducts, megaSale, under99, under149, luxuryPicks] =
    await Promise.all([
      getCachedActiveStores(),
      getCachedFeaturedCategories(),
      // Keep a broad candidate pool so the daily New & Popular shuffle can
      // surface older products instead of only the latest uploads.
      getCachedHomeProducts(200),
      getCachedHomePriceBand({ maxPrice: 55, limit: HOME_RAIL_CANDIDATE_LIMIT, tag: "home-price-max:55" }),
      getCachedHomePriceBand({ minPriceExclusive: 55, maxPrice: 99, limit: HOME_RAIL_CANDIDATE_LIMIT, tag: "home-price:55-99" }),
      getCachedHomePriceBand({ minPriceExclusive: 99, maxPrice: 149, limit: HOME_RAIL_CANDIDATE_LIMIT, tag: "home-price:99-149" }),
      getCachedHomePriceBand({ minPriceExclusive: 300, limit: HOME_RAIL_CANDIDATE_LIMIT, tag: "home-luxury" }),
    ]);

  const storeRecommendationStats = await getCachedStoreRecommendationStats(featured);

  return {
    stores,
    storeRecommendationStats,
    featured,
    products: homeProducts.products,
    megaSale: merchandiseProducts(megaSale, "home-price:0-55"),
    under99: merchandiseProducts(under99, "home-price:55-99"),
    under149: merchandiseProducts(under149, "home-price:99-149"),
    luxuryPicks: merchandiseProducts(luxuryPicks, "home-luxury"),
    ratings: homeProducts.ratings,
  };
}

export async function getCachedStoreBySlug(slug: string) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("stores", `store:${slug}`);

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return (data as Store | null) ?? null;
}

export async function getCachedPublicPickupLocation(storeId: string) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("stores", `store-pickup:${storeId}`);

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("store_pickup_locations")
    .select("area, address, emirate")
    .eq("store_id", storeId)
    .eq("is_public", true)
    .maybeSingle();

  return (data as { area: string; address: string; emirate: Store["emirate"] } | null) ?? null;
}

export async function getCachedStoreCatalog(storeId: string, slug: string) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("stores", `store:${slug}`, `store-products:${storeId}`);

  const supabase = createPublicClient();
  const [{ data: products }, { data: browseCategories }, { data: campaigns }] =
    await Promise.all([
      supabase
        .from("storefront_products")
        .select("*, categories(name, slug)")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("browse_categories")
        .select("name, slug, search_terms")
        .neq("slug", "more")
        .order("sort_order"),
      supabase.rpc("active_store_campaign", { p_store_id: storeId }),
    ]);

  const list = (products ?? []) as Array<
    Product & {
      created_at?: string | null;
      categories: { name: string; slug: string } | null;
    }
  >;
  const ratingMap = await fetchProductRatingMap(
    supabase,
    list.map((product) => product.id),
  );

  return {
    products: list,
    browseCategories: (browseCategories ?? []) as {
      name: string;
      slug: string;
      search_terms: string[] | null;
    }[],
    campaign: ((campaigns ?? []) as StoreCampaign[])[0] ?? null,
    ratings: Object.fromEntries(ratingMap) as Record<string, ProductRatingSummary>,
  };
}

export async function getCachedCategoryPage(slug: string): Promise<{
  category: BrowseCategory;
  productPage: CategoryProductPage;
  categories: { name: string; slug: string }[];
} | null> {
  "use cache";
  cacheLife("minutes");
  tagCatalog("categories", `category:${slug}`);

  const supabase = createPublicClient();
  const [{ data: categoryData }, { data: categoryList }] = await Promise.all([
    supabase.from("browse_categories").select("*").eq("slug", slug).maybeSingle(),
    supabase
      .from("browse_categories")
      .select("name, slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  const category = getBrowseCategory(
    slug,
    categoryData ? [categoryData as BrowseCategory] : [],
  );
  if (!category || category.slug === "more") return null;

  const productPage = await getCategoryProductPage(
    supabase,
    category,
    0,
    CATEGORY_PRODUCT_BATCH_SIZE,
  );

  return {
    category,
    productPage,
    categories: mergeBrowseCategories(
      (categoryList ?? []) as BrowseCategory[],
    ).map(({ name, slug: categorySlug }) => ({ name, slug: categorySlug })),
  };
}

export async function getCachedPriceRailProducts(options: {
  maxPrice: number;
  minPriceExclusive?: number;
  tag?: string;
}) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", options.tag ?? `price:${options.minPriceExclusive ?? 0}-${options.maxPrice}`);

  const supabase = createPublicClient();
  let productsQuery = supabase
    .from("storefront_products")
    .select(
      "*, category:categories(name, slug), stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)",
    )
    .eq("is_available", true)
    .eq("stores.is_active", true)
    .lte("price_aed", options.maxPrice);
  if (options.minPriceExclusive != null) {
    productsQuery = productsQuery.gt("price_aed", options.minPriceExclusive);
  }
  productsQuery = productsQuery.order("created_at", { ascending: false }).limit(200);

  const [{ data: productsData }, { data: categoryList }] = await Promise.all([
    productsQuery,
    supabase
      .from("browse_categories")
      .select("name, slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  const products = merchandiseProducts(
    (productsData ?? []) as MerchandisingProduct[],
    options.tag ?? `price:${options.minPriceExclusive ?? 0}-${options.maxPrice}`,
  );
  const ratingMap = await fetchProductRatingMap(
    supabase,
    products.map((product: { id: string }) => product.id),
  );

  return {
    products,
    categories: (categoryList ?? []) as { name: string; slug: string }[],
    ratings: Object.fromEntries(ratingMap) as Record<string, ProductRatingSummary>,
  };
}

export async function getCachedClearanceProducts() {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", "clearance");

  const supabase = createPublicClient();
  const [{ data: productsData }, { data: categoryList }] = await Promise.all([
    supabase
      .from("storefront_products")
      .select(
        "*, stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)",
      )
      .eq("is_available", true)
      .eq("stores.is_active", true)
      .not("compare_at_price_aed", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("browse_categories")
      .select("name, slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  const products = (productsData ?? []).filter(
    (product: { compare_at_price_aed: number | null; price_aed: number }) =>
      product.compare_at_price_aed != null &&
      Number(product.compare_at_price_aed) > Number(product.price_aed),
  );
  const ratingMap = await fetchProductRatingMap(
    supabase,
    products.map((product: { id: string }) => product.id),
  );

  return {
    products,
    categories: (categoryList ?? []) as { name: string; slug: string }[],
    ratings: Object.fromEntries(ratingMap) as Record<string, ProductRatingSummary>,
  };
}

export async function getCachedProductPage(
  slug: string,
  productId: string,
): Promise<CachedProductPage | null> {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", `product:${productId}`, `store:${slug}`);

  const supabase = createPublicClient();
  const [{ data: storeData }, { data: productData }, { data: customizationData }] = await Promise.all([
    supabase.from("stores").select("*").eq("slug", slug).eq("is_active", true).maybeSingle(),
    supabase
      .from("storefront_products")
      .select("*, product_variants(*)")
      .eq("id", productId)
      .eq("is_available", true)
      .maybeSingle(),
    supabase
      .from("products")
      .select("customization_enabled, customization_instructions, customization_fields")
      .eq("id", productId)
      .maybeSingle(),
  ]);

  if (!storeData || !productData || productData.store_id !== storeData.id) {
    return null;
  }

  const row = {
    ...(productData as Product),
    ...((customizationData ?? {}) as Pick<
      Product,
      "customization_enabled" | "customization_instructions" | "customization_fields"
    >),
  } as Product & {
    product_variants?: ProductVariant[] | null;
  };
  const variants = [...(row.product_variants ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const [{ data: campaigns }, { data: relatedData }, { data: reviewRows }] =
    await Promise.all([
      supabase.rpc("active_store_campaign", { p_store_id: row.store_id }),
      supabase
        .from("storefront_products")
        .select("*, stores!inner(slug, name, is_active)")
        .eq("is_available", true)
        .eq("stores.is_active", true)
        .neq("id", row.id)
        .limit(24),
      supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", row.id)
        .order("created_at", { ascending: false }),
    ]);

  const related = (relatedData as RelatedProduct[] | null) ?? [];
  const relatedProducts = [...related]
    .sort(
      (a, b) =>
        Number(b.category_id === row.category_id) -
          Number(a.category_id === row.category_id) ||
        Number(b.store_id === row.store_id) - Number(a.store_id === row.store_id),
    )
    // Keep a generous recommendation set so the detail page feels like a
    // discovery destination rather than a four-item dead end.
    .slice(0, 12);

  return {
    store: storeData as Store,
    product: row,
    variants,
    campaign: ((campaigns ?? []) as StoreCampaign[])[0] ?? null,
    relatedProducts,
    reviews: (reviewRows as ProductReview[]) ?? [],
  };
}
