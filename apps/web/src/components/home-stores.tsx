"use client";

import { useEffect, useRef, useState } from "react";
import { StoreCard } from "@/components/cards";
import { MouseDragScroll } from "@/components/mouse-drag-scroll";
import { EMIRATES, emirateLabel } from "@/lib/format";
import { useLocation } from "@/lib/location";
import type { Store, UaeEmirate } from "@/lib/types";

export function HomeStores({
  stores,
  initialEmirate,
}: {
  stores: Store[];
  initialEmirate?: UaeEmirate;
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

  const filtered =
    selected === "all"
      ? stores
      : stores.filter((store) => store.emirate === selected);

  return (
    <section id="stores" className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-ink">
            {selected === "all"
              ? "Stores near you"
              : `Stores in ${emirateLabel(selected)}`}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Same-hour delivery from local retail floors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected("all")}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              selected === "all"
                ? "bg-ink text-white"
                : "border border-line bg-surface text-muted hover:border-ink/30"
            }`}
          >
            All
          </button>
          {EMIRATES.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setSelected(e.value)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                selected === e.value
                  ? "bg-ink text-white"
                  : "border border-line bg-surface text-muted hover:border-ink/30"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center text-muted">
          No stores in this emirate yet. Try another delivery location in the
          top bar.
        </p>
      ) : (
        <MouseDragScroll className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.map((store) => (
            <div
              key={store.id}
              className="w-[min(78vw,280px)] shrink-0 snap-start"
            >
              <StoreCard store={store} />
            </div>
          ))}
        </MouseDragScroll>
      )}
    </section>
  );
}
