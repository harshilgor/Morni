import Link from "next/link";
import { ProductCard, StoreCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/server";
import type { Product, Store } from "@/lib/types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; emirate?: string }>;
}) {
  const { q = "", emirate } = await searchParams;
  const query = q.trim();
  const supabase = await createClient();

  let storesQuery = supabase.from("stores").select("*").eq("is_active", true);
  let productsQuery = supabase
    .from("products")
    .select("*, stores!inner(slug, name, is_active)")
    .eq("is_available", true)
    .eq("stores.is_active", true);

  if (query) {
    storesQuery = storesQuery.or(
      `name.ilike.%${query}%,area.ilike.%${query}%,description.ilike.%${query}%`,
    );
    productsQuery = productsQuery.or(
      `title.ilike.%${query}%,description.ilike.%${query}%`,
    );
  }

  if (emirate) {
    storesQuery = storesQuery.eq("emirate", emirate);
  }

  const [{ data: stores }, { data: products }] = await Promise.all([
    storesQuery.order("name").limit(24),
    productsQuery.order("created_at", { ascending: false }).limit(24),
  ]);

  const storeList = (stores ?? []) as Store[];
  const productList = (products ?? []) as (Product & {
    stores: { slug: string; name: string };
  })[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">
        {query ? `Results for “${query}”` : "Search Morni"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Stores and products across UAE retail floors.
      </p>

      {!query ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line bg-surface/70 p-8 text-center text-muted">
          Type a store or product name in the search bar above.
        </p>
      ) : (
        <div className="mt-10 space-y-12">
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
