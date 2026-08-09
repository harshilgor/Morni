"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { formatAed } from "@/lib/format";
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

type RelatedProduct = Product & {
  stores: { slug: string; name: string };
};

function RelatedProductCard({
  product,
  storeSlug,
}: {
  product: Product;
  storeSlug: string;
}) {
  const image = product.image_urls?.[0];

  return (
    <Link
      href={`/stores/${storeSlug}/products/${product.id}`}
      className="group relative block transition duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="absolute right-2.5 top-2.5">
          <WishlistToggle productId={product.id} size="sm" />
        </div>
      </div>
      <div className="pt-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink">
          {product.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-ink">
          <span>{formatAed(product.price_aed)}</span>
          {product.compare_at_price_aed ? (
            <span className="text-xs font-normal text-muted line-through">
              {formatAed(product.compare_at_price_aed)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

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
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
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
    let active = true;
    (async () => {
      const [{ data: storeData }, { data: productData }] = await Promise.all([
        supabase
          .from("stores")
          .select("*")
          .eq("slug", params.slug)
          .maybeSingle(),
        supabase
          .from("storefront_products")
          .select("*, product_variants(*)")
          .eq("id", params.productId)
          .maybeSingle(),
      ]);

      if (!active) return;
      if (!storeData || !productData || productData.store_id !== storeData.id) {
        setStore(null);
        setProduct(null);
        return;
      }

      setStore(storeData as Store);
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

      // Campaigns, reviews, and related items should not hold the core product
      // screen behind a client-side waterfall.
      const campaignRequest = supabase.rpc("active_store_campaign", {
        p_store_id: row.store_id,
      });
      const relatedRequest = supabase
        .from("storefront_products")
        .select("*, stores!inner(slug, name, is_active)")
        .eq("is_available", true)
        .eq("stores.is_active", true)
        .neq("id", row.id)
        .limit(24);

      void campaignRequest.then(({ data: campaignRows }) => {
        if (active) {
          setCampaign(((campaignRows ?? []) as StoreCampaign[])[0] ?? null);
        }
      });
      void relatedRequest.then(({ data: relatedRows }) => {
        if (!active) return;
        const related = (relatedRows as RelatedProduct[] | null) ?? [];
        setRelatedProducts(
          [...related]
            .sort(
              (a, b) =>
                Number(b.category_id === row.category_id) -
                  Number(a.category_id === row.category_id) ||
                Number(b.store_id === row.store_id) - Number(a.store_id === row.store_id),
            )
            .slice(0, 5),
        );
      });
      void loadReviews(row.id);
    })();

    return () => {
      active = false;
    };
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
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="flex flex-col gap-3 lg:flex-row">
          {gallery.length > 1 ? (
            <div className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[46rem] lg:w-20 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
              {gallery.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`View image ${index + 1}`}
                  aria-pressed={activeImage === index}
                  className={`h-24 w-[4.75rem] shrink-0 overflow-hidden border transition lg:h-28 lg:w-full ${
                    activeImage === index
                      ? "border-ink opacity-100"
                      : "border-line opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="order-1 aspect-[4/5] w-full overflow-hidden bg-sand lg:order-2">
            {gallery[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gallery[activeImage]}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-5">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
            {store.name}
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
                          : "border-[#706a66] bg-surface text-ink hover:border-ink"
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
                <span className="border-b border-ink pb-0.5 text-xs text-ink">Size guide</span>
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
                    className={`min-w-12 border px-4 py-2.5 text-sm font-medium transition ${
                      selectedSize === size
                        ? "border-ink bg-ink text-white"
                        : "border-[#706a66] bg-surface text-ink hover:border-ink"
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

      {relatedProducts.length > 0 ? (
        <section className="mt-16 border-t border-line pt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
                Curated for you
              </p>
              <h2 className="mt-1 font-display text-3xl text-ink">You may also like</h2>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/stores/${store.slug}`)}
              className="border-b border-ink pb-0.5 text-sm font-medium text-ink"
            >
              View boutique
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {relatedProducts.map((relatedProduct) => (
              <RelatedProductCard
                key={relatedProduct.id}
                product={relatedProduct}
                storeSlug={relatedProduct.stores.slug}
              />
            ))}
          </div>
        </section>
      ) : null}
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
