import { Suspense } from "react";
import { FeaturedCategories } from "@/components/featured-categories";
import { HeroCarousel } from "@/components/hero-carousel";
import { HomeCollections } from "@/components/home-collections";
import { HomeDiscovery } from "@/components/home-discovery";
import { HomeStores } from "@/components/home-stores";
import { LocationHomeSync } from "@/components/location-home-sync";
import { NewAndPopular, type PopularTab } from "@/components/new-and-popular";
import { ProductRail } from "@/components/product-rail";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import { fetchProductRatingMap } from "@/lib/product-ratings";
import type { Product, Store, UaeEmirate } from "@/lib/types";

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

  const [{ data: stores }, { data: categories }, { data: products }] =
    await Promise.all([
      supabase
        .from("stores")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
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
  const initialEmirate = emirate as UaeEmirate | undefined;
  const productList = (products ?? []) as ProductWithStore[];
  const ratingMap = await fetchProductRatingMap(
    supabase,
    productList.map((product) => product.id),
  );
  const ratingRecord = Object.fromEntries(ratingMap) as Record<
    string,
    ProductRatingSummary
  >;

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
    .map((product) => ({
      product,
      rating: ratingRecord[product.id],
    }))
    .filter((entry) => entry.rating && entry.rating.reviewCount >= 3)
    .sort(
      (a, b) =>
        (b.rating?.avgRating ?? 0) - (a.rating?.avgRating ?? 0) ||
        (b.rating?.reviewCount ?? 0) - (a.rating?.reviewCount ?? 0),
    )
    .slice(0, 10)
    .map(({ product: p }) => ({
      id: p.id,
      title: p.title,
      price_aed: Number(p.price_aed),
      compare_at_price_aed: p.compare_at_price_aed,
      image_urls: p.image_urls,
      href: `/stores/${p.stores.slug}/products/${p.id}`,
      rating: ratingRecord[p.id] ?? null,
    }));

  const newIn = productList.slice(0, 10).map((p) => ({
    id: p.id,
    title: p.title,
    price_aed: Number(p.price_aed),
    compare_at_price_aed: p.compare_at_price_aed,
    image_urls: p.image_urls,
    href: `/stores/${p.stores.slug}/products/${p.id}`,
  }));

  const categoryTabs: PopularTab[] = featured
    .filter((category) => category.slug !== "more")
    .map((category) => {
      const terms = (category.search_terms ?? []).map((term) =>
        term.toLowerCase(),
      );
      const matches = productList.filter((p) => {
        if (terms.length === 0) return false;
        const haystack = `${p.title} ${p.description ?? ""}`.toLowerCase();
        return terms.some((term) => haystack.includes(term));
      });
      return {
        slug: category.slug,
        label: category.name,
        href: `/categories/${category.slug}`,
        products: matches.slice(0, 10).map((p) => ({
          id: p.id,
          title: p.title,
          price_aed: Number(p.price_aed),
          compare_at_price_aed: p.compare_at_price_aed,
          image_urls: p.image_urls,
          href: `/stores/${p.stores.slug}/products/${p.id}`,
        })),
      };
    })
    // Skip categories too thin to fill a row so the tab strip never shows dead ends.
    .filter((tab) => tab.products.length >= 3);

  const popularTabs: PopularTab[] = [
    { slug: "all", label: "All", href: "/search", products: newIn },
    ...categoryTabs,
  ];

  return (
    <div>
      <HeroCarousel />

      <Suspense fallback={null}>
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <LocationHomeSync />
        </div>
      </Suspense>

      <HomeStores stores={list} initialEmirate={initialEmirate} />

      <FeaturedCategories categories={featured} />

      <HomeDiscovery />

      {topRated.length > 0 ? (
        <ProductRail
          id="top-rated"
          title="Top rated this week"
          subtitle="Looks shoppers love — sorted by verified ratings."
          products={topRated}
          href="/search?sort=rated"
        />
      ) : null}

      <ProductRail
        title="Under AED 99"
        subtitle="Budget-friendly picks with same-hour delivery."
        products={under99}
        href="/under-99"
      />

      <HomeCollections />

      <NewAndPopular tabs={popularTabs} />

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
