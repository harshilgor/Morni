import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { ProductGridSkeleton } from "@/components/catalog-skeletons";
import { getCachedCategoryPage } from "@/lib/catalog";

async function CategoryPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cached = await getCachedCategoryPage(slug);
  if (!cached) notFound();
  if (cached.category.slug === "more") redirect("/");

  const { category, productPage, categories } = cached;
  const products = productPage.products as BrowsableProduct[];
  const ratings = productPage.ratings;

  return (
    <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-8">
      <nav className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3 pt-0.5 sm:mt-3 sm:items-end sm:pb-5">
        <div className="min-w-0">
          <h1 className="font-display text-[1.35rem] leading-tight text-ink sm:text-4xl">
            {category.name}
          </h1>
          <p className="mt-1 hidden text-sm text-muted sm:block">
            {products.length}
            {productPage.hasMore ? "+" : ""}{" "}
            {products.length === 1 ? "piece" : "pieces"} from local boutiques
          </p>
        </div>
        {category.badge ? (
          <span className="shrink-0 rounded-full border border-accent/40 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-deep sm:px-3 sm:py-1 sm:text-xs">
            {category.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-3 sm:mt-6">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
            <p className="text-muted">
              No {category.name.toLowerCase()} listed yet. Try another category
              below.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {categories
                .filter((item) => item.slug !== category.slug)
                .map((item) => (
                  <Link
                    key={item.slug}
                    href={`/categories/${item.slug}`}
                    className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
                  >
                    {item.name}
                  </Link>
                ))}
            </div>
            <Link href="/" className="mt-5 inline-block text-sm text-accent-deep underline">
              Back home
            </Link>
          </div>
        ) : (
          <ProductBrowser
            key={category.slug}
            products={products}
            categories={categories}
            activeSlug={category.slug}
            ratings={ratings}
            hasMore={productPage.hasMore}
            loadMoreUrl={`/api/categories/${category.slug}/products`}
          />
        )}
      </div>
    </div>
  );
}

export default function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <ProductGridSkeleton />
        </div>
      }
    >
      <CategoryPageContent params={params} />
    </Suspense>
  );
}
