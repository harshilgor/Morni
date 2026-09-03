"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";

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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5l1.4 5.4L18.8 9.3l-5.4 1.4L12 16.1l-1.4-5.4L5.2 9.3l5.4-1.4L12 2.5zM18.5 14.2l.7 2.6 2.6.7-2.6.7-.7 2.6-.7-2.6-2.6-.7 2.6-.7.7-2.6zM5.8 15.5l.55 2.05L8.4 18.1l-2.05.55-.55 2.05-.55-2.05-2.05-.55 2.05-.55.55-2.05z" />
    </svg>
  );
}

const STEPS = [
  {
    icon: HeartIcon,
    title: "Like",
    body: "Heart pieces that feel like you.",
    tone: "text-accent",
  },
  {
    icon: CloseIcon,
    title: "Pass",
    body: "Skip looks that aren’t your vibe.",
    tone: "text-ink",
  },
  {
    icon: SparkleIcon,
    title: "Your edit",
    body: "Unlock a personalized pick from local stores.",
    tone: "text-accent-deep",
  },
] as const;

export function ForYouIntroOverlay({
  open,
  onStart,
  onSkip,
}: {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const startRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => startRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onSkip, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="for-you-intro"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+5rem)] sm:items-center sm:px-6 sm:pb-6"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[6px]" aria-hidden />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 32 }
            }
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/60 bg-[#fff9f7]/95 p-6 shadow-[0_28px_70px_-28px_rgba(28,20,24,0.55)] sm:p-7"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
              For you
            </p>
            <h2 id={titleId} className="mt-2 font-display text-3xl text-ink sm:text-[2rem]">
              Find your edit
            </h2>
            <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-muted">
              Swipe through local looks you love. We’ll learn your style and build a personalized
              edit just for you.
            </p>

            <ul className="mt-6 space-y-3">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="flex items-start gap-3 rounded-2xl border border-line/80 bg-surface/80 px-3.5 py-3"
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${step.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{step.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 space-y-3">
              <button
                ref={startRef}
                type="button"
                onClick={onStart}
                className="flex w-full items-center justify-center rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-14px_rgba(196,91,122,0.7)] transition hover:bg-accent-deep"
              >
                Start swiping
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
