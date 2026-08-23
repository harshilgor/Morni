"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ForYouBackButton } from "@/components/for-you-back-button";
import { ForYouIntroOverlay } from "@/components/for-you-intro-overlay";
import { ForYouSwipeDeck } from "@/components/for-you-swipe-deck";
import type { BrowseCategory } from "@/lib/browse-categories";
import {
  applyTasteSwipe,
  buildUniversalTasteDeck,
  emptyTasteProfile,
  MIN_SWIPES_FOR_RESULTS,
  recommendForYouProducts,
  topCategories,
  type ForYouProduct,
  type TasteProfile,
  type TasteSwipe,
} from "@/lib/for-you";
import { formatAed } from "@/lib/format";
import {
  hasSeenForYouIntro,
  markForYouIntroSeen,
} from "@/lib/for-you-intro-storage";
import {
  FOR_YOU_STORAGE_KEY,
  readStoredForYouTaste,
  storeForYouTaste,
} from "@/lib/for-you-storage";
import { useLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/client";

type Step = "test" | "results";

function stepFromProfile(profile: TasteProfile, minimumSwipes: number): Step {
  return profile.likes + profile.passes >= minimumSwipes ? "results" : "test";
}

function ProductResultCard({
  product,
  onNotForMe,
}: {
  product: ForYouProduct;
  onNotForMe: (productId: string) => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group overflow-hidden rounded-2xl border border-line bg-surface"
    >
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
    </motion.article>
  );
}

function ForYouResults({
  favouriteProducts,
  recommendations,
  strongestCategories,
  hasLikes,
  onReset,
  onNotForMe,
}: {
  favouriteProducts: ForYouProduct[];
  recommendations: ForYouProduct[];
  strongestCategories: BrowseCategory[];
  hasLikes: boolean;
  onReset: () => void;
  onNotForMe: (productId: string) => void;
}) {
  const introCopy = !hasLikes
    ? "You passed on everything this round. Like a few pieces and we will build an edit around them."
    : strongestCategories.length > 0
      ? null
      : "We are shaping this edit around the pieces you liked.";

  return (
    <section
      id="for-you"
      className="bg-[#fff9f7] pb-10 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:pb-12"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 620, damping: 36 }}
          className="border-b border-line/80 pb-8 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">Your edit</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Picked for you</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
            {strongestCategories.length > 0 && hasLikes ? (
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
            ) : (
              introCopy
            )}
          </p>
          {strongestCategories.length > 0 && hasLikes ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {strongestCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:border-accent hover:text-accent-deep"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={category.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onReset}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Reset my taste
            </button>
          </div>
        </motion.div>

        {favouriteProducts.length > 0 ? (
          <section className="pt-9">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">You liked these</p>
              <h3 className="mt-1 font-display text-2xl text-ink sm:text-3xl">Your favourites</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {favouriteProducts.map((product) => (
                <ProductResultCard key={product.id} product={product} onNotForMe={onNotForMe} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="pt-10">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
              Based on your choices
            </p>
            <h3 className="mt-1 font-display text-2xl text-ink sm:text-3xl">Your recommended edit</h3>
          </div>
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recommendations.map((product) => (
                <ProductResultCard key={product.id} product={product} onNotForMe={onNotForMe} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-line bg-surface px-5 py-10 text-center text-sm text-muted">
              {!hasLikes
                ? "No personalized picks yet — like at least one piece and we will recommend similar styles."
                : "There are no more matching local products right now. Check back as stores add new pieces."}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

export function ForYouExperience({
  categories,
  products,
  initialProfile,
  initialDismissedProductIds = [],
  initialShopperId = null,
  hasServerTaste = false,
}: {
  categories: BrowseCategory[];
  products: ForYouProduct[];
  initialProfile?: TasteProfile;
  initialDismissedProductIds?: string[];
  initialShopperId?: string | null;
  hasServerTaste?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const emirate = useLocation((state) => state.emirate);
  const seedProfile = initialProfile ?? emptyTasteProfile();
  const seedHasTaste = seedProfile.likes + seedProfile.passes > 0;
  const [profile, setProfile] = useState<TasteProfile>(seedProfile);
  const [dismissedProductIds, setDismissedProductIds] = useState<string[]>(initialDismissedProductIds);
  const [index, setIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(false);
  const shopperId = initialShopperId;
  const sessionIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const hydratedLocalRef = useRef(false);
  const introHydratedRef = useRef(false);

  const localProducts = useMemo(
    () => products.filter((product) => !emirate || product.stores.emirate === emirate),
    [emirate, products],
  );
  const deck = useMemo(
    () => buildUniversalTasteDeck(localProducts, categories),
    [categories, localProducts],
  );
  const activeIndex = Math.min(index, Math.max(deck.length - 1, 0));
  const minimumSwipes = Math.min(MIN_SWIPES_FOR_RESULTS, deck.length);
  const [step, setStep] = useState<Step>(() => stepFromProfile(seedProfile, minimumSwipes));
  const completedSwipes = profile.likes + profile.passes;
  const canFinish = completedSwipes >= minimumSwipes;

  // Restore guest taste (and signed-in empty accounts) before paint — no loading screen.
  useLayoutEffect(() => {
    if (hydratedLocalRef.current) return;
    hydratedLocalRef.current = true;

    const stored = readStoredForYouTaste();

    if (hasServerTaste && seedHasTaste) {
      if (stored.dismissedProductIds.length) {
        setDismissedProductIds((current) => [
          ...new Set([...current, ...stored.dismissedProductIds]),
        ]);
      }
      return;
    }

    if (stored.profile.likes + stored.profile.passes > 0 || stored.dismissedProductIds.length > 0) {
      const nextProfile = seedHasTaste ? seedProfile : stored.profile;
      setProfile(nextProfile);
      setDismissedProductIds([
        ...new Set([...initialDismissedProductIds, ...stored.dismissedProductIds]),
      ]);
      setStep(stepFromProfile(nextProfile, minimumSwipes));
    }
  }, [hasServerTaste, initialDismissedProductIds, minimumSwipes, seedHasTaste, seedProfile]);

  // First-visit intro (or force with ?intro=1 for local preview).
  useLayoutEffect(() => {
    if (introHydratedRef.current) return;
    introHydratedRef.current = true;

    const forceIntro =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("intro") === "1";

    if (forceIntro) {
      setStep("test");
      setShowIntro(true);
      return;
    }

    if (!hasSeenForYouIntro()) {
      setShowIntro(true);
    }
  }, []);

  const dismissIntro = useCallback(() => {
    markForYouIntroSeen();
    setShowIntro(false);
  }, []);

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
      ).then(({ data }) => {
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
      const current = deck[activeIndex];
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
      saveSwipe(swipe, nextProfile);

      if (activeIndex + 1 >= deck.length) {
        setStep("results");
      } else {
        setIndex(activeIndex + 1);
      }
    },
    [activeIndex, deck, profile, saveSwipe],
  );

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

  const finishEarly = useCallback(() => {
    setStep("results");
  }, []);

  const favouriteProducts = useMemo(
    () => localProducts.filter((product) => profile.likedProductIds.includes(product.id)),
    [localProducts, profile.likedProductIds],
  );
  const recommendations = useMemo(
    () => recommendForYouProducts(localProducts, categories, profile, dismissedProductIds),
    [categories, dismissedProductIds, localProducts, profile],
  );
  const strongestCategories = topCategories(profile, categories);

  if (deck.length === 0) {
    return (
      <div className="relative min-h-dvh bg-[#fff9f7]">
        <ForYouBackButton />
        <section
          id="for-you"
          className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[calc(env(safe-area-inset-top)+4rem)] text-center"
        >
          <h2 className="font-display text-3xl text-ink">Your edit is on its way</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            We need a little more available local inventory before we can build your taste test.
          </p>
        </section>
      </div>
    );
  }

  if (step === "test") {
    return (
      <div className="relative min-h-dvh bg-[#fff9f7]">
        <ForYouBackButton />
        <ForYouSwipeDeck
          deck={deck}
          activeIndex={activeIndex}
          completedSwipes={completedSwipes}
          minimumSwipes={minimumSwipes}
          canFinish={canFinish}
          onVote={vote}
          onFinish={finishEarly}
        />
        <ForYouIntroOverlay open={showIntro} onStart={dismissIntro} onSkip={dismissIntro} />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-[#fff9f7]">
      <ForYouBackButton />
      <ForYouResults
        favouriteProducts={favouriteProducts}
        recommendations={recommendations}
        strongestCategories={strongestCategories}
        hasLikes={profile.likes > 0}
        onReset={resetTaste}
        onNotForMe={markNotForMe}
      />
    </div>
  );
}
