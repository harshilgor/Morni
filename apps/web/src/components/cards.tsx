import Link from "next/link";
import type { Store } from "@/lib/types";
import { deliveryPromise, emirateLabel, formatAed } from "@/lib/format";
import { WishlistToggle } from "@/components/wishlist-toggle";

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
  return (
    <Link href={href} className="group relative block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute right-3 top-3 z-10">
          <WishlistToggle productId={product.id} size="sm" />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-medium text-ink">{product.title}</h3>
        <div className="flex items-center gap-2 text-sm">
          <span>{formatAed(product.price_aed)}</span>
          {product.compare_at_price_aed ? (
            <span className="text-muted line-through">
              {formatAed(product.compare_at_price_aed)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
