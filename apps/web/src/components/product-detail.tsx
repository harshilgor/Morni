"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { formatAed } from "@/lib/format";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import type { Product, ProductReview, ProductVariant, Store } from "@/lib/types";
import { WishlistToggle } from "@/components/wishlist-toggle";
import { AddToBagButton } from "@/components/add-to-bag-button";
import { ProductReviewsSection } from "@/components/product-reviews-section";
import { formatRatingLabel } from "@/lib/product-ratings";
import { StarRating } from "@/components/star-rating";
import { SizeGuide } from "@/components/size-guide";
import { ProductCustomizationFields } from "@/components/product-customization-fields";
import {
  customizationConfigFromProduct,
  sanitizeCustomizationValues,
  validateCustomizationValues,
  type ProductCustomizationValues,
} from "@/lib/product-customization";
import type { RelatedProduct, StoreCampaign } from "@/lib/types";

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CONFETTI_PIECES = [
  { x: -54, y: -50, rotate: -42, color: "#f5c85b" },
  { x: -26, y: -68, rotate: 28, color: "#c45b7a" },
  { x: 8, y: -62, rotate: -24, color: "#2f6f66" },
  { x: 42, y: -48, rotate: 48, color: "#d58b54" },
  { x: 66, y: -15, rotate: -35, color: "#c45b7a" },
  { x: 48, y: 22, rotate: 62, color: "#f5c85b" },
  { x: 7, y: 34, rotate: -58, color: "#2f6f66" },
  { x: -38, y: 22, rotate: 40, color: "#d58b54" },
  { x: -66, y: -5, rotate: -52, color: "#c45b7a" },
] as const;

function AddToBagConfetti({ celebrationKey }: { celebrationKey: number }) {
  if (celebrationKey === 0) return null;

  return (
    <span key={celebrationKey} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {CONFETTI_PIECES.map((piece, index) => (
        <span
          key={`${celebrationKey}-${index}`}
          className="add-to-bag-confetti absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-sm"
          style={{
            "--confetti-x": `${piece.x}px`,
            "--confetti-y": `${piece.y}px`,
            "--confetti-rotate": `${piece.rotate}deg`,
            animationDelay: `${index * 18}ms`,
            backgroundColor: piece.color,
          } as CSSProperties}
        />
      ))}
    </span>
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
        className="flex min-h-15 w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold uppercase tracking-[0.1em] text-ink lg:min-h-12 lg:gap-3 lg:py-3"
      >
        {title}
        <Chevron open={open} />
      </button>
      {open ? <div className="-mt-1 pb-5 text-sm leading-relaxed text-muted lg:pb-4">{children}</div> : null}
    </div>
  );
}

