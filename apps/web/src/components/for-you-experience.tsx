"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { BrowseCategory } from "@/lib/browse-categories";
import { formatAed } from "@/lib/format";
import type { Product } from "@/lib/types";
import {
  applyVote,
  buildSwipeDeck,
  emptyTaste,
  recommendProducts,
  topTasteTags,
  type StyleCard,
  type TasteProfile,
} from "@/lib/style-taste";

type ProductWithStore = Product & { stores: { slug: string; name: string } };

type Step = "pick" | "swipe" | "results";

const SWIPE_THRESHOLD = 110;

export function ForYouExperience({
  categories,
  products,
}: {
  categories: BrowseCategory[];
  products: ProductWithStore[];
}) {
  const [step, setStep] = useState<Step>("pick");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [deck, setDeck] = useState<StyleCard[]>([]);
  const [index, setIndex] = useState(0);
  const [taste, setTaste] = useState<TasteProfile>(emptyTaste());
  const [recs, setRecs] = useState<StyleCard[]>([]);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const category = useMemo(
    () => categories.find((c) => c.slug === categorySlug) ?? null,
    [categories, categorySlug],
  );

  const current = deck[index] ?? null;
  const remaining = Math.max(deck.length - index, 0);
  const progress = deck.length === 0 ? 0 : Math.min(1, index / Math.max(deck.length - 1, 1));

  const startCategory = (slug: string) => {
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) return;
    const nextDeck = buildSwipeDeck(cat, products);
    setCategorySlug(slug);
    setDeck(nextDeck);
    setIndex(0);
    setTaste(emptyTaste());
    setRecs([]);
    setDrag({ x: 0, y: 0, active: false });
    setStep("swipe");
  };

  const finish = useCallback(
    (profile: TasteProfile) => {
      if (!category) return;
      setRecs(recommendProducts(products, category, profile));
      setStep("results");
    },
    [category, products],
  );

  const vote = useCallback(
    (liked: boolean) => {
      if (!current || !category) return;
      const nextTaste = applyVote(taste, {
        cardId: current.id,
        liked,
        tags: current.tags,
        priceHintAed: current.priceHintAed,
      });
      setTaste(nextTaste);
      setDrag({ x: 0, y: 0, active: false });

      const nextIndex = index + 1;
      if (nextIndex >= deck.length) {
        finish(nextTaste);
        return;
      }
      setIndex(nextIndex);
    },
    [category, current, deck.length, finish, index, taste],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current || !drag.active) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: (e.clientY - startRef.current.y) * 0.25,
      active: true,
    });
  };

  const onPointerUp = () => {
    if (!drag.active) return;
    if (drag.x > SWIPE_THRESHOLD) vote(true);
    else if (drag.x < -SWIPE_THRESHOLD) vote(false);
    else setDrag({ x: 0, y: 0, active: false });
    startRef.current = null;
  };

  const tags = topTasteTags(taste);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {step === "pick" ? (
        <section className="animate-rise space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-deep">
              For you
            </p>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">
              Find my outfit
            </h1>
            <p className="mx-auto max-w-md text-muted">
              Pick a category, swipe right on looks you love and left on the rest.
              We learn your taste and surface pieces from nearby stores.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => startCategory(cat.slug)}
                className="group overflow-hidden rounded-[1.35rem] border border-line bg-surface text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_18px_40px_-28px_rgba(28,20,24,0.45)]"
              >
                <div className="aspect-[16/10] overflow-hidden bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.image_url}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <p className="font-display text-xl text-ink">{cat.name}</p>
                    <p className="text-xs text-muted">Swipe to train your style</p>
                  </div>
                  <span className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                    Start
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "swipe" && current && category ? (
        <section className="animate-rise space-y-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="text-sm text-muted hover:text-ink"
            >
              ← Categories
            </button>
            <p className="text-sm font-medium text-ink">{category.name}</p>
            <p className="text-sm text-muted">{remaining} left</p>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
            <div
              className="h-full rounded-full bg-accent-deep transition-all duration-300"
              style={{ width: `${Math.max(8, progress * 100)}%` }}
            />
          </div>

          <div className="relative mx-auto h-[min(68vh,560px)] w-full max-w-md touch-none select-none">
            {deck.slice(index + 1, index + 3).map((card, i) => (
              <div
                key={card.id}
                className="absolute inset-0 overflow-hidden rounded-[1.6rem] bg-sand shadow-sm"
                style={{
                  transform: `scale(${0.96 - i * 0.03}) translateY(${(i + 1) * 10}px)`,
                  zIndex: 1 - i,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image} alt="" className="h-full w-full object-cover opacity-70" />
              </div>
            ))}

            <div
              role="img"
              aria-label={`${current.title}. Swipe right to like, left to pass.`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 z-10 cursor-grab overflow-hidden rounded-[1.6rem] bg-ink active:cursor-grabbing"
              style={{
                transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * 0.04}deg)`,
                transition: drag.active ? "none" : "transform 0.25s ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.image}
                alt=""
                className="pointer-events-none h-full w-full object-cover object-top"
                draggable={false}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

              <div
                className="pointer-events-none absolute left-5 top-5 rounded-full border-2 border-emerald-300 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-300"
                style={{ opacity: Math.min(1, Math.max(0, drag.x / SWIPE_THRESHOLD)) }}
              >
                Love
              </div>
              <div
                className="pointer-events-none absolute right-5 top-5 rounded-full border-2 border-rose-300 px-3 py-1 text-sm font-bold uppercase tracking-wide text-rose-300"
                style={{ opacity: Math.min(1, Math.max(0, -drag.x / SWIPE_THRESHOLD)) }}
              >
                Pass
              </div>

              <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  {current.storeName ?? "Style cue"}
                </p>
                <h2 className="font-display text-3xl leading-tight">{current.title}</h2>
                <p className="text-sm text-white/85">{current.subtitle}</p>
                {typeof (current.priceAed ?? current.priceHintAed) === "number" ? (
                  <p className="pt-1 text-sm font-medium">
                    {formatAed(current.priceAed ?? current.priceHintAed ?? 0)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5 pt-1">
            <button
              type="button"
              onClick={() => vote(false)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface text-xl text-ink shadow-sm transition hover:border-rose-300 hover:text-rose-500"
              aria-label="Pass"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => finish(taste)}
              className="rounded-full border border-line px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted hover:text-ink"
            >
              See matches
            </button>
            <button
              type="button"
              onClick={() => vote(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-xl text-white shadow-sm transition hover:bg-accent-deep"
              aria-label="Love"
            >
              ♥
            </button>
          </div>
          <p className="text-center text-xs text-muted">
            Swipe right to love · left to pass · we learn as you go
          </p>
        </section>
      ) : null}

      {step === "results" && category ? (
        <section className="animate-rise space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-deep">
              Your taste
            </p>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">
              Picks for you
            </h1>
            <p className="mx-auto max-w-md text-muted">
              Based on {taste.likeCount} love{taste.likeCount === 1 ? "" : "s"} in{" "}
              {category.name.toLowerCase()}
              {tags.length > 0 ? (
                <>
                  {" "}
                  — leaning toward{" "}
                  <span className="font-medium text-ink">{tags.join(", ")}</span>
                </>
              ) : null}
              .
            </p>
          </div>

          {recs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
              <p className="text-muted">
                Not enough store inventory in this category yet. Keep swiping more
                looks, or try another category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {recs.map((card) => {
                const href = card.productId && card.storeSlug
                  ? `/stores/${card.storeSlug}/products/${card.productId}`
                  : `/categories/${category.slug}`;
                return (
                  <Link
                    key={card.id}
                    href={href}
                    className="group block overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(28,20,24,0.4)]"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-sand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.image}
                        alt={card.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="space-y-1 p-3.5">
                      <h3 className="line-clamp-2 text-sm font-medium text-ink">
                        {card.title}
                      </h3>
                      {typeof (card.priceAed ?? card.priceHintAed) === "number" ? (
                        <p className="text-sm text-muted">
                          {formatAed(card.priceAed ?? card.priceHintAed ?? 0)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => categorySlug && startCategory(categorySlug)}
              className="rounded-full bg-ink px-5 py-2.5 text-sm text-white hover:bg-accent-deep"
            >
              Train again
            </button>
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:border-accent"
            >
              New category
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
