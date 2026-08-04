import { Suspense } from "react";
import { StoreCard } from "@/components/cards";
import { FeaturedCategories } from "@/components/featured-categories";
import { HeroCarousel } from "@/components/hero-carousel";
import { LocationHomeSync } from "@/components/location-home-sync";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";
import type { Store } from "@/lib/types";
import { EMIRATES, emirateLabel } from "@/lib/format";
import type { UaeEmirate } from "@/lib/types";
import Link from "next/link";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ emirate?: string }>;
}) {
  const { emirate } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (emirate) {
    query = query.eq("emirate", emirate);
  }

  const [{ data: stores }, { data: categories }] = await Promise.all([
    query,
    supabase
      .from("browse_categories")
      .select("*")
      .eq("is_featured", true)
      .order("sort_order"),
  ]);

  const list = (stores ?? []) as Store[];
  const featured = (categories ?? []) as BrowseCategory[];
  const activeEmirate = emirate as UaeEmirate | undefined;

  return (
    <div>
      <HeroCarousel />
      <Suspense fallback={null}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <LocationHomeSync />
        </div>
      </Suspense>

      <section id="stores" className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink">
              {activeEmirate
                ? `Stores in ${emirateLabel(activeEmirate)}`
                : "Stores near you"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Same-hour delivery from local retail floors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className={`rounded-full px-3 py-1.5 text-xs ${!emirate ? "bg-ink text-white" : "bg-surface text-muted border border-line"}`}
            >
              All
            </Link>
            {EMIRATES.map((e) => (
              <Link
                key={e.value}
                href={`/?emirate=${e.value}`}
                className={`rounded-full px-3 py-1.5 text-xs ${emirate === e.value ? "bg-ink text-white" : "bg-surface text-muted border border-line"}`}
              >
                {e.label}
              </Link>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center text-muted">
            No stores in this emirate yet. Try another delivery location in the
            top bar.
          </p>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {list.map((store) => (
              <div
                key={store.id}
                className="w-[min(78vw,280px)] shrink-0 snap-start"
              >
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        )}
      </section>

      <FeaturedCategories categories={featured} />
    </div>
  );
}
