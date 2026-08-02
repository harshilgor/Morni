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
