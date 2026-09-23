import Link from "next/link";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { SearchAnalytics } from "@/components/analytics-hooks";
import { SearchRelatedRecommendations, type SearchRecommendation } from "@/components/search-related-recommendations";
import { getCachedBrowseCategories } from "@/lib/catalog";
import { BROWSABLE_PRODUCT_CATALOG_SELECT } from "@/lib/catalog-projections";
import { createClient } from "@/lib/supabase/server";
import { fetchProductRatingMap } from "@/lib/product-ratings";
import { searchCatalog } from "@/lib/search/catalog-search";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import type { Product } from "@/lib/types";

const RELATED_CATEGORY_SLUGS: Record<string, string[]> = {
  shararas: ["salwar-kameez", "party-wear", "lehengas", "anarkalis", "pakistani-suits"],
  lehengas: ["shararas", "party-wear", "anarkalis", "sarees"],
  sarees: ["lehengas", "party-wear", "shararas", "pakistani-suits"],
  "salwar-kameez": ["shararas", "pakistani-suits", "anarkalis", "party-wear"],
  kurtis: ["short-kurtis", "chikankari", "sets", "indo-western"],
  "short-kurtis": ["kurtis", "chikankari", "tops", "sets"],
  chikankari: ["kurtis", "short-kurtis", "party-wear", "salwar-kameez"],
  "pakistani-suits": ["salwar-kameez", "shararas", "anarkalis", "party-wear"],
  "party-wear": ["lehengas", "shararas", "anarkalis", "sarees"],
  anarkalis: ["party-wear", "salwar-kameez", "lehengas", "shararas"],
  sets: ["kurtis", "short-kurtis", "indo-western", "tops"],
  "indo-western": ["sets", "party-wear", "tops", "kaftan"],
  kaftan: ["indo-western", "party-wear", "sarees", "gifting"],
};

