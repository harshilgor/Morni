"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrowseCategory } from "@/lib/browse-categories";
import {
  applyTasteSwipe,
  buildUniversalTasteDeck,
  emptyTasteProfile,
  MIN_SWIPES_FOR_RESULTS,
  profileFromSwipes,
  recommendForYouProducts,
  topCategories,
  type ForYouProduct,
  type TasteProfile,
  type TasteSwipe,
} from "@/lib/for-you";
import { formatAed } from "@/lib/format";
import {
  FOR_YOU_STORAGE_KEY,
  readStoredForYouTaste,
  storeForYouTaste,
} from "@/lib/for-you-storage";
import { useLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/client";

type Step = "loading" | "test" | "results";

const SWIPE_THRESHOLD = 110;

function ProductResultCard({
  product,
  onNotForMe,
}: {
  product: ForYouProduct;
  onNotForMe: (productId: string) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-lg border border-line bg-surface">
      <Link href={`/stores/${product.stores.slug}/products/${product.id}`} className="block">
        <div className="aspect-[3/4] overflow-hidden bg-sand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_urls[0]}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="space-y-1 px-3 pt-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-accent-deep">
            {product.stores.name}
          </p>
          <h3 className="line-clamp-2 text-sm font-medium text-ink">{product.title}</h3>
          <p className="text-sm text-ink">{formatAed(product.price_aed)}</p>
        </div>
      </Link>
      <div className="px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={() => onNotForMe(product.id)}
          className="text-xs text-muted transition hover:text-ink"
        >
          Not for me
        </button>
      </div>
    </article>
  );
}

export function ForYouExperience({
  categories,
  products,
}: {
  categories: BrowseCategory[];
  products: ForYouProduct[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const emirate = useLocation((state) => state.emirate);
  const [step, setStep] = useState<Step>("loading");
  const [profile, setProfile] = useState<TasteProfile>(emptyTasteProfile());
  const [dismissedProductIds, setDismissedProductIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [shopperId, setShopperId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const localProducts = useMemo(
    () => products.filter((product) => !emirate || product.stores.emirate === emirate),
    [emirate, products],
  );
  const deck = useMemo(
    () => buildUniversalTasteDeck(localProducts, categories),
    [categories, localProducts],
  );
  const activeIndex = Math.min(index, Math.max(deck.length - 1, 0));
  const current = deck[activeIndex] ?? null;
  const minimumSwipes = Math.min(MIN_SWIPES_FOR_RESULTS, deck.length);
  const completedSwipes = profile.likes + profile.passes;
  const canFinish = completedSwipes >= minimumSwipes;
  const progress = deck.length === 0 ? 0 : Math.min(1, completedSwipes / deck.length);

  useEffect(() => {
    let mounted = true;
    async function loadTaste() {
      const stored = readStoredForYouTaste();
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;

      const user = auth.user;
      if (!user) {
        setProfile(stored.profile);
        setDismissedProductIds(stored.dismissedProductIds);
        setStep(stored.profile.likes + stored.profile.passes >= minimumSwipes ? "results" : "test");
        return;
      }

      setShopperId(user.id);
      const [{ data: swipes }, { data: feedback }] = await Promise.all([
        supabase
          .from("taste_swipes")
          .select("product_id, category_slug, decision, tags, price_aed")
          .eq("shopper_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("product_feedback")
          .select("product_id")
          .eq("shopper_id", user.id)
          .eq("feedback_type", "not_interested"),
      ]);
      if (!mounted) return;

      const savedSwipes: TasteSwipe[] = (swipes ?? []).map((swipe) => ({
        productId: swipe.product_id,
        categorySlug: swipe.category_slug,
        decision: swipe.decision as TasteSwipe["decision"],
        tags: swipe.tags ?? [],
        priceAed: Number(swipe.price_aed ?? 0),
      }));
      const nextProfile = savedSwipes.length ? profileFromSwipes(savedSwipes) : stored.profile;
      const nextDismissed = [
        ...new Set([...(feedback ?? []).map((item) => item.product_id), ...stored.dismissedProductIds]),
      ];
      setProfile(nextProfile);
      setDismissedProductIds(nextDismissed);
      setStep(nextProfile.likes + nextProfile.passes >= minimumSwipes ? "results" : "test");
    }

    void loadTaste();
    return () => {
      mounted = false;
    };
  }, [minimumSwipes, supabase]);

  const ensureSession = useCallback(async () => {
    if (!shopperId) return null;
    if (sessionIdRef.current) return sessionIdRef.current;
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = Promise.resolve(
        supabase
          .from("taste_sessions")
          .insert({ shopper_id: shopperId })
          .select("id")
          .single(),
      )
        .then(({ data }) => {
          sessionIdRef.current = data?.id ?? null;
          return sessionIdRef.current;
        });
    }
    return sessionPromiseRef.current;
  }, [shopperId, supabase]);

  const saveSwipe = useCallback(
    (swipe: TasteSwipe, nextProfile: TasteProfile) => {
      if (!shopperId) {
        storeForYouTaste({ profile: nextProfile, dismissedProductIds });
        return;
      }
      void ensureSession().then((sessionId) => {
        if (!sessionId) return;
        return supabase.from("taste_swipes").upsert(
          {
            session_id: sessionId,
            shopper_id: shopperId,
            product_id: swipe.productId,
            category_slug: swipe.categorySlug,
            decision: swipe.decision,
            tags: swipe.tags,
            price_aed: swipe.priceAed,
          },
          { onConflict: "session_id,product_id" },
        );
      });
    },
    [dismissedProductIds, ensureSession, shopperId, supabase],
  );

  const vote = useCallback(
    (decision: TasteSwipe["decision"]) => {
      if (!current) return;
      const swipe: TasteSwipe = {
        productId: current.productId,
        categorySlug: current.categorySlug,
        tags: current.tags,
        priceAed: current.priceAed,
        decision,
      };
      const nextProfile = applyTasteSwipe(profile, swipe);
      setProfile(nextProfile);
      setDrag({ x: 0, y: 0, active: false });
      saveSwipe(swipe, nextProfile);

      if (activeIndex + 1 >= deck.length) {
        setStep("results");
      } else {
        setIndex(activeIndex + 1);
      }
    },
    [activeIndex, current, deck.length, profile, saveSwipe],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { x: event.clientX, y: event.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || !drag.active) return;
    setDrag({
      x: event.clientX - startRef.current.x,
      y: (event.clientY - startRef.current.y) * 0.25,
      active: true,
    });
  };

  const onPointerUp = () => {
    if (!drag.active) return;
    if (drag.x >= SWIPE_THRESHOLD) vote("liked");
    else if (drag.x <= -SWIPE_THRESHOLD) vote("passed");
    else setDrag({ x: 0, y: 0, active: false });
    startRef.current = null;
  };

  const markNotForMe = useCallback(
    (productId: string) => {
      const nextDismissed = [...new Set([...dismissedProductIds, productId])];
      setDismissedProductIds(nextDismissed);
      if (!shopperId) {
        storeForYouTaste({ profile, dismissedProductIds: nextDismissed });
        return;
      }
      void supabase.from("product_feedback").upsert(
        { shopper_id: shopperId, product_id: productId, feedback_type: "not_interested" },
        { onConflict: "shopper_id,product_id,feedback_type" },
      );
    },
    [dismissedProductIds, profile, shopperId, supabase],
  );

  const resetTaste = useCallback(() => {
    const nextProfile = emptyTasteProfile();
    sessionIdRef.current = null;
    sessionPromiseRef.current = null;
    setProfile(nextProfile);
    setDismissedProductIds([]);
    setIndex(0);
    setStep("test");
    if (!shopperId) {
      window.localStorage.removeItem(FOR_YOU_STORAGE_KEY);
      return;
    }
    void Promise.all([
      supabase.from("taste_sessions").delete().eq("shopper_id", shopperId),
      supabase.from("product_feedback").delete().eq("shopper_id", shopperId),
    ]);
  }, [shopperId, supabase]);

  const favouriteProducts = useMemo(
    () => localProducts.filter((product) => profile.likedProductIds.includes(product.id)),
    [localProducts, profile.likedProductIds],
  );
  const recommendations = useMemo(
    () => recommendForYouProducts(localProducts, categories, profile, dismissedProductIds),
    [categories, dismissedProductIds, localProducts, profile],
  );
  const strongestCategories = topCategories(profile, categories);

  if (step === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted">Preparing your edit...</div>;
  }

  if (deck.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-4xl text-ink">Your edit is on its way</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          We need a little more available local inventory before we can build your taste test.
        </p>
      </div>
    );
  }

  if (step === "test" && current) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="sticky top-0 z-20 -mx-4 border-b border-line/70 bg-background/95 px-4 pb-4 pt-1 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">Your edit</p>
              <h1 className="mt-1 font-display text-3xl text-ink">Tell us what feels like you</h1>
            </div>
            <p className="shrink-0 text-sm text-muted">{Math.min(completedSwipes + 1, deck.length)} of {deck.length}</p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent-deep transition-all duration-300" style={{ width: `${Math.max(5, progress * 100)}%` }} />
          </div>
        </div>

        <section className="animate-rise pt-6">
          <p className="mx-auto mb-5 max-w-md text-center text-sm text-muted">
            Swipe right for more like this, or left to pass. Every card is a real piece from a local Morni store.
          </p>
          <div className="relative mx-auto h-[min(48vh,500px)] w-full max-w-md touch-none select-none">
            {deck.slice(activeIndex + 1, activeIndex + 3).map((card, cardIndex) => (
              <div
                key={card.id}
                className="absolute inset-0 overflow-hidden rounded-lg bg-sand shadow-sm"
                style={{
                  transform: `scale(${0.965 - cardIndex * 0.03}) translateY(${(cardIndex + 1) * 10}px)`,
                  zIndex: 1 - cardIndex,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.imageUrl} alt="" className="h-full w-full object-cover opacity-70" />
              </div>
            ))}
            <div
              role="img"
              aria-label={`${current.title}. Swipe right to like or left to pass.`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 z-10 cursor-grab overflow-hidden rounded-lg bg-ink shadow-lg active:cursor-grabbing"
              style={{
                transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * 0.04}deg)`,
                transition: drag.active ? "none" : "transform 0.25s ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.imageUrl} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <span
                className="pointer-events-none absolute left-5 top-5 rounded border-2 border-emerald-300 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-300"
                style={{ opacity: Math.min(1, Math.max(0, drag.x / SWIPE_THRESHOLD)) }}
              >
                Like
              </span>
              <span
                className="pointer-events-none absolute right-5 top-5 rounded border-2 border-rose-300 px-3 py-1 text-sm font-bold uppercase tracking-wide text-rose-300"
                style={{ opacity: Math.min(1, Math.max(0, -drag.x / SWIPE_THRESHOLD)) }}
              >
                Pass
              </span>
              <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">{current.categoryName} - {current.storeName}</p>
                <h2 className="font-display text-3xl leading-tight">{current.title}</h2>
                <p className="pt-1 text-sm font-medium">{formatAed(current.priceAed)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-5">
            <button type="button" onClick={() => vote("passed")} className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface text-xl text-ink shadow-sm transition hover:border-rose-300 hover:text-rose-500" aria-label="Pass">X</button>
            <button type="button" onClick={() => setStep("results")} disabled={!canFinish} className="rounded-full border border-line px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted transition enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-45">See my edit</button>
            <button type="button" onClick={() => vote("liked")} className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-xl text-white shadow-sm transition hover:bg-accent-deep" aria-label="Like">Heart</button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {canFinish ? "You have enough signals to see your edit whenever you are ready." : `${Math.max(minimumSwipes - completedSwipes, 0)} more choices unlock your edit.`}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="border-b border-line pb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">Your edit</p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Picked for you</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          {strongestCategories.length > 0
            ? (
              <>
                You are leaning toward{" "}
                {strongestCategories.map((category, categoryIndex) => (
                  <span key={category.slug}>
                    {categoryIndex > 0 ? ", " : null}
                    <Link
                      href={`/categories/${category.slug}`}
                      className="font-medium text-ink underline decoration-accent/50 underline-offset-4 transition hover:text-accent-deep"
                    >
                      {category.name}
                    </Link>
                  </span>
                ))}
                .
              </>
            )
            : "Keep exploring and we will shape this edit around what you love."}
        </p>
        {strongestCategories.length > 0 ? (
          <div className="mt-5 flex flex-wrap justify-center gap-5">
            {strongestCategories.map((category) => (
              <Link
                key={category.slug}
                href={`/categories/${category.slug}`}
                className="group flex w-20 flex-col items-center gap-2 text-center"
                aria-label={`Shop ${category.name}`}
              >
                <span className="h-16 w-16 overflow-hidden rounded-full border border-line bg-sand shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-accent group-hover:shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={category.image_url}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </span>
                <span className="line-clamp-2 text-xs font-medium leading-tight text-ink group-hover:text-accent-deep">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={resetTaste} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Reset my taste</button>
        </div>
      </section>

      {favouriteProducts.length > 0 ? (
        <section className="pt-9">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">You liked these</p><h2 className="mt-1 font-display text-3xl text-ink">Your favourites</h2></div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {favouriteProducts.map((product) => <ProductResultCard key={product.id} product={product} onNotForMe={markNotForMe} />)}
          </div>
        </section>
      ) : null}

      <section className="pt-10">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">Based on your choices</p><h2 className="mt-1 font-display text-3xl text-ink">Your recommended edit</h2></div>
        {recommendations.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recommendations.map((product) => <ProductResultCard key={product.id} product={product} onNotForMe={markNotForMe} />)}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-surface px-5 py-10 text-center text-sm text-muted">There are no more matching local products right now. Check back as stores add new pieces.</p>
        )}
      </section>
    </main>
  );
}
