import { Suspense } from "react";
import Link from "next/link";
import { StoreCard } from "@/components/cards";
import { FeaturedCategories } from "@/components/featured-categories";
import { HeroCarousel } from "@/components/hero-carousel";
import { HomeCollections } from "@/components/home-collections";
import { HomeDiscovery } from "@/components/home-discovery";
import { LocationHomeSync } from "@/components/location-home-sync";
import { ProductRail } from "@/components/product-rail";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";
import type { Product, Store } from "@/lib/types";
import { EMIRATES, emirateLabel } from "@/lib/format";
import { getProductSocialProof } from "@/lib/product-social";
import type { UaeEmirate } from "@/lib/types";

type ProductWithStore = Product & {
  stores: { slug: string; name: string };
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ emirate?: string }>;
}) {
  const { emirate } = await searchParams;
  const supabase = await createClient();

  let storesQuery = supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (emirate) {
    storesQuery = storesQuery.eq("emirate", emirate);
  }

  const [{ data: stores }, { data: categories }, { data: products }] =
    await Promise.all([
      storesQuery,
      supabase
        .from("browse_categories")
        .select("*")
        .eq("is_featured", true)
        .order("sort_order"),
      supabase
        .from("products")
        .select("*, stores!inner(slug, name, is_active)")
        .eq("is_available", true)
        .eq("stores.is_active", true)
        .order("created_at", { ascending: false })
        .limit(48),
    ]);

  const list = (stores ?? []) as Store[];
  const featured = (categories ?? []) as BrowseCategory[];
  const activeEmirate = emirate as UaeEmirate | undefined;
  const productList = (products ?? []) as ProductWithStore[];

  const under99 = productList
    .filter((p) => Number(p.price_aed) <= 99)
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      price_aed: Number(p.price_aed),
      compare_at_price_aed: p.compare_at_price_aed,
      image_urls: p.image_urls,
      href: `/stores/${p.stores.slug}/products/${p.id}`,
    }));

  const topRated = [...productList]
    .map((p) => ({
      product: p,
      social: getProductSocialProof(`${p.id}-${p.title}`),
    }))
    .sort((a, b) => b.social.rating - a.social.rating || b.social.reviews - a.social.reviews)
    .slice(0, 10)
    .map(({ product: p }) => ({
      id: p.id,
      title: p.title,
      price_aed: Number(p.price_aed),
      compare_at_price_aed: p.compare_at_price_aed,
      image_urls: p.image_urls,
      href: `/stores/${p.stores.slug}/products/${p.id}`,
    }));

  const newIn = productList.slice(0, 10).map((p) => ({
    id: p.id,
    title: p.title,
    price_aed: Number(p.price_aed),
    compare_at_price_aed: p.compare_at_price_aed,
    image_urls: p.image_urls,
    href: `/stores/${p.stores.slug}/products/${p.id}`,
  }));

  return (
    <div>
      <HeroCarousel />

      <Suspense fallback={null}>
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <LocationHomeSync />
        </div>
      </Suspense>

      <section id="stores" className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink">
              {activeEmirate
                ? `Stores in ${emirateLabel(activeEmirate)}`
                : "Stores near you"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Same-hour delivery from local retail floors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className={`rounded-full px-3 py-1.5 text-xs ${!emirate ? "bg-ink text-white" : "bg-surface text-muted border border-line"}`}
            >
              All
            </Link>
            {EMIRATES.map((e) => (
              <Link
                key={e.value}
                href={`/?emirate=${e.value}`}
                className={`rounded-full px-3 py-1.5 text-xs ${emirate === e.value ? "bg-ink text-white" : "bg-surface text-muted border border-line"}`}
              >
                {e.label}
              </Link>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center text-muted">
            No stores in this emirate yet. Try another delivery location in the
            top bar.
          </p>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {list.map((store) => (
              <div
                key={store.id}
                className="w-[min(78vw,280px)] shrink-0 snap-start"
              >
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        )}
      </section>

      <FeaturedCategories categories={featured} />

      <HomeDiscovery />

      <ProductRail
        id="top-rated"
        title="Top rated this week"
        subtitle="Looks shoppers love — sorted by rating and review buzz."
        products={topRated}
        href="/search?sort=rated"
      />

      <ProductRail
        title="Under AED 99"
        subtitle="Budget-friendly picks with same-hour delivery."
        products={under99}
        href="/search?max=99"
      />

      <HomeCollections />

      <ProductRail
        title="New in"
        subtitle="Fresh drops from boutiques across the UAE."
        products={newIn}
        href="/search?sort=new"
      />

      <RecentlyViewedRail />
    </div>
  );
}
