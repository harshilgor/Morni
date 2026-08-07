"use client";

import Link from "next/link";
import { ProductCard } from "@/components/cards";
import { useRecentlyViewed } from "@/lib/recently-viewed";

export function RecentlyViewedRail() {
  const items = useRecentlyViewed((s) => s.items);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-5">
        <h2 className="font-display text-3xl text-ink">Recently viewed</h2>
        <p className="mt-1 text-sm text-muted">
          Pick up where you left off — looks you already explored.
        </p>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[min(58vw,220px)] shrink-0 snap-start sm:w-[230px]"
          >
            <ProductCard
              product={{
                id: item.id,
                title: item.title,
                price_aed: item.price_aed,
                compare_at_price_aed: item.compare_at_price_aed,
                image_urls: item.image_url ? [item.image_url] : [],
              }}
              href={item.href}
            />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link href="/for-you" className="text-sm text-accent-deep hover:underline">
          Get personal picks on For you →
        </Link>
      </div>
    </section>
  );
}
