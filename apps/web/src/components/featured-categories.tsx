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
      <div className="border-t border-[#e8e8e8] py-10 text-center">
        <h2 className="text-sm font-bold uppercase tracking-[0.32em] text-ink">
          Featured categories
        </h2>
      </div>

      <div className="grid w-full grid-cols-2 gap-px border-y border-[#e8e8e8] bg-[#e8e8e8] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={
              category.slug === "more"
                ? "/categories"
                : `/categories/${category.slug}`
            }
            className="group flex flex-col bg-white p-5 transition hover:bg-[#fafafa] sm:p-6"
          >
            <div className="mb-5 flex min-h-[1.25rem] items-start justify-between gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
                {category.name}
              </h3>
              {category.badge ? (
                <span className="shrink-0 rounded-full border border-[#e8a0a8] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#c45b7a]">
                  {category.badge}
                </span>
              ) : null}
            </div>

            <div className="relative mt-auto aspect-[3/4] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.image_url}
                alt={category.name}
                className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
