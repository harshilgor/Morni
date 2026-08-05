import Link from "next/link";
import { ProductCard } from "@/components/cards";

export type RailProduct = {
  id: string;
  title: string;
  price_aed: number;
  compare_at_price_aed?: number | null;
  image_urls?: string[];
  href: string;
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
  if (products.length === 0) return null;

  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="shrink-0 text-sm font-medium text-accent-deep hover:underline"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[min(58vw,220px)] shrink-0 snap-start sm:w-[230px]"
          >
            <ProductCard product={product} href={product.href} />
          </div>
        ))}
      </div>
    </section>
  );
}
