import Link from "next/link";
import { StoreCard } from "@/components/cards";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { SearchAnalytics } from "@/components/analytics-hooks";
import { getCachedBrowseCategories } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { fetchProductRatingMap } from "@/lib/product-ratings";
import { searchCatalog } from "@/lib/search/catalog-search";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import type { Product, Store } from "@/lib/types";

function searchTerms(value: string) {
  const phrase = value
    .replace(/[,%().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!phrase) return [];

  return [
    ...new Set([
      phrase,
      ...phrase.split(" ").filter((word) => word.length > 1),
    ]),
  ];
}

function ilikeAny(fields: string[], terms: string[]) {
  return terms
    .flatMap((term) => fields.map((field) => `${field}.ilike.%${term}%`))
    .join(",");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    emirate?: string;
    max?: string;
    min?: string;
    size?: string;
    sort?: string;
    instock?: string;
  }>;
}) {
  const { q = "", emirate, max, min, size, sort, instock } = await searchParams;
  const query = q.trim();
  const sizeFilter = size?.trim().slice(0, 40) || null;
  const queryTerms = searchTerms(query);
  const maxPrice = max ? Number(max) : null;
  const minPrice = min ? Number(min) : null;
  const supabase = await createClient();

  let storesQuery = supabase.from("stores").select("*").eq("is_active", true);
  let productsQuery = supabase
    .from("storefront_products")
    .select("*, category:categories(name, slug), stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)")
    .eq("is_available", true)
    .eq("stores.is_active", true);

  if (query) {
    if (queryTerms.length === 0) {
      storesQuery = storesQuery.is("id", null);
      productsQuery = productsQuery.is("id", null);
    } else {
      storesQuery = storesQuery.or(
        ilikeAny(["name", "area", "description"], queryTerms),
      );
      // Product retrieval is handled by the shared hybrid search service below.
      productsQuery = productsQuery.is("id", null);
    }
  }

  if (emirate) {
    storesQuery = storesQuery.eq("emirate", emirate);
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
  const [hybridSearch, { data: stores }, { data: fallbackProducts }] = await Promise.all([
    hybridSearchPromise,
    storesQuery.order("name").limit(24),
    query ? Promise.resolve({ data: [] }) : productsQuery.limit(48),
  ]);

  const storeList = (stores ?? []) as Store[];
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

  const ratingMap = await fetchProductRatingMap(
    supabase,
    productList.map((product) => product.id),
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

  const categories = await getCachedBrowseCategories();
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
      <p className="mt-2 text-sm text-muted">
        Stores and products across UAE retail floors.
      </p>
      {query && hybridSearch?.intent ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="Search interpretation">
          <span>Understood as</span>
          {[
            hybridSearch.intent.category?.replace(/-/g, " "),
            hybridSearch.intent.color,
            hybridSearch.intent.fabric,
            hybridSearch.intent.style,
            hybridSearch.intent.occasion,
          ].filter(Boolean).map((facet) => (
            <span key={facet} className="border border-line bg-surface px-2.5 py-1 capitalize text-ink">{facet}</span>
          ))}
        </div>
      ) : null}
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
          {query ? (
            <section>
              <h2 className="mb-5 font-display text-2xl text-ink">
                Stores ({storeList.length})
              </h2>
              {storeList.length === 0 ? (
                <p className="text-sm text-muted">No stores matched.</p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {storeList.map((store) => (
                    <StoreCard key={store.id} store={store} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

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
              />
            )}
          </section>
      </div>

      <Link href="/" className="mt-10 inline-block text-sm text-accent-deep underline">
        Back to all stores
      </Link>
    </div>
  );
}
