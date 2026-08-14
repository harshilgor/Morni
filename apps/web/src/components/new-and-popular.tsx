"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAed } from "@/lib/format";
import { WishlistToggle } from "@/components/wishlist-toggle";
import type { RailProduct } from "@/components/product-rail";

export type PopularTab = {
  slug: string;
  label: string;
  href: string;
  products: RailProduct[];
};

export function NewAndPopular({ tabs }: { tabs: PopularTab[] }) {
  const [activeSlug, setActiveSlug] = useState(tabs[0]?.slug ?? "");
  const active = tabs.find((tab) => tab.slug === activeSlug) ?? tabs[0];

  if (!active || active.products.length === 0) return null;

  return (
    <section className="w-full bg-white py-12">
      <div className="px-4 text-center sm:px-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.28em] text-ink">
          New and popular
        </h2>
        <div className="sticky top-[var(--site-header-height,0px)] z-40 -mx-4 mt-5 border-y border-[#e8e8e8] bg-white/95 px-4 py-3 shadow-[0_8px_18px_-16px_rgba(28,20,24,0.5)] backdrop-blur sm:static sm:mx-0 sm:mt-5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible">
            {tabs.map((tab) => {
              const isActive = tab.slug === active.slug;
              return (
                <button
                  key={tab.slug}
                  type="button"
                  onClick={() => setActiveSlug(tab.slug)}
                  aria-pressed={isActive}
                  className={`shrink-0 border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                    isActive
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink/40"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 grid w-full grid-cols-3 gap-px border-y border-[#e8e8e8] bg-[#e8e8e8] sm:grid-cols-3 xl:grid-cols-5">
        {active.products.map((product) => (
          <Link
            key={product.id}
            href={product.href}
            className="group relative flex flex-col bg-white"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-sand">
              {product.image_urls?.[0] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={product.image_urls[0]}
                  alt={product.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : null}
              <div className="absolute right-1.5 top-1.5 z-10 sm:right-2 sm:top-2">
                <WishlistToggle productId={product.id} size="sm" />
              </div>
            </div>
            <div className="space-y-1 p-2 sm:p-3">
              <h3 className="line-clamp-1 text-xs text-ink">{product.title}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">
                  {formatAed(product.price_aed)}
                </span>
                {product.compare_at_price_aed ? (
                  <span className="text-[11px] text-muted line-through">
                    {formatAed(product.compare_at_price_aed)}
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href={active.href}
          className="inline-flex border border-ink px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-ink hover:text-white"
        >
          View all
        </Link>
      </div>
    </section>
  );
}
