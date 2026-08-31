import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import {
  getCachedBrowseCategories,
  getCachedHomeCatalog,
  getCachedPriceRailProducts,
} from "@/lib/catalog";

const COLLECTIONS = {
  "under-99": "Under AED 99",
  "under-199": "Under AED 199",
  luxury: "Luxury picks",
  "new-in": "New in",
  "best-rated": "Best rated",
} as const;

const COLLECTION_LINKS = Object.entries(COLLECTIONS).map(([slug, label]) => ({
  href: `/collection/${slug}`,
  label,
}));

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = COLLECTIONS[slug as keyof typeof COLLECTIONS];
  if (!title) notFound();

  const home = await getCachedHomeCatalog();
  const priceBand = slug === "under-99" || slug === "under-199"
    ? await getCachedPriceRailProducts(slug === "under-99" ? 99 : 199)
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
    <div className="square-catalog mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{title}</span>
      </nav>
      <div className="mt-3 border-b border-line pb-5">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
      </div>
      <div className="mt-6">
        <ProductBrowser
          products={products as BrowsableProduct[]}
          categories={categories}
          ratings={home.ratings}
          showInStockFilter={false}
          sharp
          square
          collectionLinks={COLLECTION_LINKS.map((link) => ({
            ...link,
            active: link.href === `/collection/${slug}`,
          }))}
        />
      </div>
    </div>
  );
}
