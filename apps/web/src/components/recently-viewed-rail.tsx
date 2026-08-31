"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ProductCard } from "@/components/cards";
import { useRecentlyViewed } from "@/lib/recently-viewed";

export function RecentlyViewedRail() {
  const items = useRecentlyViewed((s) => s.items);

  useEffect(() => {
    void useRecentlyViewed.persist.rehydrate();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="border-y border-[#e2dfd8] bg-[#f8f7f4]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-4 sm:mb-5">
          <h2 className="shop-section-title">Recently viewed</h2>
        </div>
        <div className="shop-rail">
          {items.map((item) => (
            <div key={item.id} className="shop-rail-item-lg">
              <ProductCard
                product={{
                  id: item.id,
                  title: item.title,
                  price_aed: item.price_aed,
                  compare_at_price_aed: item.compare_at_price_aed,
                  image_urls: item.image_url ? [item.image_url] : [],
                }}
                href={item.href}
                sharp
                unoptimized
              />
            </div>
          ))}
        </div>
        <div className="mt-3 sm:mt-4">
          <Link href="/for-you" className="text-xs font-medium text-ink hover:underline sm:text-sm">
            Get personal picks on For you →
          </Link>
        </div>
      </div>
    </section>
  );
}
