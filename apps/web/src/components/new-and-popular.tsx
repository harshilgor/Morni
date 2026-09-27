"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductCardImage } from "@/components/product-card-image";
import { formatAed } from "@/lib/format";
import { WishlistToggle } from "@/components/wishlist-toggle";
import type { RailProduct } from "@/components/product-rail";

export type PopularTab = {
  slug: string;
  label: string;
  href: string;
  products?: RailProduct[];
};

type FeedState = {
  products: RailProduct[];
  hasMore: boolean;
  status: "loading" | "ready" | "error";
};

export function NewAndPopular({ tabs }: { tabs: PopularTab[] }) {
  const [activeSlug, setActiveSlug] = useState(tabs[0]?.slug ?? "");
  const [feeds, setFeeds] = useState<Record<string, FeedState>>(() => {
    const firstTab = tabs[0];
    return firstTab?.products?.length
      ? { [firstTab.slug]: { products: firstTab.products, hasMore: true, status: "ready" } }
      : {};
  });
  const inFlightRef = useRef(new Set<string>());
  const loadTriggerRef = useRef<HTMLDivElement>(null);
  const active = tabs.find((tab) => tab.slug === activeSlug) ?? tabs[0];
  const activeFeed = active ? feeds[active.slug] : undefined;
  const activeProducts = activeFeed?.products ?? [];

  const loadPage = useCallback(async (slug: string, offset: number) => {
    if (inFlightRef.current.has(slug)) return;
    inFlightRef.current.add(slug);
    setFeeds((current) => ({
      ...current,
      [slug]: {
        products: current[slug]?.products ?? [],
        hasMore: current[slug]?.hasMore ?? true,
        status: "loading",
      },
    }));

    try {
      const response = await fetch(`/api/home/new-and-popular?slug=${encodeURIComponent(slug)}&offset=${offset}`);
      if (!response.ok) throw new Error("Unable to load products");
      const result = (await response.json()) as { products: RailProduct[]; hasMore: boolean };
      setFeeds((current) => {
        const existing = offset === 0 ? [] : current[slug]?.products ?? [];
        const seen = new Set(existing.map((product) => product.id));
        const nextProducts = result.products.filter((product) => !seen.has(product.id));
        return {
          ...current,
          [slug]: {
            products: [...existing, ...nextProducts],
            hasMore: result.hasMore,
            status: "ready",
          },
        };
      });
    } catch {
      setFeeds((current) => ({
        ...current,
        [slug]: {
          products: current[slug]?.products ?? [],
          hasMore: current[slug]?.hasMore ?? true,
          status: "error",
        },
      }));
    } finally {
      inFlightRef.current.delete(slug);
    }
  }, []);

  useEffect(() => {
    const trigger = loadTriggerRef.current;
    if (!trigger || !active || !activeFeed?.hasMore || activeFeed.status !== "ready") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadPage(active.slug, activeProducts.length);
    }, { rootMargin: "500px 0px" });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [active, activeFeed?.hasMore, activeFeed?.status, activeProducts.length, loadPage]);

  if (!active) return null;

  return (
    <section className="w-full bg-white py-8 sm:py-12">
      <div className="px-4 text-center sm:px-6">
        <h2 className="shop-section-title">New and popular</h2>
      </div>

      <div className="sticky top-[var(--site-header-height,0px)] z-40 mt-4 border-y border-[#e8e8e8] bg-white/95 px-4 py-3 shadow-[0_8px_18px_-16px_rgba(28,20,24,0.5)] backdrop-blur sm:mt-5 sm:px-6 sm:py-4">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="mx-auto flex w-max min-w-full flex-wrap justify-center gap-x-5 gap-y-2.5 sm:w-auto sm:max-w-7xl sm:gap-x-6 sm:gap-y-3">
            {tabs.map((tab) => {
              const isActive = tab.slug === active.slug;
              return (
                <button
                  key={tab.slug}
                  type="button"
                  onClick={() => {
                    setActiveSlug(tab.slug);
                    if (!feeds[tab.slug]) void loadPage(tab.slug, 0);
                  }}
                  aria-pressed={isActive}
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] transition sm:text-[11px] sm:tracking-[0.12em] ${
                    isActive
                      ? "text-ink underline underline-offset-4"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeProducts.length > 0 ? <div className="mt-5 grid w-full grid-cols-2 gap-px border-y border-[#e8e8e8] bg-[#e8e8e8] sm:mt-8 sm:grid-cols-3 xl:grid-cols-5">
        {activeProducts.map((product) => (
          <Link
            key={product.id}
            href={product.href}
            className="group relative flex flex-col bg-white"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-sand">
              <ProductCardImage src={product.image_urls?.[0]} alt={product.title} />
            </div>
            <div className="space-y-0 p-1.5 sm:p-3">
              <div className="flex items-start gap-0.5">
                <h3 className="min-w-0 flex-1 line-clamp-1 text-[11px] leading-snug text-ink sm:text-xs">
                  {product.title}
                </h3>
                <WishlistToggle productId={product.id} size="sm" tone="inline" />
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] font-semibold text-ink sm:text-xs">
                  {formatAed(product.price_aed)}
                </span>
                {product.compare_at_price_aed ? (
                  <span className="text-[10px] text-muted line-through sm:text-[11px]">
                    {formatAed(product.compare_at_price_aed)}
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div> : (
        <div className="mx-auto mt-8 px-4 py-16 text-center text-sm text-muted" role="status">
          {!activeFeed || activeFeed.status === "loading"
            ? `Loading ${active.label} products…`
            : activeFeed.status === "error"
              ? <><span>Could not load these products.</span> <button type="button" className="font-semibold text-ink underline underline-offset-4" onClick={() => void loadPage(active.slug, 0)}>Try again</button></>
              : `No products in ${active.label} yet.`}
        </div>
      )}

      {activeFeed?.status === "ready" && activeFeed.hasMore ? <div ref={loadTriggerRef} className="h-8" aria-hidden /> : null}
      {activeFeed?.status === "error" && activeProducts.length > 0 ? (
        <div className="mt-6 text-center">
          <button type="button" className="text-sm font-semibold text-ink underline underline-offset-4" onClick={() => void loadPage(active.slug, activeProducts.length)}>Retry loading more</button>
        </div>
      ) : null}

      {activeProducts.length > 0 ? <div className="mt-6 text-center sm:mt-8">
        <Link
          href={active.href}
          className="inline-flex border border-ink px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-white sm:px-6 sm:py-2.5 sm:text-[11px] sm:tracking-[0.16em]"
        >
          View all
        </Link>
      </div> : null}
    </section>
  );
}
