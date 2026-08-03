import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";
import type { Product } from "@/lib/types";

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

  if (!categoryData) notFound();
  const category = categoryData as BrowseCategory;

  if (category.slug === "more") {
    const { redirect } = await import("next/navigation");
    redirect("/categories");
  }

  const { data: productsData } = await supabase
    .from("products")
    .select("*, stores!inner(slug, name, is_active)")
    .eq("is_available", true)
    .eq("stores.is_active", true)
    .order("created_at", { ascending: false })
    .limit(60);

  const terms = (category.search_terms ?? []).map((t) => t.toLowerCase());
  const products = ((productsData ?? []) as (Product & {
    stores: { slug: string; name: string };
  })[]).filter((product) => {
    if (terms.length === 0) return true;
    const haystack = `${product.title} ${product.description ?? ""}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
        Category
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            {category.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            From local UAE stores · Delivery within 1 hour
          </p>
        </div>
        {category.badge ? (
          <span className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-deep">
            {category.badge}
          </span>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
          <p className="text-muted">
            No products in this category yet. Check back soon or browse stores.
          </p>
          <Link href="/" className="mt-4 inline-block text-accent-deep underline">
            Back home
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              href={`/stores/${product.stores.slug}/products/${product.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
