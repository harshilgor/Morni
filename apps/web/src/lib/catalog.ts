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

export type ProductWithStore = Product & {
  stores: { slug: string; name: string };
  created_at?: string | null;
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

export async function getCachedHomeProducts(limit = 48) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", "home-products");

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("storefront_products")
    .select("*, stores!inner(slug, name, is_active)")
    .eq("is_available", true)
    .eq("stores.is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  const products = (data ?? []) as ProductWithStore[];
  const ratingMap = await fetchProductRatingMap(
    supabase,
    products.map((product) => product.id),
  );

  return {
    products,
    ratings: Object.fromEntries(ratingMap) as Record<string, ProductRatingSummary>,
  };
}

export async function getCachedHomeCatalog() {
  const [stores, featured, homeProducts] = await Promise.all([
    getCachedActiveStores(),
    getCachedFeaturedCategories(),
    getCachedHomeProducts(48),
  ]);

  return {
    stores,
    featured,
    products: homeProducts.products,
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

export async function getCachedPriceRailProducts(maxPrice: number) {
  "use cache";
  cacheLife("minutes");
  tagCatalog("products", `price-max:${maxPrice}`);

  const supabase = createPublicClient();
  const [{ data: productsData }, { data: categoryList }] = await Promise.all([
    supabase
      .from("storefront_products")
      .select(
        "*, stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)",
      )
      .eq("is_available", true)
      .eq("stores.is_active", true)
      .lte("price_aed", maxPrice)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("browse_categories")
      .select("name, slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  const products = productsData ?? [];
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
  const [{ data: storeData }, { data: productData }] = await Promise.all([
    supabase.from("stores").select("*").eq("slug", slug).maybeSingle(),
    supabase
      .from("storefront_products")
      .select("*, product_variants(*)")
      .eq("id", productId)
      .maybeSingle(),
  ]);

  if (!storeData || !productData || productData.store_id !== storeData.id) {
    return null;
  }

  const row = productData as Product & {
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
    .slice(0, 4);

  return {
    store: storeData as Store,
    product: row,
    variants,
    campaign: ((campaigns ?? []) as StoreCampaign[])[0] ?? null,
    relatedProducts,
    reviews: (reviewRows as ProductReview[]) ?? [],
  };
}
