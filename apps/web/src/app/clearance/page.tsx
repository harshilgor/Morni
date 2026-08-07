import Link from "next/link";
import { ProductBrowser, type BrowsableProduct } from "@/components/product-browser";
import { createClient } from "@/lib/supabase/server";
import { fetchProductRatingMap } from "@/lib/product-ratings";

export default async function ClearancePage() {
  const supabase = await createClient();

  const [{ data: productsData }, { data: categoryList }] = await Promise.all([
    supabase
      .from("storefront_products")
      .select(
        "*, stores!inner(slug, name, is_active, emirate, area, delivery_eta_minutes)",
      )
      .eq("is_available", true)
      .eq("stores.is_active", true)
      .not("compare_at_price_aed", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("browse_categories")
      .select("name, slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  const products = ((productsData ?? []) as BrowsableProduct[]).filter(
    (product) =>
      product.compare_at_price_aed != null &&
      Number(product.compare_at_price_aed) > Number(product.price_aed),
  );
  const categories = (categoryList ?? []) as { name: string; slug: string }[];
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
        <span className="text-ink">Clearance sale</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            Clearance sale
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Final markdowns from local UAE boutiques - same-hour delivery available
          </p>
        </div>
      </div>

      <div className="mt-6">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
            <p className="text-muted">
              No clearance products are listed right now. Explore another category
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
          <ProductBrowser products={products} categories={categories} ratings={ratings} />
        )}
      </div>
    </div>
  );
}
