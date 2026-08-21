import Link from "next/link";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { getCachedPriceRailProducts } from "@/lib/catalog";

export default async function Under99Page() {
  const { products, categories, ratings } = await getCachedPriceRailProducts(99);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Under AED 99</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            Under AED 99
          </h1>
        </div>
      </div>

      <div className="mt-6">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
            <p className="text-muted">
              No products under AED 99 are listed yet. Explore another category
              below.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
                >
                  {category.name}
                </Link>
              ))}
            </div>
            <Link href="/" className="mt-5 inline-block text-sm text-accent-deep underline">
              Back home
            </Link>
          </div>
        ) : (
          <ProductBrowser
            products={products as BrowsableProduct[]}
            categories={categories}
            ratings={ratings}
            showInStockFilter={false}
          />
        )}
      </div>
    </div>
  );
}
