import Link from "next/link";
import Image from "next/image";
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
        </div>

        <div className="-mx-4 sm:mx-0">
          <div className="grid grid-cols-3 gap-[2px] bg-[#ded7d2] sm:gap-0 sm:border-l sm:border-t sm:border-[#ded7d2] sm:bg-transparent lg:grid-cols-4 xl:grid-cols-6">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group relative flex min-w-0 flex-col bg-white transition duration-300 hover:z-10 sm:border-b sm:border-r sm:border-[#ded7d2] sm:hover:border-[#9d5369] sm:hover:shadow-[0_18px_45px_-30px_rgba(53,31,38,0.7)]"
              >
                <div className="flex h-[4.75rem] shrink-0 items-start justify-between gap-1.5 px-2.5 pb-2 pt-3 sm:h-[6.5rem] sm:gap-2 sm:px-5 sm:pb-3 sm:pt-5">
                  <div className="min-w-0">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-1 line-clamp-2 font-display text-sm leading-tight text-ink transition group-hover:text-accent-deep sm:text-xl">
                      {category.name}
                    </h3>
                  </div>
                  <span
                    aria-hidden
                    className="mt-0.5 shrink-0 text-base text-ink transition duration-300 group-hover:translate-x-1 group-hover:text-accent-deep sm:mt-1 sm:text-xl"
                  >
                    →
                  </span>
                </div>

                <div className="relative mx-2 mb-2 aspect-[4/5] overflow-hidden bg-[#f2ece8] sm:mx-4 sm:mb-4">
                  <Image
                    src={imageFor(category)}
                    alt={category.name}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 1280px) 25vw, 16vw"
                    className="object-cover object-top transition duration-700 ease-out group-hover:scale-[1.045]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5 opacity-70" />
                  {category.badge ? (
                    <span className="absolute bottom-2 left-2 border border-white/70 bg-white/90 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] text-accent-deep backdrop-blur-sm sm:bottom-3 sm:left-3 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.12em]">
                      {category.badge}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
