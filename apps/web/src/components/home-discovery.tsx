"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/cards";
import type { RailProduct } from "@/components/product-rail";

export type IntentRail = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  href: string;
  products: RailProduct[];
};

export function HomeDiscovery({ intents }: { intents: IntentRail[] }) {
  const [activeId, setActiveId] = useState(intents[0]?.id ?? "");
  const active = intents.find((intent) => intent.id === activeId) ?? intents[0];

  if (!active) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-deep sm:text-[11px]">
        Shop by intent
      </p>
      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 sm:mt-3 sm:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {intents.map((intent) => {
          const selected = intent.id === active.id;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => setActiveId(intent.id)}
              aria-pressed={selected}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-ink/30 sm:px-3.5 sm:py-2 sm:text-xs ${
                selected
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white/80 text-ink hover:border-ink/30 hover:bg-white"
              }`}
            >
              {intent.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 sm:mt-8">
        <div className="min-w-0">
          <h2 className="shop-section-title">{active.title}</h2>
          <p className="shop-section-copy">{active.subtitle}</p>
        </div>
        <Link href={active.href} className="shrink-0 text-xs font-medium text-accent-deep hover:underline sm:text-sm">
          View all
        </Link>
      </div>

      {active.products.length > 0 ? (
        <div className="shop-rail mt-4 sm:mt-5">
          {active.products.map((product) => (
            <div key={product.id} className="shop-rail-item">
              <ProductCard product={product} href={product.href} rating={product.rating} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-background p-5 text-sm text-muted sm:mt-5 sm:p-6">
          Nothing matches this edit yet. Explore the full collection instead.
        </p>
      )}
    </section>
  );
}
