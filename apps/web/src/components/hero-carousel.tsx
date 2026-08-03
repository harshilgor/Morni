"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  image: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    id: "under-99",
    eyebrow: "Everyday finds",
    title: "Clothes under 99 AED",
    subtitle: "Looks that don’t break the budget",
    href: "/categories",
    image:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1400&q=80",
    accent: "#f5d76e",
  },
  {
    id: "ethnic",
    eyebrow: "Festive edit",
    title: "Indian ethnic wear",
    subtitle: "Lehengas, kurtis & occasion looks",
    href: "/categories/lehengas",
    image:
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1400&q=80",
    accent: "#f4a5bd",
  },
  {
    id: "modern",
    eyebrow: "City ready",
    title: "Modern wear",
    subtitle: "Clean silhouettes for now",
    href: "/categories/indo-western",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1400&q=80",
    accent: "#9fd4c8",
  },
];

const AUTOPLAY_MS = 5200;

export function HeroCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const slide = scroller.querySelectorAll<HTMLElement>("[data-carousel-slide]")[
        index
      ];
      if (!slide) return;
      const left =
        slide.offsetLeft - (scroller.clientWidth - slide.clientWidth) / 2;
      scroller.scrollTo({ left: Math.max(0, left), behavior });
    },
    [],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const slides = Array.from(
        scroller.querySelectorAll<HTMLElement>("[data-carousel-slide]"),
      );
      if (slides.length === 0) return;
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let closest = 0;
      let closestDist = Number.POSITIVE_INFINITY;
      slides.forEach((slide, i) => {
        const mid = slide.offsetLeft + slide.clientWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      setActive(closest);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = window.setInterval(() => {
      const next = (active + 1) % SLIDES.length;
      scrollToIndex(next);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [active, paused, reduceMotion, scrollToIndex]);

  return (
    <section
      className="animate-rise relative w-full pt-3 sm:pt-5"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div
        ref={scrollerRef}
        className="relative flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-3 pb-1 sm:gap-3 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((slide, index) => (
          <Link
            key={slide.id}
            href={slide.href}
            data-carousel-slide
            className="group relative h-[min(68vh,560px)] w-[min(88vw,440px)] shrink-0 snap-center overflow-hidden rounded-[1.25rem] bg-ink sm:h-[min(72vh,620px)] sm:w-[min(78vw,540px)] sm:rounded-[1.6rem] lg:w-[min(62vw,580px)]"
            aria-label={`${slide.title}. ${slide.subtitle}`}
            aria-current={index === active ? "true" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top transition duration-700 ease-out group-hover:scale-[1.045]"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/15" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-5 sm:p-8">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.3em] sm:text-xs"
                style={{ color: slide.accent }}
              >
                {slide.eyebrow}
              </p>
              <h2 className="mt-2 max-w-[14ch] font-display text-[2.15rem] leading-[0.92] text-white sm:text-5xl">
                {slide.title}
              </h2>
              <p className="mt-2.5 max-w-[18rem] text-sm text-white/88 sm:text-base">
                {slide.subtitle}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/18 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md transition group-hover:bg-white/28">
                Shop now
                <span aria-hidden>→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 pb-7 sm:pb-9">
        {SLIDES.map((slide, index) => {
          const isActive = index === active;
          return (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${index + 1}: ${slide.title}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() => scrollToIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive ? "w-7 bg-ink" : "w-1.5 bg-ink/25 hover:bg-ink/45"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
