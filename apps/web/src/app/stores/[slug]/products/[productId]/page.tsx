"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { deliveryPromise, formatAed } from "@/lib/format";
import type { Product, Store } from "@/lib/types";

export default function ProductPage() {
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", params.slug)
        .maybeSingle();
      if (!storeData) return;
      setStore(storeData as Store);
      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("id", params.productId)
        .eq("store_id", storeData.id)
        .maybeSingle();
      setProduct((productData as Product) ?? null);
    })();
  }, [params.slug, params.productId]);

  if (!product || !store) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-muted sm:px-6">
        Loading…
      </div>
    );
  }

  const image = product.image_urls?.[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="aspect-[4/5] overflow-hidden rounded-[2rem] bg-sand">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-col justify-center space-y-5">
        <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
          {store.name} · {deliveryPromise(store.delivery_eta_minutes)}
        </p>
        <h1 className="font-display text-4xl text-ink sm:text-5xl">{product.title}</h1>
        <div className="flex items-center gap-3 text-lg">
          <span>{formatAed(product.price_aed)}</span>
          {product.compare_at_price_aed ? (
            <span className="text-muted line-through">
              {formatAed(product.compare_at_price_aed)}
            </span>
          ) : null}
        </div>
        {product.description ? (
          <p className="max-w-md text-muted">{product.description}</p>
        ) : null}
        <p className="text-sm text-mint">
          {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={() => {
              addItem(product, store.name);
              setAdded(true);
            }}
            className="rounded-full bg-ink px-6 py-3 text-sm text-white transition hover:bg-accent-deep disabled:opacity-40"
          >
            {added ? "Added to cart" : "Add to cart"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="rounded-full border border-line bg-surface px-6 py-3 text-sm"
          >
            View cart
          </button>
        </div>
      </div>
    </div>
  );
}
