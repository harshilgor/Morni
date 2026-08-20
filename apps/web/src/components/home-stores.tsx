"use client";

import { useEffect, useRef, useState } from "react";
import { StoreCard } from "@/components/cards";
import { EMIRATES, emirateLabel } from "@/lib/format";
import { useLocation } from "@/lib/location";
import type { Store, UaeEmirate } from "@/lib/types";

function EmirateFilters({
  activeSelection,
  availableEmirates,
  onSelect,
}: {
  activeSelection: UaeEmirate | "all";
  availableEmirates: typeof EMIRATES;
  onSelect: (value: UaeEmirate | "all") => void;
}) {
  const pillClass = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-[11px] transition sm:px-3 sm:py-1.5 sm:text-xs ${
      active
        ? "bg-ink text-white"
        : "border border-[#d9d6cf] bg-transparent text-[#5e5954] hover:border-ink/40 hover:text-ink"
    }`;

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={pillClass(activeSelection === "all")}
      >
        All
      </button>
      {availableEmirates.map((emirate) => (
        <button
          key={emirate.value}
          type="button"
          onClick={() => onSelect(emirate.value)}
          className={pillClass(activeSelection === emirate.value)}
        >
          {emirate.label}
        </button>
      ))}
    </div>
  );
}

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
      <div className="mx-auto max-w-6xl px-4 pb-7 pt-8 sm:px-6 sm:pb-9 sm:pt-10">
        <div
          className={`mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5 sm:gap-4 ${
            layout === "grid" ? "" : "sm:mb-7"
          }`}
        >
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b5a60] sm:mb-2">
              Shop local
            </p>
            <h2 className="shop-section-title">
              {activeSelection === "all"
                ? "Stores near you"
                : `Stores in ${emirateLabel(activeSelection)}`}
            </h2>
            <p className="shop-section-copy">
              Same-day delivery from local retail floors.
            </p>
          </div>
          {layout === "rail" ? (
            <EmirateFilters
              activeSelection={activeSelection}
              availableEmirates={availableEmirates}
              onSelect={setSelected}
            />
          ) : null}
        </div>

        {layout === "grid" ? (
          <div className="sticky top-[var(--site-header-height,0px)] z-30 -mx-4 mb-4 border-y border-[#e2dfd8] bg-[#f8f7f4]/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:mb-5 sm:px-6 sm:py-3">
            <EmirateFilters
              activeSelection={activeSelection}
              availableEmirates={availableEmirates}
              onSelect={setSelected}
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d9d6cf] bg-white/70 p-8 text-center text-sm text-muted sm:p-10">
            No stores in this emirate yet. Try another delivery location in the
            top bar.
          </p>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
            {filtered.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="shop-rail">
            {filtered.map((store) => (
              <div key={store.id} className="shop-rail-item-wide">
                <StoreCard store={store} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
