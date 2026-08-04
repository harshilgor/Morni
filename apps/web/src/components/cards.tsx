import Link from "next/link";
import type { Store } from "@/lib/types";
import { deliveryPromise, emirateLabel, formatAed } from "@/lib/format";
import { WishlistToggle } from "@/components/wishlist-toggle";

function getProductSocialProof(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  const rating = 4 + ((hash % 10) / 10);
  const reviews = 18 + (hash % 220);
  return { rating: rating.toFixed(1), reviews };
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`h-3.5 w-3.5 ${filled ? "fill-[#f2b246] text-[#f2b246]" : "fill-none text-[#d6c2a0]"}`}
    >
      <path
        d="m10 1.6 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.3l5.4-.8L10 1.6Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StoreCard({ store }: { store: Store }) {
  return (
    <Link
      href={`/stores/${store.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-surface transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-30px_rgba(28,20,24,0.45)]"
    >
      <div
        className="h-40 bg-sand bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
        style={{
          backgroundImage: store.cover_url
            ? `url(${store.cover_url})`
            : "linear-gradient(135deg, #f3e4dc, #ffd9e4)",
        }}
      />
      <div className="space-y-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-ink">{store.name}</h3>
          <span className="shrink-0 rounded-full bg-[#fff0f4] px-2.5 py-1 text-xs text-accent-deep">
            {deliveryPromise(store.delivery_eta_minutes)}
          </span>
        </div>
        <p className="text-sm text-muted">
          {store.area}, {emirateLabel(store.emirate)}
        </p>
        {store.description ? (
          <p className="line-clamp-2 text-sm text-ink/80">{store.description}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function ProductCard({
  product,
  href,
}: {
  product: {
    id: string;
    title: string;
    price_aed: number;
    compare_at_price_aed?: number | null;
    image_urls?: string[];
  };
  href: string;
}) {
  const image = product.image_urls?.[0];
  const social = getProductSocialProof(`${product.id}-${product.title}`);
  const roundedRating = Math.round(Number(social.rating));
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-line/70 bg-white/75 p-2.5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-32px_rgba(28,20,24,0.35)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-sand">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="absolute right-2.5 top-2.5 z-10">
          <WishlistToggle productId={product.id} size="sm" />
        </div>
      </div>
      <div className="space-y-1.5 px-1 pb-1 pt-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink">
          {product.title}
        </h3>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <StarIcon key={s} filled={s <= roundedRating} />
          ))}
          <span className="ml-1 text-xs font-medium text-ink/85">{social.rating}</span>
          <span className="text-xs text-muted">({social.reviews} reviews)</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
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
