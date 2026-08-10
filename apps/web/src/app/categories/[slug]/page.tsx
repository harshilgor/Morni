import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { createClient } from "@/lib/supabase/server";
import { fetchProductRatingMap } from "@/lib/product-ratings";
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

  if (category.slug === "more") redirect("/categories");

  const terms = (category.search_terms ?? [])
    .map((term) => term.replace(/[,()]/g, " ").trim())
    .filter(Boolean);

  let productsQuery = supabase
    .from("storefront_products")
    .select(
      "*, stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)",
    )
    .eq("is_available", true)
    .eq("stores.is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (terms.length > 0) {
    productsQuery = productsQuery.or(
      terms
        .flatMap((term) => [`title.ilike.%${term}%`, `description.ilike.%${term}%`])
        .join(","),
    );
  }

  const [{ data: productsData }, { data: categoryList }] = await Promise.all([
    productsQuery,
    supabase
      .from("browse_categories")
      .select("name, slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  const products = (productsData ?? []) as BrowsableProduct[];
  const categories = mergeBrowseCategories(
    (categoryList ?? []) as BrowseCategory[],
  ).map(({ name, slug: categorySlug }) => ({ name, slug: categorySlug }));
  const ratingMap = await fetchProductRatingMap(
    supabase,
    products.map((product) => product.id),
  );
  const ratings = Object.fromEntries(ratingMap);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href="/categories" className="hover:text-ink">
          Categories
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {category.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            From local UAE boutiques · Same-hour delivery available
          </p>
        </div>
        {category.badge ? (
          <span className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-deep">
            {category.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-6">
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
            products={products}
            categories={categories}
            activeSlug={category.slug}
            ratings={ratings}
          />
        )}
      </div>
    </div>
  );
}
