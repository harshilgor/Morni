"use client";

import { useEffect, useRef, useState } from "react";
import { StoreCard } from "@/components/cards";
import { EMIRATES, emirateLabel } from "@/lib/format";
import { useLocation } from "@/lib/location";
import type { Store, UaeEmirate } from "@/lib/types";

export function HomeStores({
  stores,
  initialEmirate,
  layout = "rail",
}: {
  stores: Store[];
  initialEmirate?: UaeEmirate;
  layout?: "rail" | "grid";
}) {
  const deliveryEmirate = useLocation((s) => s.emirate);
  const [selected, setSelected] = useState<UaeEmirate | "all">(
    initialEmirate ?? deliveryEmirate ?? "all",
  );
  const skipSync = useRef(true);

  // Keep the store rail in sync when the header delivery location changes —
  // without navigating, so the shopper stays where they were on the page.
  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    setSelected(deliveryEmirate);
  }, [deliveryEmirate]);

  const registeredEmirates = new Set(stores.map((store) => store.emirate));
  const availableEmirates = EMIRATES.filter((emirate) =>
    registeredEmirates.has(emirate.value),
  );
  const activeSelection =
    selected === "all" || registeredEmirates.has(selected) ? selected : "all";

  const filtered =
    activeSelection === "all"
      ? stores
      : stores.filter((store) => store.emirate === activeSelection);

  return (
    <section id="stores" className="scroll-mt-28 border-y border-[#e2dfd8] bg-[#f8f7f4]">
      <div className="mx-auto max-w-6xl px-4 pb-9 pt-10 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b5a60]">
              Shop local
            </p>
            <h2 className="font-display text-3xl text-ink">
              {activeSelection === "all"
                ? "Stores near you"
                : `Stores in ${emirateLabel(activeSelection)}`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Same-day delivery from local retail floors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelected("all")}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                activeSelection === "all"
                  ? "bg-ink text-white"
                  : "border border-[#d9d6cf] bg-transparent text-[#5e5954] hover:border-ink/40 hover:text-ink"
              }`}
            >
              All
            </button>
            {availableEmirates.map((emirate) => (
              <button
                key={emirate.value}
                type="button"
                onClick={() => setSelected(emirate.value)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  activeSelection === emirate.value
                    ? "bg-ink text-white"
                    : "border border-[#d9d6cf] bg-transparent text-[#5e5954] hover:border-ink/40 hover:text-ink"
                }`}
              >
                {emirate.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d9d6cf] bg-white/70 p-10 text-center text-muted">
            No stores in this emirate yet. Try another delivery location in the
            top bar.
          </p>
        ) : layout === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filtered.map((store) => (
              <div
                key={store.id}
                className="w-[min(78vw,280px)] shrink-0 snap-start"
              >
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
