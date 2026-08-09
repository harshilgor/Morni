import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ProductBrowser,
  type BrowsableProduct,
} from "@/components/product-browser";
import { createClient } from "@/lib/supabase/server";
import { emirateLabel } from "@/lib/format";
import { fetchProductRatingMap } from "@/lib/product-ratings";
import type { Product, Store } from "@/lib/types";

type StoreProduct = Product & {
  created_at?: string | null;
  categories: { name: string; slug: string } | null;
};

type StoreCampaign = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

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

  const [{ data: products }, { data: browseCategories }, { data: campaigns }] = await Promise.all([
    supabase
      .from("storefront_products")
      .select("*, categories(name, slug)")
      .eq("store_id", s.id)
      .eq("is_available", true)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("browse_categories")
      .select("name, slug, search_terms")
      .neq("slug", "more")
      .order("sort_order"),
    supabase.rpc("active_store_campaign", { p_store_id: s.id }),
  ]);

  const list = (products ?? []) as StoreProduct[];
  const catalog = (browseCategories ?? []) as {
    name: string;
    slug: string;
    search_terms: string[] | null;
  }[];
  const activeCampaign = ((campaigns ?? []) as StoreCampaign[])[0] ?? null;

  // Owners can't tag products with a category in the portal yet, so fall back to
  // matching the catalog's search terms against the title.
  function categoryFor(product: StoreProduct) {
    if (product.categories) return product.categories;
    const text = `${product.title} ${product.description ?? ""}`.toLowerCase();
    const hit = catalog.find((category) =>
      (category.search_terms ?? []).some((term) =>
        text.includes(term.toLowerCase()),
      ),
    );
    return hit ? { name: hit.name, slug: hit.slug } : null;
  }
  const openNow = isStoreOpenNow(s.opens_at, s.closes_at);
  const hours =
    s.opens_at && s.closes_at
      ? `${s.opens_at.slice(0, 5)} – ${s.closes_at.slice(0, 5)}`
      : "Hours not set";

  const browsable: BrowsableProduct[] = list.map((product) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    price_aed: Number(product.price_aed),
    compare_at_price_aed: product.compare_at_price_aed,
    image_urls: product.image_urls,
    sizes: product.sizes,
    stock: product.stock,
    created_at: product.created_at ?? null,
    category: categoryFor(product),
    stores: {
      slug: s.slug,
      name: s.name,
      emirate: s.emirate,
      area: s.area,
      delivery_eta_minutes: s.delivery_eta_minutes,
    },
  }));
  const ratingMap = await fetchProductRatingMap(
    supabase,
    browsable.map((product) => product.id),
  );
  const ratings = Object.fromEntries(ratingMap);

  const facts = [
    { label: "Today's hours", value: hours },
    { label: "Located in", value: `${s.area}, ${emirateLabel(s.emirate)}` },
    { label: "Pieces in stock", value: `${list.length} listed` },
  ];

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/?emirate=${s.emirate}`} className="hover:text-ink">
          {emirateLabel(s.emirate)} stores
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{s.name}</span>
      </nav>

      <section className="relative mt-3 overflow-hidden rounded-[1.75rem] border border-line">
        <div
          className="h-44 bg-sand bg-cover bg-center sm:h-60"
          style={{
            backgroundImage: s.cover_url
              ? `url(${s.cover_url})`
              : "linear-gradient(135deg, #f3e4dc, #ffd9e4)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/35 to-transparent sm:h-60" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
          <div className="flex items-end gap-4">
            {s.logo_url ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-white/80 bg-white sm:h-20 sm:w-20 sm:rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.logo_url}
                  alt={`${s.name} logo`}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div>
              {openNow !== null ? (
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    openNow
                      ? "bg-[#eaf6f1] text-[#2f6f66]"
                      : "bg-white/80 text-muted"
                  }`}
                >
                  {openNow ? "Open now" : "Closed now"}
                </span>
              ) : null}
              <h1 className="mt-2 font-display text-3xl text-white sm:text-5xl">
                {s.name}
              </h1>
              <p className="mt-1 text-sm text-white/85">
                {s.area}, {emirateLabel(s.emirate)} · {s.address}
              </p>
            </div>
          </div>
        </div>
      </section>

      {activeCampaign ? (
        <section className="mt-5 border border-accent-deep/20 bg-[#fff4f6] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">From {s.name}</p>
          <h2 className="mt-1 font-display text-2xl text-ink">{activeCampaign.title}</h2>
          {activeCampaign.description ? <p className="mt-1 text-sm text-muted">{activeCampaign.description}</p> : null}
        </section>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="rounded-2xl border border-line bg-surface/70 px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
              {fact.label}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{fact.value}</p>
          </div>
        ))}
      </div>

      {s.description ? (
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink/85">
          {s.description}
        </p>
      ) : null}

      <div
        id="shop"
        className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5"
      >
        <div>
          <h2 className="font-display text-2xl text-ink">Shop {s.name}</h2>
          <p className="mt-1 text-sm text-muted">
            Filter by category, size, colour, and price to find your piece.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          <span className="rounded-full border border-line bg-white/70 px-3 py-1">
            Verified local boutique
          </span>
          <span className="rounded-full border border-line bg-white/70 px-3 py-1">
            Secure checkout
          </span>
        </div>
      </div>

      <div className="mt-6">
        {browsable.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
            <p className="text-muted">
              {s.name} has no products listed right now. Check back soon.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-accent-deep underline"
            >
              Browse other stores
            </Link>
          </div>
        ) : (
          <ProductBrowser products={browsable} ratings={ratings} />
        )}
      </div>
      </div>
    </div>
  );
}