function medianPrice(products: Array<{ price_aed: number }>) {
  const prices = products.map((product) => Number(product.price_aed)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!prices.length) return null;
  return prices[Math.floor(prices.length / 2)] ?? null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    max?: string;
    min?: string;
    size?: string;
    sort?: string;
    instock?: string;
  }>;
}) {
  const { q = "", max, min, size, sort, instock } = await searchParams;
  const query = q.trim();
  const sizeFilter = size?.trim().slice(0, 40) || null;
  const maxPrice = max ? Number(max) : null;
  const minPrice = min ? Number(min) : null;
  const supabase = await createClient();

  let productsQuery = supabase
    .from("storefront_products")
    .select("*, category:categories(name, slug), stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)")
    .eq("is_available", true)
    .eq("stores.is_active", true);

  if (query) {
    // Product retrieval is handled by the shared hybrid search service below.
    productsQuery = productsQuery.is("id", null);
  }

  if (maxPrice != null && !Number.isNaN(maxPrice)) {
    productsQuery = productsQuery.lte("price_aed", maxPrice);
  }
  if (minPrice != null && !Number.isNaN(minPrice)) {
    productsQuery = productsQuery.gte("price_aed", minPrice);
  }
  if (instock === "1") {
    productsQuery = productsQuery.gt("stock", 0);
  }
  if (sizeFilter) {
    productsQuery = productsQuery.contains("sizes", [sizeFilter]);
  }

  productsQuery = productsQuery.order("created_at", { ascending: false });

  const hybridSearchPromise = query
    ? searchCatalog(query, { limit: 100, semantic: true })
    : Promise.resolve(null);
  const [hybridSearch, { data: fallbackProducts }] = await Promise.all([
    hybridSearchPromise,
    query ? Promise.resolve({ data: [] }) : productsQuery.limit(48),
  ]);

  let productList = (hybridSearch?.products ?? fallbackProducts ?? []) as (Product & {
    stores: { slug: string; name: string };
  })[];

  if (maxPrice != null && !Number.isNaN(maxPrice)) {
    productList = productList.filter((product) => Number(product.price_aed) <= maxPrice);
  }
  if (minPrice != null && !Number.isNaN(minPrice)) {
    productList = productList.filter((product) => Number(product.price_aed) >= minPrice);
  }
  if (instock === "1") productList = productList.filter((product) => product.stock > 0);
  if (sizeFilter) productList = productList.filter((product) => product.sizes?.includes(sizeFilter));
  productList = productList.slice(0, 48);

  const categories = await getCachedBrowseCategories();
  const searchProductIds = new Set(productList.map((product) => product.id));
  const categoryCounts = new Map<string, number>();
  productList.forEach((product) => {
    const slug = product.category?.slug;
    if (slug) categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
  });
  const sourceCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? hybridSearch?.intent.category
    ?? null;
  const relatedSlugs = sourceCategory ? RELATED_CATEGORY_SLUGS[sourceCategory] ?? [] : [];
  const relatedCategoryIds = relatedSlugs.length
    ? (await supabase.from("categories").select("id").in("slug", relatedSlugs)).data?.map((category) => category.id) ?? []
    : [];
  const { data: relatedRows } = relatedCategoryIds.length && query && productList.length
    ? await supabase.from("storefront_products").select(BROWSABLE_PRODUCT_CATALOG_SELECT).in("category_id", relatedCategoryIds).eq("is_available", true).gt("stock", 0).eq("stores.is_active", true).limit(96)
    : { data: [] };
  const targetPrice = medianPrice(productList);
  const relatedProducts = ((relatedRows ?? []) as unknown as SearchRecommendation[])
    .filter((product) => !searchProductIds.has(product.id))
    .map((product) => {
      const categoryIndex = relatedSlugs.indexOf(product.category?.slug ?? "");
      const categoryScore = categoryIndex < 0 ? 0 : (relatedSlugs.length - categoryIndex) * 4;
      const priceScore = targetPrice == null ? 0 : Math.max(0, 4 - Math.abs(Number(product.price_aed) - targetPrice) / Math.max(targetPrice, 1) * 4);
      const fabricScore = hybridSearch?.intent.fabric && product.fabric?.toLowerCase() === hybridSearch.intent.fabric ? 2 : 0;
      return { ...product, recommendation_score: categoryScore + priceScore + fabricScore };
    })
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, 36);

  const ratingMap = await fetchProductRatingMap(
    supabase,
    [...productList, ...relatedProducts].map((product) => product.id),
  );
  const ratingRecord = Object.fromEntries(ratingMap) as Record<
    string,
    ProductRatingSummary
  >;

  if (sort === "rated") {
    productList = [...productList].sort((a, b) => {
      const sa = ratingRecord[a.id];
      const sb = ratingRecord[b.id];
      return (
        (sb?.avgRating ?? 0) - (sa?.avgRating ?? 0) ||
        (sb?.reviewCount ?? 0) - (sa?.reviewCount ?? 0)
      );
    });
  }

  const heading = query
    ? `Results for “${query}”`
    : maxPrice != null
      ? `Products Under AED ${maxPrice}`
      : minPrice != null
        ? `From AED ${minPrice}`
          : sizeFilter
          ? `Products in Size ${sizeFilter === "S" ? "Small" : sizeFilter === "M" ? "Medium" : sizeFilter === "L" ? "Large" : sizeFilter}`
          : sort === "rated"
          ? "Best rated"
          : sort === "new"
            ? "New in"
            : instock === "1"
              ? "In stock"
              : "All products";

  const browseProducts = productList as unknown as BrowsableProduct[];

  return (
    <div className="square-catalog mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <SearchAnalytics
        query={query}
        resultCount={productList.length}
        interpretedIntent={hybridSearch?.intent ?? null}
        candidateCounts={hybridSearch?.candidateCounts ?? null}
        latencyMs={hybridSearch?.latencyMs ?? null}
        filters={{
          max: maxPrice,
          min: minPrice,
          size: sizeFilter,
          sort: sort ?? null,
          instock: instock === "1",
        }}
      />
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
      {query && hybridSearch && hybridSearch.exactCount === 0 && hybridSearch.substituteCount > 0 ? (
        <div className="mt-5 border-l-2 border-accent bg-surface px-4 py-3 text-sm text-ink">
          No exact matches are available right now. Showing the closest product-type alternatives; requested attributes may differ.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
        {[
          { label: "All", href: "/search" },
          { label: "Under 99", href: "/search?max=99" },
          { label: "Under 199", href: "/search?max=199" },
          { label: "Luxury", href: "/search?min=500" },
          { label: "Best rated", href: "/search?sort=rated" },
          { label: "New", href: "/search?sort=new" },
          { label: "In stock", href: "/search?instock=1" },
        ].map((chip) => (
          <Link
            key={chip.label}
            href={chip.href}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-white"
          >
            {chip.label}
          </Link>
        ))}
      </div>

      <div className="mt-10 space-y-12">
          <section>
            <h2 className="mb-5 font-display text-2xl text-ink lg:hidden">
              Products ({productList.length})
            </h2>
            {browseProducts.length === 0 ? (
              <div className="border-y border-line py-10">
                <p className="font-medium text-ink">No exact products matched “{query}”.</p>
                <p className="mt-2 text-sm text-muted">Try removing a colour or style, or check the spelling. We won’t replace your search with unrelated products.</p>
              </div>
            ) : (
              <ProductBrowser
                products={browseProducts}
                categories={categories}
                ratings={ratingRecord}
                showInStockFilter
                analyticsSurface="search"
                analyticsQuery={query || null}
                sharp
                square
              />
            )}
          </section>
          {query && productList.length > 0 && relatedProducts.length > 0 ? (
            <SearchRelatedRecommendations
              query={query}
              products={relatedProducts}
              categories={categories}
              ratings={ratingRecord}
            />
          ) : null}
      </div>

      <Link href="/" className="mt-10 inline-block text-sm text-accent-deep underline">
        Back to home
      </Link>
    </div>
  );
}
