import Link from "next/link";
import type { BrowseCategory } from "@/lib/browse-categories";

export function FeaturedCategories({
  categories,
}: {
  categories: BrowseCategory[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="w-full bg-white">
      <div className="border-t border-[#e8e8e8] py-8 text-center">
        <h2 className="text-sm font-bold uppercase tracking-[0.28em] text-ink">
          Featured categories
        </h2>
      </div>

      <div className="grid w-full grid-cols-2 gap-px border-y border-[#e8e8e8] bg-[#e8e8e8] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={
              category.slug === "more"
                ? "/categories"
                : `/categories/${category.slug}`
            }
            className="group flex flex-col bg-transparent p-4 transition hover:bg-white/30 sm:p-5"
          >
            <div className="flex min-h-[1.25rem] items-start justify-between gap-2">
              <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-ink">
                {category.name}
              </h3>
              {category.badge ? (
                <span className="shrink-0 rounded-full border border-[#e8a0a8] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#c45b7a]">
                  {category.badge}
                </span>
              ) : null}
            </div>

            <div className="relative mt-4 aspect-[4/5] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.image_url}
                alt={category.name}
                className="h-full w-full object-contain object-top transition duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
