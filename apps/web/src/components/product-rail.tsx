"use client";

import Link from "next/link";
import { ProductCard } from "@/components/cards";
import { useScrollReveal, useRevealOnce } from "@/lib/use-scroll-reveal";
import type { ProductRatingSummary } from "@/lib/product-ratings";

export type RailProduct = {
  id: string;
  title: string;
  price_aed: number;
  compare_at_price_aed?: number | null;
  image_urls?: string[];
  href: string;
  rating?: ProductRatingSummary | null;
};

export function ProductRail({
  id,
  title,
  subtitle,
  products,
  href,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  products: RailProduct[];
  href?: string;
}) {
  const headingRef = useRevealOnce<HTMLDivElement>({ distance: 10 });
  const railRef = useScrollReveal<HTMLDivElement>({ selector: ".shop-rail-item", stagger: 50, distance: 16 });

  if (products.length === 0) return null;

  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div ref={headingRef} className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
        <div className="min-w-0">
          <h2 className="shop-section-title">{title}</h2>
          {subtitle ? <p className="shop-section-copy">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="shrink-0 text-xs font-medium text-accent-deep hover:underline sm:text-sm"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div ref={railRef} className="shop-rail">
        {products.map((product) => (
          <div key={product.id} className="shop-rail-item">
            <ProductCard product={product} href={product.href} rating={product.rating} />
          </div>
        ))}
      </div>
    </section>
  );
}
