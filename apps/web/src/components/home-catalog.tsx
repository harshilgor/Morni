import { FeaturedCategories } from "@/components/featured-categories";
import { HomeDiscovery, type IntentRail } from "@/components/home-discovery";
import { HomeStores } from "@/components/home-stores";
import { NewAndPopular, type PopularTab } from "@/components/new-and-popular";
import { ProductRail } from "@/components/product-rail";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import { TrendingForYou } from "@/components/trending-for-you";
import { ShopBySize } from "@/components/shop-by-size";
import { getCachedHomeCatalog, type ProductWithStore } from "@/lib/catalog";
import { productMatchesBrowseCategory } from "@/lib/product-browse-category";
import { catalogShuffleSeed, shuffleCatalog } from "@/lib/catalog-random";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import type { UaeEmirate } from "@/lib/types";

export async function HomeCatalog({
  initialEmirate,
}: {
  initialEmirate?: UaeEmirate;
}) {
  const { stores, storeRecommendationStats, featured, products, megaSale, under99, under149, luxuryPicks, ratings } =
    await getCachedHomeCatalog();
  const ratingRecord = ratings as Record<string, ProductRatingSummary>;

  const toRailProduct = (product: ProductWithStore, includeRating = false) => ({
    id: product.id,
    title: product.title,
    price_aed: Number(product.price_aed),
    compare_at_price_aed: product.compare_at_price_aed,
    image_urls: product.image_urls,
    href: `/stores/${product.stores.slug}/products/${product.id}`,
    rating: includeRating ? ratingRecord[product.id] ?? null : undefined,
  });

  const megaSaleRail = megaSale.slice(0, 10).map((product) => toRailProduct(product));

  const under99Rail = under99.slice(0, 10).map((product) => toRailProduct(product));

  const under149Rail = under149.slice(0, 10).map((product) => toRailProduct(product));

  const luxuryPicksRail = luxuryPicks
    .slice(0, 10)
    .map((product) => toRailProduct(product));

  const newIn = products.slice(0, 10).map((product) => toRailProduct(product));
  // New & popular should not be a second copy of the newest-products rail.
  // Shuffle the full cached candidate set once per day so older inventory gets
  // a fair chance while the order remains stable during a browsing session.
  const popularPool = shuffleCatalog(products, catalogShuffleSeed("home-popular"));

  const topRated = [...products]
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
      id: "under-55",
      label: "Under AED 55",
      title: "Under AED 55",
      subtitle: "High-value boutique finds at an easy price.",
      href: "/collection/under-55",
      products: megaSaleRail,
    },
    {
      id: "under-99",
      label: "AED 55 – AED 99",
      title: "AED 55 – AED 99",
      subtitle: "Boutique picks from AED 55 to AED 99.",
      href: "/collection/under-99",
      products: under99Rail,
    },
    {
      id: "under-149",
      label: "AED 99 – AED 149",
      title: "AED 99 – AED 149",
      subtitle: "More to love from AED 99 to AED 149.",
      href: "/under-149",
      products: under149Rail,
    },
    {
      id: "luxury",
      label: "Luxury picks",
      title: "Luxury picks",
      subtitle: "Statement pieces made for special plans.",
      href: "/collection/luxury",
      products: luxuryPicksRail,
    },
    {
      id: "new-in",
      label: "New in",
      title: "New in",
      subtitle: "Fresh drops from boutiques across the UAE.",
      href: "/collection/new-in",
      products: newIn,
    },
    {
      id: "best-rated",
      label: "Best rated",
      title: "Best rated",
      subtitle: "Looks shoppers love, sorted by verified ratings.",
      href: "/collection/best-rated",
      products: topRated.length > 0 ? topRated : newIn,
    },
  ];

  const categoryTabs: PopularTab[] = featured
    .filter((category) => category.slug !== "more")
    .map((category) => {
      const matches = products.filter((product) =>
        productMatchesBrowseCategory(category, product),
      );
      return {
        slug: category.slug,
        label: category.name,
        href: `/categories/${category.slug}`,
        products: shuffleCatalog(matches, catalogShuffleSeed(`category:${category.slug}`)).slice(0, 10).map((p) => ({
          id: p.id,
          title: p.title,
          price_aed: Number(p.price_aed),
          compare_at_price_aed: p.compare_at_price_aed,
          image_urls: p.image_urls,
          href: `/stores/${p.stores.slug}/products/${p.id}`,
        })),
      };
    })
    .filter((tab) => tab.products.length >= 3);

  const popularTabs: PopularTab[] = [
    { slug: "all", label: "All", href: "/search", products: popularPool.slice(0, 10).map((p) => toRailProduct(p)) },
    ...categoryTabs,
  ];

  return (
    <>
      <FeaturedCategories categories={featured} />
      <ShopBySize />
      <HomeDiscovery intents={intentRails} />
      <TrendingForYou products={products} />
      {topRated.length > 0 ? (
        <ProductRail
          id="top-rated"
          title="Top rated this week"
          subtitle="Looks shoppers love — sorted by verified ratings."
          products={topRated}
          href="/search?sort=rated"
          unoptimized
        />
      ) : null}
      <ProductRail title="New in" products={newIn} href="/search?sort=new" sharp unoptimized />
      <RecentlyViewedRail />
      <HomeStores
        stores={stores}
        storeRecommendationStats={storeRecommendationStats}
        initialEmirate={initialEmirate}
      />
      <NewAndPopular tabs={popularTabs} />
    </>
  );
}
