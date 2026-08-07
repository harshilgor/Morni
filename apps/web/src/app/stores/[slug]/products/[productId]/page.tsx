"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { deliveryPromise, formatAed } from "@/lib/format";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import type { Product, ProductReview, ProductVariant, Store } from "@/lib/types";
import { WishlistToggle } from "@/components/wishlist-toggle";
import { ProductReviewsSection } from "@/components/product-reviews-section";
import { formatRatingLabel } from "@/lib/product-ratings";
import { StarRating } from "@/components/star-rating";

type StoreCampaign = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export default function ProductPage() {
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const addRecentlyViewed = useRecentlyViewed((s) => s.add);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [campaign, setCampaign] = useState<StoreCampaign | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [existingReview, setExistingReview] = useState<ProductReview | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  async function loadReviews(productId: string) {
    const supabase = createClient();
    const { data: reviewRows } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setReviews((reviewRows as ProductReview[]) ?? []);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setExistingReview(null);
      setReviewOrderId(null);
      return;
    }

    const { data: ownReview } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("shopper_id", user.id)
      .maybeSingle();
    setExistingReview((ownReview as ProductReview | null) ?? null);

    if (ownReview) {
      setReviewOrderId((ownReview as ProductReview).order_id);
      return;
    }

    const { data: eligibleOrders } = await supabase
      .from("orders")
      .select("id, order_items!inner(product_id)")
      .eq("shopper_id", user.id)
      .eq("status", "delivered")
      .eq("order_items.product_id", productId)
      .order("placed_at", { ascending: false })
      .limit(1);
    const first = (eligibleOrders as { id: string }[] | null)?.[0];
    setReviewOrderId(first?.id ?? null);
  }

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
      const { data: campaignRows } = await supabase.rpc("active_store_campaign", {
        p_store_id: storeData.id,
      });
      setCampaign(((campaignRows ?? []) as StoreCampaign[])[0] ?? null);
      const { data: productData } = await supabase
        .from("storefront_products")
        .select("*, product_variants(*)")
        .eq("id", params.productId)
        .eq("store_id", storeData.id)
        .maybeSingle();
      if (!productData) {
        setProduct(null);
        return;
      }
      const row = productData as Product & {
        product_variants?: ProductVariant[] | null;
      };
      const nextVariants = [...(row.product_variants ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      setProduct(row);
      setVariants(nextVariants);
      setSelectedVariantId(nextVariants[0]?.id ?? null);
      setSelectedSize(null);
      setActiveImage(0);
      await loadReviews(row.id);
    })();
  }, [params.slug, params.productId]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const gallery = useMemo(() => {
    if (selectedVariant?.image_urls?.length) return selectedVariant.image_urls;
    return product?.image_urls ?? [];
  }, [product, selectedVariant]);

  const availableSizes = useMemo(() => {
    if (selectedVariant?.sizes?.length) return selectedVariant.sizes;
    return product?.sizes ?? [];
  }, [product, selectedVariant]);

  const availableStock = selectedVariant?.stock ?? product?.stock ?? 0;

  const ratingSummary = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return {
      avgRating: Number((sum / reviews.length).toFixed(1)),
      reviewCount: reviews.length,
    };
  }, [reviews]);


  useEffect(() => {
    if (!product || !store) return;
    addRecentlyViewed({
      id: product.id,
      title: product.title,
      price_aed: Number(product.price_aed),
      compare_at_price_aed: product.compare_at_price_aed,
      image_url: gallery[0] ?? product.image_urls?.[0] ?? null,
      href: `/stores/${store.slug}/products/${product.id}`,
      storeName: store.name,
    });
  }, [product, store, gallery, addRecentlyViewed]);

  function selectVariant(variant: ProductVariant) {
    setSelectedVariantId(variant.id);
    setSelectedSize((current) =>
      current && variant.sizes.includes(current) ? current : null,
    );
    setActiveImage(0);
    setAdded(false);
  }

  if (!product || !store) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-muted sm:px-6">
        Loading…
      </div>
    );
  }

  const needsColor = variants.length > 0;
  const needsSize = availableSizes.length > 0;
  const canAdd =
    availableStock > 0 &&
    (!needsColor || Boolean(selectedVariant)) &&
    (!needsSize || Boolean(selectedSize));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-[4/5] overflow-hidden rounded-[2rem] bg-sand">
            {gallery[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gallery[activeImage]}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl border ${
                    activeImage === index ? "border-ink" : "border-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-center space-y-5">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
            {store.name} · {deliveryPromise(store.delivery_eta_minutes)}
          </p>
          {campaign ? (
            <div className="border border-accent-deep/20 bg-[#fff4f6] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">Store campaign</p>
              <p className="mt-1 font-medium text-ink">{campaign.title}</p>
              {campaign.description ? <p className="mt-1 text-sm text-muted">{campaign.description}</p> : null}
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-4xl text-ink sm:text-5xl">
              {product.title}
            </h1>
            <div className="pt-2">
              <WishlistToggle productId={product.id} />
            </div>
          </div>

          {ratingSummary ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fff7e8] px-3 py-1 font-medium text-[#8a6418]">
                <StarRating value={ratingSummary.avgRating} />
                {formatRatingLabel(ratingSummary.avgRating)} · {ratingSummary.reviewCount}{" "}
                {ratingSummary.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          ) : null}

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

          {variants.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink">
                Color
                {selectedVariant ? (
                  <span className="ml-2 text-muted">
                    · {selectedVariant.color_name}
                  </span>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const selected = selectedVariantId === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => selectVariant(variant)}
                      disabled={variant.stock <= 0}
                      aria-pressed={selected}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                        selected
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-surface text-ink hover:border-ink/40"
                      } ${variant.stock <= 0 ? "opacity-40" : ""}`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/40"
                        style={{ background: variant.color_hex ?? "#c45b7a" }}
                      />
                      {variant.color_name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {availableSizes.length > 0 ? (
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
                {availableSizes.map((size) => (
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
            {availableStock > 0
              ? `${availableStock} in stock${
                  selectedVariant ? ` · ${selectedVariant.color_name}` : ""
                }`
              : "Out of stock"}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                addItem(product, store.name, 1, {
                  size: selectedSize ?? undefined,
                  variantId: selectedVariant?.id,
                  colorName: selectedVariant?.color_name,
                  imageUrl: gallery[0],
                });
                setAdded(true);
              }}
              className="rounded-full bg-ink px-6 py-3 text-sm text-white transition hover:bg-accent-deep disabled:opacity-40"
            >
              {added
                ? `Added${selectedVariant ? ` · ${selectedVariant.color_name}` : ""}${
                    selectedSize ? ` · ${selectedSize}` : ""
                  }`
                : needsColor && !selectedVariant
                  ? "Select a color"
                  : needsSize && !selectedSize
                    ? "Select a size"
                    : "Add to cart"}
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

      <ProductReviewsSection
        reviews={reviews}
        avgRating={ratingSummary?.avgRating ?? null}
        reviewCount={ratingSummary?.reviewCount ?? 0}
        existingReview={existingReview}
        canReview={
          !existingReview && reviewOrderId
            ? {
                productId: product.id,
                orderId: reviewOrderId,
              }
            : null
        }
        onReviewSaved={() => loadReviews(product.id)}
      />
    </div>
  );
}
