import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import {
  getCachedBrowseCategories,
  getCachedHomeCatalog,
  getCachedPriceRailProducts,
} from "@/lib/catalog";

const COLLECTIONS = {
  "under-99": "AED 55 – AED 99",
  "under-55": "Mega Sale · Under AED 55",
  "under-199": "Under AED 199",
  luxury: "Luxury picks",
  "new-in": "New in",
  "best-rated": "Best rated",
} as const;

const DISPLAY_TITLES = {
  "under-55": "Products Under AED 55",
  "under-99": "Products AED 55 – AED 99",
  "under-149": "Products AED 99 – AED 149",
  "under-199": "Products Under AED 199",
} as const;

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = COLLECTIONS[slug as keyof typeof COLLECTIONS];
  if (!title) notFound();
  const pageTitle = DISPLAY_TITLES[slug as keyof typeof DISPLAY_TITLES] ?? title;

  const home = await getCachedHomeCatalog();
  const priceBand = slug === "under-55" || slug === "under-99" || slug === "under-149" || slug === "under-199"
    ? await getCachedPriceRailProducts(
      slug === "under-55"
        ? { maxPrice: 55, tag: "price:0-55" }
        : slug === "under-99"
          ? { minPriceExclusive: 55, maxPrice: 99, tag: "price:55-99" }
          : slug === "under-149"
            ? { minPriceExclusive: 99, maxPrice: 149, tag: "price:99-149" }
            : { maxPrice: 199, tag: "price:0-199" },
    )
    : null;
  let products = priceBand?.products ?? home.products;
  if (slug === "luxury") products = home.luxuryPicks;
  if (slug === "best-rated") {
    products = home.products
      .filter((product) => (home.ratings[product.id]?.reviewCount ?? 0) >= 3)
      .sort((a, b) => (home.ratings[b.id]?.avgRating ?? 0) - (home.ratings[a.id]?.avgRating ?? 0));
  }
  const categories = await getCachedBrowseCategories();

  return (
    <div className="square-catalog mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{pageTitle}</span>
      </nav>
      <div className="mt-3 border-b border-line pb-5">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{pageTitle}</h1>
      </div>
      <div className="mt-6">
        <ProductBrowser
          products={products as BrowsableProduct[]}
          categories={categories}
          ratings={home.ratings}
          showInStockFilter={false}
          sharp
          square
        />
      </div>
    </div>
  );
}
