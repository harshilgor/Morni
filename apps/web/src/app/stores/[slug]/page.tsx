import { notFound } from "next/navigation";
import { ProductCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/server";
import { deliveryPromise, emirateLabel } from "@/lib/format";
import type { Product, Store } from "@/lib/types";

function toMinutes(value: string | null) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isStoreOpenNow(opensAt: string | null, closesAt: string | null) {
  const open = toMinutes(opensAt);
  const close = toMinutes(closesAt);
  if (open == null || close == null) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= open && nowMinutes <= close;
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!store) notFound();
  const s = store as Store;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", s.id)
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  const list = (products ?? []) as Product[];
  const openNow = isStoreOpenNow(s.opens_at, s.closes_at);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10 overflow-hidden rounded-[2rem] border border-line bg-surface">
        <div
          className="h-48 bg-sand bg-cover bg-center sm:h-64"
          style={{
            backgroundImage: s.cover_url
              ? `url(${s.cover_url})`
              : "linear-gradient(135deg, #f3e4dc, #ffd9e4)",
          }}
        />
        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fff0f4] px-3 py-1 text-xs font-medium text-accent-deep">
              {deliveryPromise(s.delivery_eta_minutes)}
            </span>
            <span className="rounded-full border border-line bg-white/75 px-3 py-1 text-xs text-muted">
              {s.area}, {emirateLabel(s.emirate)}
            </span>
            {openNow !== null ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  openNow
                    ? "bg-[#eaf6f1] text-[#2f6f66]"
                    : "bg-[#f4f2f2] text-muted"
                }`}
              >
                {openNow ? "Open now" : "Closed now"}
              </span>
            ) : null}
          </div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">{s.name}</h1>
          <p className="text-muted">{s.address}</p>
          {s.description ? <p className="max-w-2xl text-ink/85">{s.description}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Delivery and location
              </p>
              <p className="mt-2 text-sm text-ink">
                Delivery in about {s.delivery_eta_minutes} minutes to nearby areas.
              </p>
              <p className="mt-1.5 text-sm text-muted">
                Based in {s.area}, {emirateLabel(s.emirate)}.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Store hours
              </p>
              <p className="mt-2 text-sm text-ink">
                {s.opens_at && s.closes_at
                  ? `${s.opens_at.slice(0, 5)} - ${s.closes_at.slice(0, 5)}`
                  : "Hours not set"}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                {openNow === null
                  ? "Ask the store for live availability."
                  : openNow
                    ? "Ordering now usually gets fastest dispatch."
                    : "You can still browse and order when they reopen."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-line bg-white/70 px-3 py-1 text-xs text-ink">
              Verified local boutique
            </span>
            <span className="rounded-full border border-line bg-white/70 px-3 py-1 text-xs text-ink">
              Secure checkout
            </span>
            <span className="rounded-full border border-line bg-white/70 px-3 py-1 text-xs text-ink">
              Fast local dispatch
            </span>
          </div>
          <a
            href="#offerings"
            className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-white transition hover:bg-accent-deep"
          >
            Shop from this store
          </a>
        </div>
      </div>

      <div id="offerings" className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">Offerings</h2>
          <p className="mt-1 text-sm text-muted">
            Handpicked pieces from {s.name}, with shopper ratings.
          </p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-muted">No products available right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {list.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              href={`/stores/${s.slug}/products/${product.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
