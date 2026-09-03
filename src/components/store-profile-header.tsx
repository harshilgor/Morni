"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { emirateLabel } from "@/lib/format";
import { formatRatingLabel } from "@/lib/product-ratings";
import type { Store } from "@/lib/types";

export type StorePromo = {
  id: string;
  title: string;
  description?: string | null;
  tone?: "rose" | "mint" | "sand";
  cta?: string;
  href?: string;
};

function deliveryEtaLabel(minutes: number) {
  const max = Math.max(15, Math.round(minutes / 5) * 5);
  const min = Math.max(10, Math.round((max * 0.7) / 5) * 5);
  return `${min}–${max} mins`;
}

function RatingCircles({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index));
        return (
          <span
            key={index}
            className="relative inline-block h-2.5 w-2.5 overflow-hidden rounded-full border border-mint bg-white"
          >
            <span
              className="absolute inset-y-0 left-0 bg-mint"
              style={{ width: `${fill * 100}%` }}
            />
          </span>
        );
      })}
    </span>
  );
}

const PROMO_TONES: Record<NonNullable<StorePromo["tone"]>, string> = {
  rose: "bg-[#fff0f4] border-[#f0d0da]",
  mint: "bg-[#eef7f3] border-[#cfe3da]",
  sand: "bg-[#faf3ec] border-[#e8d8c8]",
};

export function StoreProfileHeader({
  store,
  openNow,
  hours,
  rating,
  reviewCount,
  promos = [],
  publicPickupLocation,
}: {
  store: Store;
  openNow: boolean | null;
  hours: string;
  rating: number | null;
  reviewCount: number;
  promos?: StorePromo[];
  publicPickupLocation?: {
    area: string;
    address: string;
    emirate: Store["emirate"];
  } | null;
}) {
  const eta = deliveryEtaLabel(store.delivery_eta_minutes || 60);
  const location = `${store.area}, ${emirateLabel(store.emirate)}`;
  const showRating = rating != null && reviewCount > 0;

  return (
    <section className="border-b border-line bg-sand/45 py-5 sm:py-7">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="overflow-hidden rounded-[1.65rem] border border-line bg-white shadow-[0_18px_50px_-32px_rgba(28,20,24,0.45)]"
        >
          <div className="px-4 pb-1 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-start gap-3.5">
              {store.logo_url ? (
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-line bg-white sm:h-16 sm:w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={store.logo_url}
                    alt={`${store.name} logo`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-sand font-display text-xl text-ink sm:h-16 sm:w-16">
                  {store.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {openNow !== null ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      openNow
                        ? "bg-[#eaf6f1] text-mint"
                        : "bg-[#f4f1ed] text-muted"
                    }`}
                  >
                    {openNow ? "Open now" : "Closed now"}
                  </span>
                ) : null}
                <h1 className="mt-1.5 font-display text-[1.85rem] leading-none tracking-tight text-ink sm:text-4xl">
                  {store.name}
                </h1>
                {showRating ? (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
                    <span className="font-medium">{formatRatingLabel(rating)}</span>
                    <RatingCircles value={rating} />
                    <span className="text-muted">
                      ({reviewCount.toLocaleString()}{" "}
                      {reviewCount === 1 ? "review" : "reviews"})
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-line px-4 py-3 sm:px-6">
            <p className="truncate text-sm font-medium text-ink">
              {openNow === false ? `Opens ${hours}` : `Today ${hours}`}
              <span className="font-normal text-muted"> · {eta}</span>
            </p>
            <p className="truncate text-xs text-muted">{location}</p>
            {publicPickupLocation ? (
              <p className="mt-1 truncate text-xs text-muted" title={publicPickupLocation.address}>
                Pickup from: {publicPickupLocation.address}, {publicPickupLocation.area}
              </p>
            ) : null}
          </div>
        </motion.div>

        {promos.length > 0 ? (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 30, delay: 0.06 }}
            className="mt-4 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {promos.map((promo) => {
              const body = (
                <div
                  className={`min-w-[11.5rem] flex-1 rounded-2xl border px-3.5 py-3 sm:min-w-[14rem] ${
                    PROMO_TONES[promo.tone ?? "rose"]
                  }`}
                >
                  <p className="text-sm font-semibold leading-snug text-ink">{promo.title}</p>
                  {promo.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                      {promo.description}
                    </p>
                  ) : null}
                  {promo.cta ? (
                    <p className="mt-2 text-xs font-semibold text-accent-deep">{promo.cta}</p>
                  ) : null}
                </div>
              );
              return promo.href ? (
                <Link key={promo.id} href={promo.href} className="shrink-0">
                  {body}
                </Link>
              ) : (
                <div key={promo.id} className="shrink-0">
                  {body}
                </div>
              );
            })}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
