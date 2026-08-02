import { StoreCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";
import { EMIRATES } from "@/lib/format";
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
    .order("name");

  if (emirate) {
    query = query.eq("emirate", emirate);
  }

  const { data: stores } = await query;
  const list = (stores ?? []) as Store[];

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:pt-20">
          <div className="animate-rise space-y-6">
            <p className="text-sm uppercase tracking-[0.22em] text-accent-deep">
              UAE · Local boutiques
            </p>
            <h1 className="font-display text-5xl leading-[0.95] text-ink sm:text-7xl">
              Morni
            </h1>
            <p className="max-w-md text-lg text-muted">
              Discover what nearby retail stores are offering — then get it
              delivered within the hour.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#stores"
                className="rounded-full bg-ink px-6 py-3 text-sm text-white transition hover:bg-accent-deep"
              >
                Browse stores
              </a>
              <Link
                href="/auth"
                className="rounded-full border border-line bg-surface px-6 py-3 text-sm text-ink transition hover:border-accent"
              >
                Sign in
              </Link>
            </div>
          </div>
          <div className="animate-rise-delay relative min-h-[280px] overflow-hidden rounded-[2rem] bg-sand">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1418]/55 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 text-sm text-white/95">
              <span className="animate-pulse-soft inline-block rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                Delivery within 1 hour
              </span>
            </p>
          </div>
        </div>
      </section>

      <section id="stores" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink">Stores near you</h2>
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
            {EMIRATES.slice(0, 4).map((e) => (
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
            No stores in this emirate yet.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
