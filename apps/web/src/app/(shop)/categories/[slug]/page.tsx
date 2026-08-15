import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_PRODUCT_BATCH_SIZE,
  getCategoryProductPage,
} from "@/lib/category-product-page";
import {
  getBrowseCategory,
  mergeBrowseCategories,
  type BrowseCategory,
} from "@/lib/browse-categories";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const categoryListPromise = supabase
    .from("browse_categories")
    .select("name, slug")
    .neq("slug", "more")
    .order("sort_order");
  const { data: categoryData } = await supabase
    .from("browse_categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const category = getBrowseCategory(
    slug,
    categoryData ? [categoryData as BrowseCategory] : [],
  );

  if (!category) notFound();

  if (category.slug === "more") redirect("/");

  const [productPage, { data: categoryList }] = await Promise.all([
    getCategoryProductPage(supabase, category, 0, CATEGORY_PRODUCT_BATCH_SIZE),
    categoryListPromise,
  ]);
  const products = productPage.products as BrowsableProduct[];
  const categories = mergeBrowseCategories(
    (categoryList ?? []) as BrowseCategory[],
  ).map(({ name, slug: categorySlug }) => ({ name, slug: categorySlug }));
  const ratings = productPage.ratings;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
      <nav className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <div className="flex items-end justify-between gap-4 border-b border-line pb-4 pt-1 sm:mt-3 sm:flex-wrap sm:pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-accent-deep sm:hidden">
            Category
          </p>
          <h1 className="mt-1 font-display text-[2rem] leading-none text-ink sm:mt-0 sm:text-4xl">
            {category.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {products.length}{productPage.hasMore ? "+" : ""} {products.length === 1 ? "piece" : "pieces"} from local boutiques
          </p>
        </div>
        {category.badge ? (
          <span className="mb-0.5 shrink-0 rounded-full border border-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-deep">
            {category.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-5 sm:mt-6">
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
