"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/cards";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";

type WishlistProduct = Product & {
  storeSlug: string;
  storeName: string;
};

export default function WishlistPage() {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }

      const { data: savedRows } = await supabase
        .from("wishlist_items")
        .select("product_id, created_at")
        .eq("shopper_id", user.id)
        .order("created_at", { ascending: false });

      const ids = (savedRows ?? []).map((row) => row.product_id);
      if (ids.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data: productRows } = await supabase
        .from("storefront_products")
        .select("*, stores!inner(slug, name, is_active)")
        .in("id", ids)
        .eq("is_available", true)
        .eq("stores.is_active", true);

      if (!active) return;

      const rows = (productRows ?? []) as unknown as (Product & {
        stores:
          | { slug: string; name: string }
          | { slug: string; name: string }[];
      })[];
      const byId = new Map(rows.map((row) => [row.id, row]));

      setProducts(
        ids.flatMap((id) => {
          const row = byId.get(id);
          if (!row) return [];
          const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
          if (!store) return [];
          return [
            {
              ...row,
              storeSlug: store.slug,
              storeName: store.name,
            },
          ];
        }),
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 text-muted sm:px-6">
        Loading your wishlist…
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f4] text-2xl text-accent-deep">
          ♥
        </span>
        <h1 className="mt-5 font-display text-4xl text-ink">Your wishlist</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in to save clothes you love and view them from any device.
        </p>
        <Link
          href="/auth?next=/wishlist"
          className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
        >
          Sign in to view wishlist
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Saved for later
          </p>
          <h1 className="mt-2 font-display text-4xl text-ink">Your wishlist</h1>
          <p className="mt-2 text-sm text-muted">
            {products.length === 0
              ? "Keep the looks you love in one place."
              : `${products.length} ${products.length === 1 ? "item" : "items"} saved.`}
          </p>
        </div>
        {products.length > 0 ? (
          <Link
            href="/"
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-white"
          >
            Continue shopping
          </Link>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-[2rem] border border-dashed border-line bg-surface/70 px-6 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f4] text-2xl text-accent-deep">
            ♡
          </span>
          <h2 className="mt-5 font-display text-2xl text-ink">
            Nothing saved yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Tap the heart on any product to save it here for later.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
          >
            Discover clothes
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              href={`/stores/${product.storeSlug}/products/${product.id}`}
              onWishlistChange={(isWished) => {
                if (!isWished) {
                  setProducts((current) =>
                    current.filter((item) => item.id !== product.id),
                  );
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
