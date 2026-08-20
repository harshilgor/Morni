"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { formatAed } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { formatRatingLabel, type ProductRatingSummary } from "@/lib/product-ratings";
import type { Product } from "@/lib/types";

type StoreRowProduct = {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  price_aed: number;
  compare_at_price_aed: number | null;
  image_urls: string[] | null;
  sizes: string[] | null;
  stock: number;
  is_available?: boolean;
  category_id?: string | null;
};

export function StoreProductRow({
  product,
  storeName,
  href,
  rating,
}: {
  product: StoreRowProduct;
  storeName: string;
  href: string;
  rating?: ProductRatingSummary | null;
}) {
  const addItem = useCart((state) => state.addItem);
  const [pickingSize, setPickingSize] = useState(false);
  const [added, setAdded] = useState(false);
  const image = product.image_urls?.[0];
  const sizes = (product.sizes ?? []).filter(Boolean);
  const onSale =
    product.compare_at_price_aed != null &&
    Number(product.compare_at_price_aed) > Number(product.price_aed);
  const showRating = rating && rating.reviewCount > 0;

  function cartProduct(): Product {
    return {
      id: product.id,
      store_id: product.store_id,
      category_id: product.category_id ?? null,
      title: product.title,
      description: product.description,
      price_aed: product.price_aed,
      compare_at_price_aed: product.compare_at_price_aed,
      image_urls: product.image_urls ?? [],
      sizes: product.sizes ?? [],
      stock: product.stock,
      is_available: product.is_available ?? true,
    };
  }

  function addWithSize(size?: string) {
    addItem(cartProduct(), storeName, 1, {
      size,
      imageUrl: image,
    });
    setPickingSize(false);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  function handleAdd(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (product.stock <= 0) return;
    if (sizes.length <= 1) {
      addWithSize(sizes[0]);
      return;
    }
    setPickingSize((open) => !open);
  }

  return (
    <article className="border-b border-line/80 py-4 last:border-b-0 sm:py-5">
      <div className="flex gap-3.5 sm:gap-5">
        <div className="min-w-0 flex-1">
          <Link href={href} className="block">
            <h3 className="text-[15px] font-semibold leading-snug text-ink sm:text-base">
              {product.title}
            </h3>
            {product.description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                {product.description}
              </p>
            ) : null}
          </Link>
          {showRating ? (
            <p className="mt-2 text-xs text-muted">
              <span className="font-medium text-mint">{formatRatingLabel(rating.avgRating)} ★</span>
              <span className="ml-1">({rating.reviewCount})</span>
            </p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
            <span className={`text-[15px] font-semibold sm:text-base ${onSale ? "text-mint" : "text-ink"}`}>
              {formatAed(product.price_aed)}
            </span>
            {onSale && product.compare_at_price_aed ? (
              <span className="text-sm text-muted line-through">
                {formatAed(product.compare_at_price_aed)}
              </span>
            ) : null}
          </div>
          {pickingSize ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => addWithSize(size)}
                  className="min-h-9 min-w-11 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink transition hover:border-ink hover:bg-ink hover:text-white"
                >
                  {size}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative shrink-0">
          <Link href={href} className="block overflow-hidden rounded-2xl bg-sand">
            <div className="h-[7.25rem] w-[7.25rem] sm:h-32 sm:w-32">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </Link>
          <button
            type="button"
            onClick={handleAdd}
            disabled={product.stock <= 0}
            aria-label={added ? "Added to bag" : `Add ${product.title} to bag`}
            className={`absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border bg-white text-lg font-semibold shadow-[0_8px_20px_-12px_rgba(28,20,24,0.55)] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              added
                ? "border-mint text-mint"
                : "border-accent/40 text-accent-deep hover:border-accent-deep hover:bg-[#fff4f7]"
            }`}
          >
            {added ? "✓" : "+"}
          </button>
        </div>
      </div>
    </article>
  );
}
