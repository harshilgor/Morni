import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";

export default async function CategoriesIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("browse_categories")
    .select("*")
    .neq("slug", "more")
    .order("sort_order")
    .order("name");

  const categories = (data ?? []) as BrowseCategory[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">All categories</h1>
      <p className="mt-2 text-sm text-muted">
        Explore every category on Morni — delivery within 1 hour.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-accent/40"
          >
            <div className="aspect-[4/3] overflow-hidden bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.image_url}
                alt={category.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-ink">
                {category.name}
              </h2>
              {category.badge ? (
                <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] uppercase text-accent-deep">
                  {category.badge}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
