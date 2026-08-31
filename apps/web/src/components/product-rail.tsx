import Link from "next/link";
import { ProductCard } from "@/components/cards";
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
  sharp = false,
  unoptimized = false,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  products: RailProduct[];
  href?: string;
  /** Match Shop by intent: bare photo + name + price, larger cards */
  sharp?: boolean;
  unoptimized?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
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
      <div className="shop-rail">
        {products.map((product) => (
          <div
            key={product.id}
            className={sharp ? "shop-rail-item-lg" : "shop-rail-item"}
          >
            <ProductCard
              product={product}
              href={product.href}
              rating={product.rating}
              sharp={sharp}
              unoptimized={unoptimized}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
