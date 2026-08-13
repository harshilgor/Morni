"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { SizeGuide } from "@/components/size-guide";

type StoreCampaign = {
  id: string;
  title: string;
  description: string | null;
};

type RelatedProduct = Product & {
  stores: { slug: string; name: string };
};

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProductAccordion({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-15 w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold uppercase tracking-[0.1em] text-ink"
      >
        {title}
        <Chevron open={open} />
      </button>
      {open ? <div className="-mt-1 pb-5 text-sm leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}

function RelatedProductCard({ product }: { product: RelatedProduct }) {
  const image = product.image_urls?.[0];
  return (
    <Link
      href={`/stores/${product.stores.slug}/products/${product.id}`}
      className="group block min-w-0"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f4f1ed]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
        ) : null}
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-ink">{product.title}</p>
      <p className="mt-1 text-sm text-ink">{formatAed(product.price_aed)}</p>
    </Link>
  );
}

export default function ProductPage() {
  const params = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const addItem = useCart((state) => state.addItem);
  const addRecentlyViewed = useRecentlyViewed((state) => state.add);
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
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [returnsOpen, setReturnsOpen] = useState(false);

  async function loadReviews(productId: string) {
    const supabase = createClient();
    const { data: reviewRows } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setReviews((reviewRows as ProductReview[]) ?? []);

    const { data: { user } } = await supabase.auth.getUser();
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
    setReviewOrderId((eligibleOrders as { id: string }[] | null)?.[0]?.id ?? null);
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const [{ data: storeData }, { data: productData }] = await Promise.all([
        supabase.from("stores").select("*").eq("slug", params.slug).maybeSingle(),
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

      const row = productData as Product & { product_variants?: ProductVariant[] | null };
      const nextVariants = [...(row.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      setStore(storeData as Store);
      setProduct(row);
      setVariants(nextVariants);
      setSelectedVariantId(nextVariants[0]?.id ?? null);
      setSelectedSize(null);
      setActiveImage(0);
      setAdded(false);

      void supabase.rpc("active_store_campaign", { p_store_id: row.store_id }).then(({ data }) => {
        if (active) setCampaign(((data ?? []) as StoreCampaign[])[0] ?? null);
      });
      void supabase
        .from("storefront_products")
        .select("*, stores!inner(slug, name, is_active)")
        .eq("is_available", true)
        .eq("stores.is_active", true)
        .neq("id", row.id)
        .limit(24)
        .then(({ data }) => {
          if (!active) return;
          const related = (data as RelatedProduct[] | null) ?? [];
          setRelatedProducts(
            [...related]
              .sort((a, b) => Number(b.category_id === row.category_id) - Number(a.category_id === row.category_id) || Number(b.store_id === row.store_id) - Number(a.store_id === row.store_id))
              .slice(0, 4),
          );
        });
      void loadReviews(row.id);
    })();
    return () => { active = false; };
  }, [params.productId, params.slug]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );
  const gallery = useMemo(
    () => selectedVariant?.image_urls?.length ? selectedVariant.image_urls : product?.image_urls ?? [],
    [product, selectedVariant],
  );
  const availableSizes = useMemo(
    () => selectedVariant?.sizes?.length ? selectedVariant.sizes : product?.sizes ?? [],
    [product, selectedVariant],
  );
  const availableStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const ratingSummary = useMemo(() => {
    if (!reviews.length) return null;
    return { avgRating: Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)), reviewCount: reviews.length };
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
  }, [addRecentlyViewed, gallery, product, store]);

  function selectVariant(variant: ProductVariant) {
    setSelectedVariantId(variant.id);
    setSelectedSize((size) => size && variant.sizes.includes(size) ? size : null);
    setActiveImage(0);
    setAdded(false);
  }

  if (!product || !store) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-sm text-muted sm:px-6">Loading product…</div>;
  }

  const needsColor = variants.length > 0;
  const needsSize = availableSizes.length > 0;
  const canAdd = availableStock > 0 && (!needsColor || Boolean(selectedVariant)) && (!needsSize || Boolean(selectedSize));
  const addToBag = () => {
    if (!canAdd) return;
    addItem(product, store.name, 1, {
      size: selectedSize ?? undefined,
      variantId: selectedVariant?.id,
      colorName: selectedVariant?.color_name,
      imageUrl: gallery[0],
    });
    setAdded(true);
  };
  const addLabel = added ? "Added to bag" : needsSize && !selectedSize ? "Select a size" : availableStock <= 0 ? "Out of stock" : "Add to bag";

  return (
    <main className="mx-auto max-w-[88rem] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-16">
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink transition hover:text-accent-deep">
          <ArrowLeft />
          <span>Back</span>
        </button>
        <Link href={`/stores/${store.slug}`} className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep hover:underline">
          {store.name}
        </Link>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.16fr)_minmax(22rem,0.72fr)] lg:gap-12 xl:gap-16">
        <section className="min-w-0">
          <div className="flex gap-3 lg:gap-4">
            {gallery.length > 1 ? (
              <div className="hidden w-[4.7rem] shrink-0 space-y-2 lg:block">
                {gallery.map((url, index) => (
                  <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`} aria-pressed={activeImage === index} className={`aspect-[4/5] w-full overflow-hidden rounded-lg border bg-[#f4f1ed] transition ${activeImage === index ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-[#f4f2ef] sm:rounded-2xl">
              <div className="aspect-[4/5] w-full">
                {gallery[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gallery[activeImage]} alt={product.title} className="h-full w-full object-contain" />
                ) : null}
              </div>
              <div className="absolute right-3 top-3 z-10 lg:hidden"><WishlistToggle productId={product.id} /></div>
              {gallery.length > 1 ? (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-ink/30 px-2.5 py-2 backdrop-blur">
                  {gallery.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`} className={`h-1.5 rounded-full transition ${activeImage === index ? "w-5 bg-white" : "w-1.5 bg-white/65"}`} />)}
                </div>
              ) : null}
            </div>
          </div>
          {gallery.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
              {gallery.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-pressed={activeImage === index} className={`h-16 w-12 shrink-0 overflow-hidden rounded-md border bg-[#f4f1ed] ${activeImage === index ? "border-ink" : "border-transparent opacity-60"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>)}
            </div>
          ) : null}
        </section>

        <section className="min-w-0 lg:sticky lg:top-24">
          <div className="hidden justify-end lg:flex"><WishlistToggle productId={product.id} /></div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">{store.name}</p>
          <h1 className="mt-3 font-display text-[2.45rem] leading-[0.97] text-ink sm:text-5xl">{product.title}</h1>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="flex items-baseline gap-2.5"><span className="text-xl font-semibold text-ink">{formatAed(product.price_aed)}</span>{product.compare_at_price_aed ? <span className="text-sm text-muted line-through">{formatAed(product.compare_at_price_aed)}</span> : null}</div>
            {ratingSummary ? <span className="inline-flex items-center gap-1.5 text-sm text-ink"><StarRating value={ratingSummary.avgRating} /><span className="font-medium">{formatRatingLabel(ratingSummary.avgRating)}</span><span className="text-muted">({ratingSummary.reviewCount})</span></span> : null}
          </div>
          {campaign ? <div className="mt-5 rounded-xl border border-accent/20 bg-[#fff4f6] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-deep">Boutique offer</p><p className="mt-1 text-sm font-medium text-ink">{campaign.title}</p>{campaign.description ? <p className="mt-1 text-sm text-muted">{campaign.description}</p> : null}</div> : null}

          <div className="mt-7 space-y-6">
            {variants.length ? <div><p className="text-sm font-semibold text-ink">Colour {selectedVariant ? <span className="font-normal text-muted">— {selectedVariant.color_name}</span> : null}</p><div className="mt-3 flex flex-wrap gap-2.5">{variants.map((variant) => { const selected = selectedVariantId === variant.id; return <button key={variant.id} type="button" onClick={() => selectVariant(variant)} disabled={variant.stock <= 0} aria-pressed={selected} className={`flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm transition ${selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/45"} disabled:cursor-not-allowed disabled:opacity-35`}><span className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ background: variant.color_hex ?? "#c45b7a" }} />{variant.color_name}</button>; })}</div></div> : null}
            {availableSizes.length ? <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">Size {selectedSize ? <span className="font-normal text-muted">— {selectedSize}</span> : null}</p><SizeGuide /></div><div className="mt-3 grid grid-cols-4 gap-2">{availableSizes.map((size) => <button key={size} type="button" onClick={() => { setSelectedSize(size); setAdded(false); }} aria-pressed={selectedSize === size} className={`min-h-12 rounded-lg border text-sm font-semibold transition ${selectedSize === size ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/45"}`}>{size}</button>)}</div>{!selectedSize ? <p className="mt-2 text-xs text-accent-deep">Select a size to add this piece to your bag.</p> : null}</div> : null}
          </div>

          <p className={`mt-5 text-sm ${availableStock > 0 ? "text-[#2d7565]" : "text-accent-deep"}`}>{availableStock > 0 ? `${availableStock} available${selectedVariant ? ` in ${selectedVariant.color_name}` : ""}` : "This piece is currently out of stock"}</p>
          <div className="mt-5 hidden gap-3 sm:flex"><button type="button" onClick={addToBag} disabled={!canAdd} className="min-h-14 flex-1 rounded-lg bg-ink px-5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40">{addLabel}</button><button type="button" onClick={() => router.push("/cart")} className="min-h-14 rounded-lg border border-ink px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-surface">Bag</button></div>

          <div className="mt-7 border-b border-line">
            <ProductAccordion title="Product details" open={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)}><p>{product.description ?? "A thoughtfully selected piece from this local boutique."}</p>{selectedVariant ? <p className="mt-3">Colour: {selectedVariant.color_name}.</p> : null}</ProductAccordion>
            <ProductAccordion title="Delivery" open={deliveryOpen} onToggle={() => setDeliveryOpen((open) => !open)}><p>Delivery is available across Dubai. Your exact delivery estimate is confirmed at checkout once you choose an address.</p></ProductAccordion>
            <ProductAccordion title="Returns" open={returnsOpen} onToggle={() => setReturnsOpen((open) => !open)}><p>Please contact Morni support promptly if there is an issue with your order. Items must be returned unused and in their original condition.</p></ProductAccordion>
          </div>
        </section>
      </div>

      {relatedProducts.length ? <section className="mt-14 border-t border-line pt-10 sm:mt-20"><div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">More to discover</p><h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">You may also like</h2></div><Link href={`/stores/${store.slug}`} className="text-sm font-semibold text-ink underline underline-offset-4">View boutique</Link></div><div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-5">{relatedProducts.map((relatedProduct) => <RelatedProductCard key={relatedProduct.id} product={relatedProduct} />)}</div></section> : null}

      <ProductReviewsSection reviews={reviews} avgRating={ratingSummary?.avgRating ?? null} reviewCount={ratingSummary?.reviewCount ?? 0} existingReview={existingReview} canReview={!existingReview && reviewOrderId ? { productId: product.id, orderId: reviewOrderId } : null} onReviewSaved={() => loadReviews(product.id)} />

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-background/95 px-4 py-3 shadow-[0_-12px_32px_-22px_rgba(28,20,24,0.4)] backdrop-blur sm:hidden"><div className="mx-auto flex max-w-lg gap-3"><WishlistToggle productId={product.id} /><button type="button" disabled={!canAdd} onClick={addToBag} className="min-h-12 flex-1 rounded-lg bg-ink px-4 text-sm font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-40">{addLabel}</button></div></div>
    </main>
  );
}
