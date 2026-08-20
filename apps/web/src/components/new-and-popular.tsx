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
    <section className="w-full bg-white py-8 sm:py-12">
      <div className="px-4 text-center sm:px-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-ink sm:text-sm sm:tracking-[0.28em]">
          New and popular
        </h2>
      </div>

      <div className="sticky top-[var(--site-header-height,0px)] z-40 mt-4 border-y border-[#e8e8e8] bg-white/95 px-4 py-2 shadow-[0_8px_18px_-16px_rgba(28,20,24,0.5)] backdrop-blur sm:mt-5 sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-1.5 sm:gap-2">
          {tabs.map((tab) => {
            const isActive = tab.slug === active.slug;
            return (
              <button
                key={tab.slug}
                type="button"
                onClick={() => setActiveSlug(tab.slug)}
                aria-pressed={isActive}
                className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition sm:px-4 sm:py-1.5 sm:text-[11px] sm:tracking-[0.12em] ${
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

      <div className="mt-5 grid w-full grid-cols-2 gap-px border-y border-[#e8e8e8] bg-[#e8e8e8] sm:mt-8 sm:grid-cols-3 xl:grid-cols-5">
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
              <div className="absolute right-1 top-1 z-10 sm:right-2 sm:top-2">
                <WishlistToggle productId={product.id} size="sm" />
              </div>
            </div>
            <div className="space-y-0.5 p-1.5 sm:space-y-1 sm:p-3">
              <h3 className="line-clamp-1 text-[11px] text-ink sm:text-xs">{product.title}</h3>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] font-semibold text-ink sm:text-xs">
                  {formatAed(product.price_aed)}
                </span>
                {product.compare_at_price_aed ? (
                  <span className="text-[10px] text-muted line-through sm:text-[11px]">
                    {formatAed(product.compare_at_price_aed)}
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 text-center sm:mt-8">
        <Link
          href={active.href}
          className="inline-flex border border-ink px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-white sm:px-6 sm:py-2.5 sm:text-[11px] sm:tracking-[0.16em]"
        >
          View all
        </Link>
      </div>
    </section>
  );
}
