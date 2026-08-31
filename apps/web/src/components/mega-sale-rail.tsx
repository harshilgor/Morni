import Link from "next/link";
import { ProductCard } from "@/components/cards";
import type { RailProduct } from "@/components/product-rail";

export function MegaSaleRail({ products }: { products: RailProduct[] }) {
  if (products.length === 0) return null;

  return (
    <section className="border-y border-[#d95b74] bg-[#24151d] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-11">
        <div className="relative overflow-hidden border border-[#d95b74]/50 bg-[linear-gradient(110deg,#3a1625,#7d2848_52%,#d05b70)] p-5 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full border-[24px] border-white/10" aria-hidden="true" />
          <div className="relative flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#ffd5dc]">Limited-time edit · ✦</p>
              <h2 className="mt-2 font-display text-3xl sm:text-5xl">Mega Sale</h2>
              <p className="mt-1 max-w-lg text-sm text-white/80 sm:text-base">Premium-looking finds, all under AED 55.</p>
            </div>
            <Link href="/collection/under-55" className="shrink-0 border border-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white hover:text-[#24151d] sm:px-5 sm:py-3 sm:text-sm">Shop the edit</Link>
          </div>
        </div>
        <div className="shop-rail mt-5 sm:mt-7">
          {products.slice(0, 10).map((product) => (
            <div key={product.id} className="shop-rail-item-lg bg-white p-2 text-ink sm:p-2.5">
              <ProductCard product={product} href={product.href} sharp unoptimized />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