function RelatedProductCard({ product }: { product: RelatedProduct }) {
  const image = product.image_urls?.[0];
  return (
    <Link href={`/stores/${product.stores.slug}/products/${product.id}`} className="group block min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f4f1ed] lg:aspect-[3/4] lg:rounded-lg">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
        ) : null}
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-ink lg:mt-2">{product.title}</p>
      <p className="mt-1 text-sm text-ink">{formatAed(product.price_aed)}</p>
    </Link>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BagSheet({
  mode,
  product,
  store,
  sizes,
  relatedProducts,
  onClose,
  onSizeSelect,
}: {
  mode: "size" | "added";
  product: Product;
  store: Store;
  sizes: string[];
  relatedProducts: RelatedProduct[];
  onClose: () => void;
  onSizeSelect: (size: string) => void;
}) {
  const recommendations = relatedProducts.slice(0, 2);
  const image = product.image_urls?.[0];
  const title = mode === "size" ? "Choose your size" : "Added to your bag";

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="bag-sheet-title" className="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-background shadow-[0_-18px_60px_-24px_rgba(28,20,24,0.65)] sm:max-w-xl sm:rounded-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-background px-5 py-4">
          <span className="h-1.5 w-10 rounded-full bg-ink/20 sm:hidden" aria-hidden="true" />
          <h2 id="bag-sheet-title" className="text-base font-semibold text-ink sm:text-lg">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-surface" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {mode === "size" ? (
          <div className="p-5 sm:p-6">
            <p className="text-sm leading-6 text-muted">Select a size for {product.title} before adding it to your bag.</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {sizes.map((size) => (
                <button key={size} type="button" onClick={() => onSizeSelect(size)} className="min-h-14 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-ink hover:text-white">
                  {size}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-[#f4f1ed]">
                {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{product.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {store.name} · {formatAed(product.price_aed)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href="/cart" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-accent-deep">
                View bag
              </Link>
              <button type="button" onClick={onClose} className="min-h-12 rounded-lg border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/45">
                Keep shopping
              </button>
            </div>
            {recommendations.length ? (
              <section className="mt-8 border-t border-line pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">Complete your edit</p>
                <h3 className="mt-2 font-display text-3xl text-ink">You may also like</h3>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {recommendations.map((relatedProduct) => (
                    <Link key={relatedProduct.id} href={`/stores/${relatedProduct.stores.slug}/products/${relatedProduct.id}`} onClick={onClose} className="min-w-0">
                      <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[#f4f1ed]">
                        {relatedProduct.image_urls?.[0] ? (
                          <img src={relatedProduct.image_urls[0]} alt={relatedProduct.title} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink">{relatedProduct.title}</p>
                      <p className="mt-1 text-sm text-ink">{formatAed(relatedProduct.price_aed)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

export function ProductDetail({
  product,
  store,
  variants,
  campaign,
  relatedProducts,
  initialReviews,
}: {
  product: Product;
  store: Store;
  variants: ProductVariant[];
  campaign: StoreCampaign | null;
  relatedProducts: RelatedProduct[];
  initialReviews: ProductReview[];
}) {
  const router = useRouter();
  const addItem = useCart((state) => state.addItem);
  const addRecentlyViewed = useRecentlyViewed((state) => state.add);
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [existingReview, setExistingReview] = useState<ProductReview | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [customizationSelected, setCustomizationSelected] = useState(false);
  const [customizationValues, setCustomizationValues] = useState<ProductCustomizationValues>({});
  const [customizationError, setCustomizationError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [bagSheet, setBagSheet] = useState<"size" | "added" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [returnsOpen, setReturnsOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [product.id]);

  async function loadReviewEligibility(productId: string) {
    const supabase = createClient();
    const { data: reviewRows } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setReviews((reviewRows as ProductReview[]) ?? initialReviews);

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
    setReviewOrderId((eligibleOrders as { id: string }[] | null)?.[0]?.id ?? null);
  }

  useEffect(() => {
    const resetProductState = () => {
      setReviews(initialReviews);
      setSelectedVariantId(variants[0]?.id ?? null);
      setSelectedSize(null);
      setCustomizationSelected(false);
      setCustomizationValues({});
      setCustomizationError(null);
      setActiveImage(0);
      setAdded(false);
      setBagSheet(null);
      void loadReviewEligibility(product.id);
    };
    if (typeof queueMicrotask === "function") queueMicrotask(resetProductState);
    else window.setTimeout(resetProductState, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, store.id]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants],
  );
  const gallery = useMemo(
    () => (selectedVariant?.image_urls?.length ? selectedVariant.image_urls : product.image_urls ?? []),
    [product, selectedVariant],
  );
  const availableSizes = useMemo(
    () => (selectedVariant?.sizes?.length ? selectedVariant.sizes : product.sizes ?? []),
    [product, selectedVariant],
  );
  const availableStock = selectedVariant?.stock ?? product.stock ?? 0;
  const customizationConfig = useMemo(() => customizationConfigFromProduct(product), [product]);
  const ratingSummary = useMemo(() => {
    if (!reviews.length) return null;
    return {
      avgRating: Number(
        (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1),
      ),
      reviewCount: reviews.length,
    };
  }, [reviews]);

  useEffect(() => {
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
    setSelectedSize((size) => (size && variant.sizes.includes(size) ? size : null));
    setActiveImage(0);
    setAdded(false);
  }

  const needsColor = variants.length > 0;
  const canAdd = availableStock > 0 && (!needsColor || Boolean(selectedVariant));
  const addToBag = (size = selectedSize) => {
    if (!canAdd) return;
    if (availableSizes.length > 0 && !size) {
      setBagSheet("size");
      return;
    }
    const customization = customizationSelected
      ? sanitizeCustomizationValues(customizationValues)
      : {};
    if (customizationSelected && Object.keys(customization).length === 0) {
      setCustomizationError("Add at least one measurement or turn customization off.");
      return;
    }
    const customizationValidation = customizationSelected
      ? validateCustomizationValues(customizationConfig, customization)
      : null;
    if (customizationValidation) {
      setCustomizationError(customizationValidation);
      return;
    }
    addItem(product, store.name, 1, {
      size: size ?? undefined,
      variantId: selectedVariant?.id,
      colorName: selectedVariant?.color_name,
      imageUrl: gallery[0],
      customization: Object.keys(customization).length ? customization : undefined,
    });
    setAdded(true);
    setCelebrationKey((key) => key + 1);
    setBagSheet("added");
  };
  const addLabel = added ? "Added to bag" : availableStock <= 0 ? "Out of stock" : "Add to bag";

  return (
    <main className="mx-auto max-w-[88rem] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-16 lg:pt-5">
      <div className="mb-4 lg:hidden">
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink transition hover:text-accent-deep">
          <ArrowLeft />
          <span>Back</span>
        </button>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[auto_minmax(0,1.02fr)_minmax(19rem,0.62fr)] lg:gap-6 xl:grid-cols-[auto_minmax(0,1.06fr)_minmax(20rem,0.64fr)] xl:gap-8">
        <div className="hidden lg:flex lg:pt-2">
          <button type="button" onClick={() => router.back()} className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm font-medium text-ink transition hover:text-accent-deep">
            <ArrowLeft />
            <span>Back</span>
          </button>
        </div>

        <section className="min-w-0">
          <div className="flex gap-3 lg:gap-4">
            {gallery.length > 1 ? (
              <div className="hidden w-[4.2rem] shrink-0 space-y-2 lg:block">
                {gallery.map((url, index) => (
                  <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`} aria-pressed={activeImage === index} className={`aspect-[4/5] w-full overflow-hidden rounded-lg border bg-[#f4f1ed] transition ${activeImage === index ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-[#f4f2ef] sm:rounded-2xl lg:h-[calc(100vh-8.75rem)] lg:max-h-[46rem] lg:min-h-[34rem]">
              <div className="aspect-[4/5] w-full lg:h-full lg:aspect-auto">
                {gallery[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gallery[activeImage]} alt={product.title} className="h-full w-full object-contain" />
                ) : null}
              </div>
              {gallery.length > 1 ? (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-ink/30 px-2.5 py-2 backdrop-blur">
                  {gallery.map((url, index) => (
                    <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`} className={`h-1.5 rounded-full transition ${activeImage === index ? "w-5 bg-white" : "w-1.5 bg-white/65"}`} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {gallery.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
              {gallery.map((url, index) => (
                <button key={`${url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-pressed={activeImage === index} className={`h-16 w-12 shrink-0 overflow-hidden rounded-md border bg-[#f4f1ed] ${activeImage === index ? "border-ink" : "border-transparent opacity-60"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="min-w-0 lg:sticky lg:top-20">
          <div className="hidden justify-end lg:flex">
            <WishlistToggle productId={product.id} tone="inline" />
          </div>
          <Link href={`/stores/${store.slug}`} className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep underline-offset-4 transition hover:underline" aria-label={`Visit ${store.name} store`}>{store.name}</Link>
          <h1 className="mt-2 font-display text-[2.45rem] leading-[0.97] text-ink sm:text-5xl lg:text-[1.95rem] lg:leading-[1.02] xl:text-[2.15rem]">{product.title}</h1>
          <div className="mt-4 flex items-end justify-between gap-4 lg:mt-3">
            <div className="flex items-baseline gap-2.5">
              <span className="text-xl font-semibold text-ink lg:text-lg">{formatAed(product.price_aed)}</span>
              {product.compare_at_price_aed ? <span className="text-sm text-muted line-through">{formatAed(product.compare_at_price_aed)}</span> : null}
            </div>
            {ratingSummary ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                <StarRating value={ratingSummary.avgRating} />
                <span className="font-medium">{formatRatingLabel(ratingSummary.avgRating)}</span>
                <span className="text-muted">({ratingSummary.reviewCount})</span>
              </span>
            ) : null}
          </div>
          {campaign ? (
            <div className="mt-5 rounded-xl border border-accent/20 bg-[#fff4f6] px-4 py-3 lg:mt-4 lg:px-3 lg:py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-deep">Boutique offer</p>
              <p className="mt-1 text-sm font-medium text-ink">{campaign.title}</p>
              {campaign.description ? <p className="mt-1 text-sm text-muted">{campaign.description}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 space-y-5 lg:mt-5 lg:space-y-4">
            {variants.length ? (
              <div>
                <p className="text-sm font-semibold text-ink">
                  Colour {selectedVariant ? <span className="font-normal text-muted">— {selectedVariant.color_name}</span> : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {variants.map((variant) => {
                    const selected = selectedVariantId === variant.id;
                    return (
                      <button key={variant.id} type="button" onClick={() => selectVariant(variant)} disabled={variant.stock <= 0} aria-pressed={selected} className={`flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm transition ${selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/45"} disabled:cursor-not-allowed disabled:opacity-35`}>
                        <span className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ background: variant.color_hex ?? "#c45b7a" }} />
                        {variant.color_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {availableSizes.length ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">
                    Size {selectedSize ? <span className="font-normal text-muted">— {selectedSize}</span> : null}
                  </p>
                  <SizeGuide />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {availableSizes.map((size) => (
                    <button key={size} type="button" onClick={() => { setSelectedSize(size); setAdded(false); }} aria-pressed={selectedSize === size} className={`min-h-10 rounded-md border px-2 text-sm font-semibold transition lg:min-h-9 lg:text-[13px] ${selectedSize === size ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/45"}`}>
                      {size}
                    </button>
                  ))}
                </div>
                {!selectedSize ? <p className="mt-2 text-xs text-accent-deep">Select a size to add this piece to your bag.</p> : null}
              </div>
            ) : null}
            <ProductCustomizationFields
              config={customizationConfig}
              enabled={customizationSelected}
              values={customizationValues}
              error={customizationError}
              onToggle={(enabled) => {
                setCustomizationSelected(enabled);
                setCustomizationError(null);
              }}
              onChange={(id, value) => {
                setCustomizationSelected(true);
                setCustomizationError(null);
                setCustomizationValues((current) => ({ ...current, [id]: value }));
              }}
            />
          </div>

          <p className={`mt-4 text-sm ${availableStock > 0 ? "text-[#2d7565]" : "text-accent-deep"}`}>
            {availableStock > 0 ? `${availableStock} available${selectedVariant ? ` in ${selectedVariant.color_name}` : ""}` : "This piece is currently out of stock"}
          </p>
          <div className="mt-4 hidden gap-3 sm:flex">
            <div className="relative min-w-0 flex-1">
              <AddToBagButton label={addLabel} disabled={!canAdd} added={added} onClick={() => addToBag()} size="compact" />
              <AddToBagConfetti celebrationKey={celebrationKey} />
            </div>
            <button type="button" onClick={() => router.push("/cart")} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:border-ink/30 hover:bg-surface lg:min-h-11 lg:px-5">
              Cart
            </button>
          </div>

          <div className="mt-6 border-b border-line lg:mt-5">
            <ProductAccordion title="Product details" open={detailsOpen} onToggle={() => setDetailsOpen((open) => !open)}>
              <p>{product.description ?? "A thoughtfully selected piece from this local boutique."}</p>
              {selectedVariant ? <p className="mt-3">Colour: {selectedVariant.color_name}.</p> : null}
            </ProductAccordion>
            <ProductAccordion title="Delivery" open={deliveryOpen} onToggle={() => setDeliveryOpen((open) => !open)}>
              <p>Delivery is available across Dubai. Your exact delivery estimate is confirmed at checkout once you choose an address.</p>
            </ProductAccordion>
            <ProductAccordion title="Returns" open={returnsOpen} onToggle={() => setReturnsOpen((open) => !open)}>
              <p>Please contact Morni support promptly if there is an issue with your order. Items must be returned unused and in their original condition.</p>
            </ProductAccordion>
          </div>
        </section>
      </div>

      {relatedProducts.length ? (
        <section className="mt-14 border-t border-line pt-10 sm:mt-20 lg:mt-12 lg:pt-6">
          <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">More to discover</p>
              <h2 className="mt-2 font-display text-2xl text-ink sm:text-3xl lg:text-2xl">You may also like</h2>
            </div>
            <Link href={`/stores/${store.slug}`} className="text-sm font-semibold text-ink underline underline-offset-4">
              View boutique
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-5 lg:mt-5 lg:grid-cols-5 lg:gap-4">
            {relatedProducts.map((relatedProduct) => (
              <RelatedProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      ) : null}

      <ProductReviewsSection
        reviews={reviews}
        avgRating={ratingSummary?.avgRating ?? null}
        reviewCount={ratingSummary?.reviewCount ?? 0}
        existingReview={existingReview}
        canReview={!existingReview && reviewOrderId ? { productId: product.id, orderId: reviewOrderId } : null}
        onReviewSaved={() => loadReviewEligibility(product.id)}
      />

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-background/92 px-4 py-3 shadow-[0_-10px_30px_-18px_rgba(28,20,24,0.18)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <WishlistToggle productId={product.id} size="lg" tone="inline" />
          <div className="relative min-w-0 flex-1">
            <AddToBagButton label={addLabel} disabled={!canAdd} added={added} onClick={() => addToBag()} size="compact" />
            <AddToBagConfetti celebrationKey={celebrationKey} />
          </div>
        </div>
      </div>
      {bagSheet ? (
        <BagSheet
          mode={bagSheet}
          product={product}
          store={store}
          sizes={availableSizes}
          relatedProducts={relatedProducts}
          onClose={() => setBagSheet(null)}
          onSizeSelect={(size) => {
            setSelectedSize(size);
            setAdded(false);
            addToBag(size);
          }}
        />
      ) : null}
    </main>
  );
}
