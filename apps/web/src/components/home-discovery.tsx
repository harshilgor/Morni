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
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
        Shop by intent
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {intents.map((intent) => {
          const selected = intent.id === active.id;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => setActiveId(intent.id)}
              aria-pressed={selected}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-ink/30 ${
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

      <div className="mt-8 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-ink">{active.title}</h2>
          <p className="mt-1 text-sm text-muted">{active.subtitle}</p>
        </div>
        <Link href={active.href} className="shrink-0 text-sm font-medium text-accent-deep hover:underline">
          View all
        </Link>
      </div>

      {active.products.length > 0 ? (
        <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {active.products.map((product) => (
            <div key={product.id} className="w-[min(64vw,240px)] shrink-0 snap-start sm:w-[230px]">
              <ProductCard product={product} href={product.href} rating={product.rating} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-line bg-background p-6 text-sm text-muted">
          Nothing matches this edit yet. Explore the full collection instead.
        </p>
      )}
    </section>
  );
}
