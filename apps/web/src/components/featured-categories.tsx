import Link from "next/link";
import type { BrowseCategory } from "@/lib/browse-categories";

export function FeaturedCategories({
  categories,
}: {
  categories: BrowseCategory[];
}) {
  if (categories.length === 0) return null;

  const imageFor = (category: BrowseCategory) =>
    category.slug === "shararas"
      ? "/categories/shararas.jpg"
      : category.slug === "kurtis"
        ? "/categories/kurtis-featured.png"
        : category.slug === "party-wear"
          ? "/categories/party-wear-featured.png"
          : category.slug === "salwar-kameez"
            ? "/categories/salwar-kameez.webp"
            : category.slug === "indo-western"
              ? "/categories/indo-western.jpeg"
              : category.slug === "lehengas"
                ? "/categories/lehengas.webp"
                : category.slug === "office-wear"
                  ? "/categories/office-wear-featured.png"
                : category.image_url;

  return (
    <section className="w-full border-y border-[#dfd8d3] bg-[#faf7f5] py-14 sm:py-18">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent-deep sm:text-xs">
            Find your signature look
          </p>
          <h2 className="mt-3 font-display text-4xl leading-none text-ink sm:text-5xl lg:text-6xl">
            Featured categories
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base">
            Discover timeless silhouettes and modern occasionwear, curated from
            boutiques across the UAE.
          </p>
        </div>

        <div className="grid grid-cols-2 border-l border-t border-[#ded7d2] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={
                category.slug === "more"
                  ? "/categories"
                  : `/categories/${category.slug}`
              }
              className="group relative flex min-w-0 flex-col border-b border-r border-[#ded7d2] bg-white transition duration-300 hover:z-10 hover:border-[#9d5369] hover:shadow-[0_18px_45px_-30px_rgba(53,31,38,0.7)]"
            >
              <div className="flex min-h-[4.75rem] items-start justify-between gap-2 px-4 pb-3 pt-4 sm:min-h-[5.25rem] sm:px-5 sm:pt-5">
                <div>
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-1 font-display text-lg leading-tight text-ink transition group-hover:text-accent-deep sm:text-xl">
                    {category.name}
                  </h3>
                </div>
                <span
                  aria-hidden
                  className="mt-1 text-xl text-ink transition duration-300 group-hover:translate-x-1 group-hover:text-accent-deep"
                >
                  →
                </span>
              </div>

              <div className="relative mx-3 mb-3 aspect-[4/5] overflow-hidden bg-[#f2ece8] sm:mx-4 sm:mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageFor(category)}
                  alt={category.name}
                  className="h-full w-full object-cover object-top transition duration-700 ease-out group-hover:scale-[1.045]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5 opacity-70" />
                {category.badge ? (
                  <span className="absolute bottom-3 left-3 border border-white/70 bg-white/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-deep backdrop-blur-sm">
                    {category.badge}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/categories"
            className="inline-flex items-center gap-3 border-b border-ink pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:border-accent-deep hover:text-accent-deep"
          >
            Explore all categories
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
