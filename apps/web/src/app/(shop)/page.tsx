import { FeaturedCategories } from "@/components/featured-categories";
import { HeroCarousel } from "@/components/hero-carousel";
import { HomeCollections } from "@/components/home-collections";
import { HomeDiscovery, type IntentRail } from "@/components/home-discovery";
import { HomeStores } from "@/components/home-stores";
import { NewAndPopular, type PopularTab } from "@/components/new-and-popular";
import { ProductRail } from "@/components/product-rail";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import { createClient } from "@/lib/supabase/server";
import {
  mergeFeaturedCategories,
  type BrowseCategory,
} from "@/lib/browse-categories";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import { fetchProductRatingMap } from "@/lib/product-ratings";
import { productMatchesBrowseCategory } from "@/lib/product-browse-category";
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
        .from("storefront_products")
        .select("*, stores!inner(slug, name, is_active)")
        .eq("is_available", true)
        .eq("stores.is_active", true)
        .order("created_at", { ascending: false })
        .limit(48),
    ]);

  const list = (stores ?? []) as Store[];
  const featured = mergeFeaturedCategories(
    (categories ?? []) as BrowseCategory[],
  );
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

  const toRailProduct = (product: ProductWithStore, includeRating = false) => ({
    id: product.id,
    title: product.title,
    price_aed: Number(product.price_aed),
    compare_at_price_aed: product.compare_at_price_aed,
    image_urls: product.image_urls,
    href: `/stores/${product.stores.slug}/products/${product.id}`,
    rating: includeRating ? ratingRecord[product.id] ?? null : undefined,
  });

  const under99 = productList
    .filter((product) => Number(product.price_aed) <= 99)
    .slice(0, 10)
    .map((product) => toRailProduct(product));

  const under199 = productList
    .filter((product) => Number(product.price_aed) <= 199)
    .slice(0, 10)
    .map((product) => toRailProduct(product));

  const luxuryPicks = productList
    .filter((product) => Number(product.price_aed) >= 500)
    .slice(0, 10)
    .map((product) => toRailProduct(product));

  const inStock = productList
    .filter((product) => product.stock > 0)
    .slice(0, 10)
    .map((product) => toRailProduct(product));

  const newIn = productList
    .slice(0, 10)
    .map((product) => toRailProduct(product));

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
    .map(({ product }) => toRailProduct(product, true));

  const intentRails: IntentRail[] = [
    {
      id: "under-99",
      label: "Under AED 99",
      title: "Under AED 99",
      subtitle: "Budget-friendly picks from local boutiques.",
      href: "/search?max=99",
      products: under99,
    },
    {
      id: "under-199",
      label: "Under AED 199",
      title: "Under AED 199",
      subtitle: "More to love, still easy on the budget.",
      href: "/search?max=199",
      products: under199,
    },
    {
      id: "luxury",
      label: "Luxury picks",
      title: "Luxury picks",
      subtitle: "Statement pieces made for special plans.",
      href: "/search?min=500",
      products: luxuryPicks,
    },
    {
      id: "new-in",
      label: "New in",
      title: "New in",
      subtitle: "Fresh drops from boutiques across the UAE.",
      href: "/search?sort=new",
      products: newIn,
    },
    {
      id: "best-rated",
      label: "Best rated",
      title: "Best rated",
      subtitle: "Looks shoppers love, sorted by verified ratings.",
      href: "/search?sort=rated",
      products: topRated.length > 0 ? topRated : newIn,
    },
    {
      id: "in-stock",
      label: "In stock",
      title: "In stock",
      subtitle: "Available now from boutiques near you.",
      href: "/search?instock=1",
      products: inStock,
    },
  ];

  const categoryTabs: PopularTab[] = featured
    .filter((category) => category.slug !== "more")
    .map((category) => {
      const matches = productList.filter((product) =>
        productMatchesBrowseCategory(category, product),
      );
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

      <FeaturedCategories categories={featured} />

      <HomeDiscovery intents={intentRails} />

      <HomeStores stores={list} initialEmirate={initialEmirate} />

      {topRated.length > 0 ? (
        <ProductRail
          id="top-rated"
          title="Top rated this week"
          subtitle="Looks shoppers love — sorted by verified ratings."
          products={topRated}
          href="/search?sort=rated"
        />
      ) : null}

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
