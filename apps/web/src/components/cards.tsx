import Link from "next/link";
import type { Store } from "@/lib/types";
import { emirateLabel, formatAed } from "@/lib/format";
import { formatRatingLabel, type ProductRatingSummary } from "@/lib/product-ratings";
import { StarRating } from "@/components/star-rating";
import { WishlistToggle } from "@/components/wishlist-toggle";

const NEW_STORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STORE_CARD_REFERENCE_TIME_MS = Date.now();

export function StoreCard({ store, compact = false }: { store: Store; compact?: boolean }) {
  const createdAtMs = store.created_at ? Date.parse(store.created_at) : NaN;
  const isNew =
    Number.isFinite(createdAtMs) &&
    STORE_CARD_REFERENCE_TIME_MS - createdAtMs < NEW_STORE_WINDOW_MS;

  return (
    <Link
      href={`/stores/${store.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#dedbd4] bg-white transition duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_18px_42px_-30px_rgba(28,20,24,0.38)]"
    >
      <div
        className={`relative bg-sand bg-cover bg-center transition duration-500 group-hover:scale-[1.03] ${
          compact ? "h-28 sm:h-40" : "h-40"
        }`}
        style={{
          backgroundImage: store.cover_url
            ? `url(${store.cover_url})`
            : "linear-gradient(135deg, #e8e4dc, #c9c3b8)",
        }}
      >
        {isNew ? (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            New
          </span>
        ) : null}
      </div>
      <div className={`flex flex-1 flex-col ${compact ? "p-3 sm:min-h-[190px] sm:p-4" : "min-h-[190px] p-4"}`}>
        <h3
          className={`line-clamp-2 font-display leading-snug text-ink ${
            compact ? "text-base sm:min-h-14 sm:text-xl" : "min-h-14 text-xl"
          }`}
        >
          {store.name}
        </h3>
        <p
          className={`truncate text-muted ${compact ? "mt-1 text-xs sm:mt-2 sm:text-sm" : "mt-2 text-sm"}`}
          title={store.area + ", " + emirateLabel(store.emirate)}
        >
          {store.area}, {emirateLabel(store.emirate)}
        </p>
        {!compact ? (
          <p className="mt-3 min-h-10 line-clamp-2 text-sm leading-5 text-ink/80">
            {store.description || "A local boutique on Morni."}
          </p>
        ) : (
          <p className="mt-2 hidden line-clamp-2 text-sm leading-5 text-ink/80 sm:mt-3 sm:block sm:min-h-10">
            {store.description || "A local boutique on Morni."}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ProductCard({
  product,
  href,
  rating,
  onWishlistChange,
}: {
  product: {
    id: string;
    title: string;
    price_aed: number;
    compare_at_price_aed?: number | null;
    image_urls?: string[];
  };
  href: string;
  rating?: ProductRatingSummary | null;
  onWishlistChange?: (isWished: boolean) => void;
}) {
  const image = product.image_urls?.[0];
  const showRating = rating && rating.reviewCount > 0;

  return (
    <Link
      href={href}
      className="group relative block min-w-0 overflow-hidden rounded-lg border border-line/70 bg-white/75 p-1.5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-32px_rgba(28,20,24,0.35)] sm:rounded-2xl sm:p-2.5"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-sand sm:rounded-xl">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="absolute right-1.5 top-1.5 z-10 sm:right-2.5 sm:top-2.5">
          <WishlistToggle
            productId={product.id}
            size="sm"
            onChange={onWishlistChange}
          />
        </div>
      </div>
      <div className="space-y-0.5 px-0.5 pb-0.5 pt-1.5 sm:space-y-1.5 sm:px-1 sm:pb-1 sm:pt-3">
        <h3 className="line-clamp-2 text-[11px] font-medium leading-snug text-ink sm:text-sm">
          {product.title}
        </h3>
        {showRating ? (
          <div className="flex items-center gap-1 sm:gap-1.5">
            <StarRating value={rating.avgRating} />
            <span className="text-[10px] font-medium text-ink/85 sm:text-xs">
              {formatRatingLabel(rating.avgRating)}
            </span>
            <span className="hidden text-xs text-muted sm:inline">({rating.reviewCount})</span>
          </div>
        ) : null}
        <div className="flex items-center gap-1 text-[11px] font-medium sm:gap-1.5 sm:text-sm">
          <span>{formatAed(product.price_aed)}</span>
          {product.compare_at_price_aed ? (
            <span className="text-[10px] font-normal text-muted line-through sm:text-xs">
              {formatAed(product.compare_at_price_aed)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
