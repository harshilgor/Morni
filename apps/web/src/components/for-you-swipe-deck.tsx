"use client";

import Link from "next/link";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ForYouCard, TasteProfile } from "@/lib/for-you";
import { vibeScoreForCard } from "@/lib/for-you";
import { formatAed } from "@/lib/format";

const SWIPE_THRESHOLD = 55;
const EXIT_X = 280;

const EXIT_EASE = [0.32, 0.72, 0, 1] as const;
const EXIT_MS = 0.14;
const STACK_MS = 0.12;
const SNAP_SPRING = { type: "spring" as const, stiffness: 900, damping: 48 };

function haptic(decision: "liked" | "passed") {
  navigator.vibrate?.(decision === "liked" ? [6, 24, 6] : 8);
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SwipeProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all duration-100 ${
              index < current ? "w-5 bg-accent" : index === current ? "w-5 bg-accent-deep" : "w-1.5 bg-line"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        {Math.min(current + 1, total)} of {total}
      </p>
    </div>
  );
}

function SwipeCardFace({
  card,
  vibe,
  likeOpacity,
  passOpacity,
}: {
  card: ForYouCard;
  vibe: number;
  likeOpacity?: ReturnType<typeof useTransform<number, number>>;
  passOpacity?: ReturnType<typeof useTransform<number, number>>;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.imageUrl}
        alt=""
        className="pointer-events-none h-full w-full object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/5" />

      {likeOpacity ? (
        <>
          <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute inset-0 bg-accent/20" />
          <motion.div
            style={{ opacity: likeOpacity }}
            className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
          >
            <HeartIcon className="h-16 w-16 text-white drop-shadow-lg" />
          </motion.div>
        </>
      ) : null}

      {passOpacity ? (
        <>
          <motion.div style={{ opacity: passOpacity }} className="pointer-events-none absolute inset-0 bg-ink/25" />
          <motion.div
            style={{ opacity: passOpacity }}
            className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
          >
            <CloseIcon className="h-14 w-14 text-white drop-shadow-lg" />
          </motion.div>
        </>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        Your vibe {vibe}%
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5">
        <div className="flex justify-center">
          <span className="rounded-full bg-white/95 px-4 py-1.5 text-sm font-semibold text-ink shadow-sm">
            {card.categoryName}
          </span>
        </div>
        <Link
          href={`/stores/${card.storeSlug}/products/${card.productId}`}
          className="pointer-events-auto block text-center"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <h3 className="line-clamp-2 text-lg font-medium leading-snug text-white">{card.title}</h3>
          <p className="mt-1 text-sm font-medium text-white/85">{formatAed(card.priceAed)}</p>
          <p className="mt-0.5 text-xs text-white/65">{card.storeName}</p>
        </Link>
      </div>
    </>
  );
}

function ExitingCard({
  card,
  startX,
  targetX,
  velocity,
  vibe,
  onComplete,
}: {
  card: ForYouCard;
  startX: number;
  targetX: number;
  velocity: number;
  vibe: number;
  onComplete: () => void;
}) {
  const x = useMotionValue(startX);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);

  useEffect(() => {
    void animate(x, targetX, {
      type: "tween",
      duration: EXIT_MS,
      ease: EXIT_EASE,
      velocity,
    }).then(onComplete);
  }, [onComplete, targetX, velocity, x]);

  return (
    <motion.div
      style={{ x, rotate, zIndex: 20 }}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] bg-ink shadow-[0_24px_60px_-18px_rgba(28,20,24,0.45)]"
      aria-hidden
    >
      <SwipeCardFace card={card} vibe={vibe} />
    </motion.div>
  );
}

