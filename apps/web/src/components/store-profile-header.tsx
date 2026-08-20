"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { emirateLabel, formatAed } from "@/lib/format";
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

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-current">
      <path d="M8 1.4 9.9 5.6l4.6.4-3.5 3 1.1 4.5L8 11.4 3.9 13.5l1.1-4.5-3.5-3 4.6-.4L8 1.4Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 fill-none stroke-current">
      <circle cx="10" cy="10" r="7.25" strokeWidth="1.5" />
      <path d="M10 6.5V10l2.5 1.75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BikeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 fill-none stroke-current">
      <circle cx="5.5" cy="13.5" r="2.75" strokeWidth="1.5" />
      <circle cx="14.5" cy="13.5" r="2.75" strokeWidth="1.5" />
      <path
        d="M8 13.5h3.2l2-5.2H16M5.5 13.5 8.2 6.8H11"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  deliveryFeeAed = 7,
  categoryLine,
  promos = [],
}: {
  store: Store;
  openNow: boolean | null;
  hours: string;
  rating: number | null;
  reviewCount: number;
  deliveryFeeAed?: number;
  categoryLine: string;
  promos?: StorePromo[];
}) {
  const eta = deliveryEtaLabel(store.delivery_eta_minutes || 60);
  const location = `${store.area}, ${emirateLabel(store.emirate)}`;

  return (
    <section className="relative">
      <div className="relative h-48 overflow-hidden bg-sand sm:h-64 lg:h-72">
        {store.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.cover_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #1c1418 0%, #4a3038 45%, #c45b7a 100%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15" />
      </div>

      <div className="relative z-10 mx-auto -mt-14 max-w-7xl px-4 sm:-mt-16 sm:px-6">
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
                <p className="mt-1.5 truncate text-sm text-muted">{categoryLine}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line">
              <div className="px-1 py-3 text-center sm:px-3 sm:py-4">
                {rating != null && reviewCount > 0 ? (
                  <>
                    <p className="flex items-center justify-center gap-1 text-base font-semibold text-mint sm:text-lg">
                      {formatRatingLabel(rating)}
                      <span className="text-mint">
                        <StarIcon />
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted sm:text-xs">
                      {reviewCount >= 100
                        ? `${reviewCount}+ ratings`
                        : `${reviewCount} rating${reviewCount === 1 ? "" : "s"}`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink sm:text-base">New</p>
                    <p className="mt-0.5 text-[11px] text-muted sm:text-xs">Be the first to rate</p>
                  </>
                )}
              </div>

              <div className="px-1 py-3 text-center sm:px-3 sm:py-4">
                <p className="flex items-center justify-center gap-1 text-sm font-semibold text-mint sm:text-base">
                  <ClockIcon />
                  <span>{eta}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted sm:text-xs">Delivery by Morni</p>
              </div>

              <div className="px-1 py-3 text-center sm:px-3 sm:py-4">
                <p className="flex items-center justify-center gap-1 text-sm font-semibold text-ink sm:text-base">
                  <BikeIcon />
                  <span>{formatAed(deliveryFeeAed)}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted sm:text-xs">Delivery fee</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#f0d9df] bg-[#fff6f8] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {openNow === false ? `Opens ${hours}` : `Today ${hours}`}
              </p>
              <p className="truncate text-xs text-muted">{location}</p>
            </div>
            <Link
              href="#shop"
              className="shrink-0 text-sm font-semibold text-accent-deep transition hover:text-ink"
            >
              Shop now
            </Link>
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

        {store.description ? (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink/80">
            {store.description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
