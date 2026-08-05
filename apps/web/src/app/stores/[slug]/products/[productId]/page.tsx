"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { deliveryPromise, formatAed } from "@/lib/format";
import { getProductSocialProof } from "@/lib/product-social";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import type { Product, Store } from "@/lib/types";
import { WishlistToggle } from "@/components/wishlist-toggle";

export default function ProductPage() {
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const addRecentlyViewed = useRecentlyViewed((s) => s.add);
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
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

  useEffect(() => {
    if (!product || !store) return;
    addRecentlyViewed({
      id: product.id,
      title: product.title,
      price_aed: Number(product.price_aed),
      compare_at_price_aed: product.compare_at_price_aed,
      image_url: product.image_urls?.[0] ?? null,
      href: `/stores/${store.slug}/products/${product.id}`,
      storeName: store.name,
    });
  }, [product, store, addRecentlyViewed]);

  if (!product || !store) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-muted sm:px-6">
        Loading…
      </div>
    );
  }

  const image = product.image_urls?.[0];
  const social = getProductSocialProof(`${product.id}-${product.title}`);
  const sampleReviews = [
    {
      name: "Aisha",
      text: "Fabric quality was better than expected and arrived the same hour.",
    },
    {
      name: "Meera",
      text: "True to photos — sizing felt right and packaging was neat.",
    },
    {
      name: "Sara",
      text: "Would order again from this boutique. Fast local delivery helped.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-[4/5] overflow-hidden rounded-[2rem] bg-sand">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col justify-center space-y-5">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
            {store.name} · {deliveryPromise(store.delivery_eta_minutes)}
          </p>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-4xl text-ink sm:text-5xl">
              {product.title}
            </h1>
            <div className="pt-2">
              <WishlistToggle productId={product.id} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-[#fff7e8] px-3 py-1 font-medium text-[#8a6418]">
              {social.ratingLabel} ★ · {social.reviews} reviews
            </span>
            <span className="text-muted">
              Bought {social.boughtToday} times today
            </span>
          </div>

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
          {product.sizes?.length > 0 ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">
                  Select size
                  {selectedSize ? (
                    <span className="ml-2 text-muted">· {selectedSize}</span>
                  ) : null}
                </p>
                <span className="text-xs text-muted">Available sizes</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setSelectedSize(size);
                      setAdded(false);
                    }}
                    aria-pressed={selectedSize === size}
                    className={`min-w-12 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      selectedSize === size
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-surface text-ink hover:border-ink/40"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {!selectedSize ? (
                <p className="mt-2 text-xs text-accent-deep">
                  Choose a size before adding this item to your cart.
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-mint">
            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={
                product.stock <= 0 ||
                (product.sizes?.length > 0 && !selectedSize)
              }
              onClick={() => {
                addItem(product, store.name, 1, selectedSize ?? undefined);
                setAdded(true);
              }}
              className="rounded-full bg-ink px-6 py-3 text-sm text-white transition hover:bg-accent-deep disabled:opacity-40"
            >
              {added
                ? `Added${selectedSize ? ` · ${selectedSize}` : ""}`
                : selectedSize
                  ? `Add size ${selectedSize} to cart`
                  : "Select a size"}
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

      <section className="mt-12 rounded-[1.6rem] border border-line bg-white/70 p-6 sm:p-8">
        <h2 className="font-display text-2xl text-ink">What shoppers say</h2>
        <p className="mt-1 text-sm text-muted">
          Sample reviews while we roll out verified ratings.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {sampleReviews.map((review) => (
            <div
              key={review.name}
              className="rounded-2xl border border-line bg-surface/80 p-4"
            >
              <p className="text-sm font-semibold text-ink">{review.name}</p>
              <p className="mt-1 text-xs text-[#8a6418]">
                {social.ratingLabel} ★
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {review.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