function SwipeActions({
  onPass,
  onLike,
  likeScale,
  passScale,
}: {
  onPass: () => void;
  onLike: () => void;
  likeScale: ReturnType<typeof useTransform<number, number>>;
  passScale: ReturnType<typeof useTransform<number, number>>;
}) {
  return (
    <div className="flex items-center justify-center gap-10 pb-1 pt-2">
      <motion.button
        type="button"
        onClick={onPass}
        style={{ scale: passScale }}
        whileTap={{ scale: 0.88 }}
        transition={{ duration: 0.08 }}
        className="flex h-16 w-16 items-center justify-center rounded-full border border-line/80 bg-surface text-ink shadow-[0_8px_24px_-12px_rgba(28,20,24,0.35)]"
        aria-label="Pass this piece"
      >
        <CloseIcon className="h-7 w-7" />
      </motion.button>
      <motion.button
        type="button"
        onClick={onLike}
        style={{ scale: likeScale }}
        whileTap={{ scale: 0.88 }}
        transition={{ duration: 0.08 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_28px_-10px_rgba(196,91,122,0.65)]"
        aria-label="Like this piece"
      >
        <HeartIcon className="h-7 w-7" />
      </motion.button>
    </div>
  );
}

export function ForYouSwipeDeck({
  deck,
  activeIndex,
  profile,
  completedSwipes,
  minimumSwipes,
  canFinish,
  onVote,
  onFinish,
}: {
  deck: ForYouCard[];
  activeIndex: number;
  profile: TasteProfile;
  completedSwipes: number;
  minimumSwipes: number;
  canFinish: boolean;
  onVote: (decision: "liked" | "passed") => void;
  onFinish: () => void;
}) {
  const current = deck[activeIndex] ?? null;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [0, 50], [0, 1]);
  const passOpacity = useTransform(x, [-50, 0], [1, 0]);
  const likeScale = useTransform(x, [0, 60, 100], [1, 1.06, 1.12]);
  const passScale = useTransform(x, [-100, -60, 0], [1.12, 1.06, 1]);
  const busyRef = useRef(false);
  const [exitingCards, setExitingCards] = useState<
    Array<{
      key: string;
      card: ForYouCard;
      startX: number;
      targetX: number;
      velocity: number;
      vibe: number;
    }>
  >([]);

  useEffect(() => {
    x.set(0);
  }, [activeIndex, x]);

  const removeExit = useCallback((key: string) => {
    setExitingCards((cards) => cards.filter((entry) => entry.key !== key));
  }, []);

  const commitVote = useCallback(
    (decision: "liked" | "passed", velocity = 0) => {
      if (busyRef.current || !current) return;
      busyRef.current = true;
      haptic(decision);

      const startX = x.get();
      const targetX = decision === "liked" ? EXIT_X : -EXIT_X;
      const exitKey = `${current.id}-${Date.now()}`;

      setExitingCards((cards) => [
        ...cards,
        {
          key: exitKey,
          card: current,
          startX,
          targetX,
          velocity,
          vibe: vibeScoreForCard(profile, current.categorySlug),
        },
      ]);

      x.set(0);
      onVote(decision);
      busyRef.current = false;
    },
    [current, onVote, profile, x],
  );

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) commitVote("liked", info.velocity.x);
    else if (info.offset.x < -SWIPE_THRESHOLD) commitVote("passed", info.velocity.x);
    else animate(x, 0, { ...SNAP_SPRING, velocity: info.velocity.x });
  };

  if (!current) return null;

  const vibe = vibeScoreForCard(profile, current.categorySlug);

  return (
    <section
      id="for-you"
      className="scroll-mt-24 border-y border-line/70 bg-[#fff9f7] py-8 sm:py-10"
    >
      <div className="mx-auto flex max-w-md flex-col px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">Your edit</p>
          <h2 className="mt-1 font-display text-2xl text-ink sm:text-3xl">What feels like you?</h2>
          <div className="mt-4">
            <SwipeProgress current={completedSwipes} total={deck.length} />
          </div>
        </div>

        <div className="relative mx-auto mt-6 h-[min(68dvh,560px)] w-full max-w-[min(100%,380px)] touch-none select-none">
          {deck.slice(activeIndex + 1, activeIndex + 3).map((card, cardIndex) => (
            <motion.div
              key={card.id}
              className="absolute inset-0 overflow-hidden rounded-[28px] bg-sand"
              initial={false}
              animate={{
                scale: 0.96 - cardIndex * 0.03,
                y: (cardIndex + 1) * 8,
                opacity: 0.85 - cardIndex * 0.15,
              }}
              transition={{ duration: STACK_MS, ease: EXIT_EASE }}
              style={{ zIndex: 1 - cardIndex }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            </motion.div>
          ))}

          <motion.div
            key={current.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.45}
            dragMomentum={false}
            style={{ x, rotate, zIndex: 10 }}
            onDragEnd={onDragEnd}
            initial={false}
            className="absolute inset-0 cursor-grab overflow-hidden rounded-[28px] bg-ink shadow-[0_24px_60px_-18px_rgba(28,20,24,0.45)] active:cursor-grabbing"
            role="img"
            aria-label={`${current.title}. Swipe right to like or left to pass.`}
          >
            <SwipeCardFace card={current} vibe={vibe} likeOpacity={likeOpacity} passOpacity={passOpacity} />
          </motion.div>

          {exitingCards.map((entry) => (
            <ExitingCard
              key={entry.key}
              card={entry.card}
              startX={entry.startX}
              targetX={entry.targetX}
              velocity={entry.velocity}
              vibe={entry.vibe}
              onComplete={() => removeExit(entry.key)}
            />
          ))}
        </div>

        <SwipeActions
          onPass={() => commitVote("passed")}
          onLike={() => commitVote("liked")}
          likeScale={likeScale}
          passScale={passScale}
        />

        <div className="mt-3 text-center">
          {canFinish ? (
            <button
              type="button"
              onClick={onFinish}
              className="text-sm font-medium text-accent-deep underline-offset-4 hover:underline"
            >
              See my edit
            </button>
          ) : (
            <p className="text-xs text-muted">
              {Math.max(minimumSwipes - completedSwipes, 0)} more choices unlock your edit
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
