import Link from "next/link";
import { ProductCard, StoreCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/server";
import { fetchProductRatingMap } from "@/lib/product-ratings";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import type { Product, Store } from "@/lib/types";

type BrowseCategoryMatch = {
  search_terms: string[] | null;
};

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

  const { data: matchingCategories } =
    queryTerms.length > 0
      ? await supabase
          .from("browse_categories")
          .select("search_terms")
          .or(ilikeAny(["name", "slug"], queryTerms))
      : { data: [] as BrowseCategoryMatch[] };

  const categoryTerms = ((matchingCategories ?? []) as BrowseCategoryMatch[])
    .flatMap((category) => category.search_terms ?? [])
    .flatMap(searchTerms);
  const productTerms = [...new Set([...queryTerms, ...categoryTerms])];

  let storesQuery = supabase.from("stores").select("*").eq("is_active", true);
  let productsQuery = supabase
    .from("storefront_products")
    .select("*, stores!inner(slug, name, is_active)")
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
      productsQuery = productsQuery.or(
        ilikeAny(["title", "description"], productTerms),
      );
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

  const [{ data: stores }, { data: products }] = await Promise.all([
    storesQuery.order("name").limit(24),
    productsQuery.limit(48),
  ]);

  const storeList = (stores ?? []) as Store[];
  let productList = (products ?? []) as (Product & {
    stores: { slug: string; name: string };
  })[];

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
      ? `Under AED ${maxPrice}`
      : minPrice != null
        ? `From AED ${minPrice}`
        : sizeFilter
          ? `Size ${sizeFilter}`
        : sort === "rated"
          ? "Best rated"
          : sort === "new"
            ? "New in"
            : instock === "1"
              ? "In stock"
              : "Search Morni";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{heading}</h1>
      <p className="mt-2 text-sm text-muted">
        Stores and products across UAE retail floors.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
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

      {!query &&
      maxPrice == null &&
      minPrice == null &&
      !sizeFilter &&
      !sort &&
      instock !== "1" ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line bg-surface/70 p-8 text-center text-muted">
          Type a store or product name in the search bar above, or use a filter chip.
        </p>
      ) : (
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
            <h2 className="mb-5 font-display text-2xl text-ink">
              Products ({productList.length})
            </h2>
            {productList.length === 0 ? (
              <p className="text-sm text-muted">No products matched.</p>
            ) : (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
                {productList.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    rating={ratingRecord[product.id] ?? null}
                    href={`/stores/${product.stores.slug}/products/${product.id}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Link href="/" className="mt-10 inline-block text-sm text-accent-deep underline">
        Back to all stores
      </Link>
    </div>
  );
}
