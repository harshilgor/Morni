import { notFound } from "next/navigation";
import { ProductCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/server";
import { deliveryPromise, emirateLabel } from "@/lib/format";
import type { Product, Store } from "@/lib/types";

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
        <div className="space-y-3 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
            {deliveryPromise(s.delivery_eta_minutes)}
          </p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">{s.name}</h1>
          <p className="text-muted">
            {s.area}, {emirateLabel(s.emirate)} · {s.address}
          </p>
          {s.description ? <p className="max-w-2xl text-ink/85">{s.description}</p> : null}
          {s.lat != null && s.lng != null ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line">
              <iframe
                title={`${s.name} location`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${s.lng - 0.012}%2C${s.lat - 0.008}%2C${s.lng + 0.012}%2C${s.lat + 0.008}&layer=mapnik&marker=${s.lat}%2C${s.lng}`}
                className="h-48 w-full border-0 sm:h-56"
                loading="lazy"
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`}
                target="_blank"
                rel="noreferrer"
                className="block border-t border-line bg-background px-4 py-2 text-xs text-accent-deep hover:underline"
              >
                Open exact location on map
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <h2 className="mb-6 font-display text-2xl text-ink">Offerings</h2>
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
