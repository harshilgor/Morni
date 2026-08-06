"use client";

import Link from "next/link";
import { MouseDragScroll } from "@/components/mouse-drag-scroll";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
    eyebrow: "Budget picks",
    title: "Under 99 DHS",
    subtitle: "Looks that don’t break the budget",
    href: "/categories",
    image:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1400&q=80",
    accent: "#f5d76e",
  },
  {
    id: "flat-50",
    eyebrow: "Hot deal",
    title: "Flat 50%",
    subtitle: "Half off select styles today",
    href: "/categories/party-wear",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1400&q=80",
    accent: "#ff8fab",
  },
  {
    id: "bogo",
    eyebrow: "Limited offer",
    title: "Buy 1 get 1",
    subtitle: "Double the looks, same checkout",
    href: "/categories/kurtis",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&q=80",
    accent: "#ffb4a2",
  },
  {
    id: "clearance",
    eyebrow: "Last chance",
    title: "Clearance sale",
    subtitle: "Final markdowns before they’re gone",
    href: "/categories",
    image:
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1400&q=80",
    accent: "#f4a261",
  },
  {
    id: "premium",
    eyebrow: "Elevated edit",
    title: "Premium collection",
    subtitle: "Statement pieces worth the keep",
    href: "/categories/lehengas",
    image:
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1400&q=80",
    accent: "#c9a87c",
  },
];

const AUTOPLAY_MS = 4000;
const RESUME_AFTER_INTERACT_MS = 6000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function HeroCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const activeRef = useRef(0);
  const interactingRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(true);
  const reduceMotion = usePrefersReducedMotion();

  const setActiveIndex = useCallback((index: number) => {
    activeRef.current = index;
    setActive(index);
  }, []);

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
      setActiveIndex(index);
    },
    [setActiveIndex],
  );

  const pauseForInteraction = useCallback(() => {
    interactingRef.current = true;
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      interactingRef.current = false;
    }, RESUME_AFTER_INTERACT_MS);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.35),
      { threshold: [0, 0.35, 0.6] },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

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
      setActiveIndex(closest);
    };

    const onPointerDown = () => pauseForInteraction();
    const onWheel = () => pauseForInteraction();

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: true });
    onScroll();

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [pauseForInteraction, setActiveIndex]);

  useEffect(() => {
    if (reduceMotion || !inView) return;

    const id = window.setInterval(() => {
      if (interactingRef.current) return;
      const next = (activeRef.current + 1) % SLIDES.length;
      scrollToIndex(next);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(id);
  }, [inView, reduceMotion, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="animate-rise relative w-full pt-3 sm:pt-5"
      aria-roledescription="carousel"
      aria-label="Featured collections"
    >
      <MouseDragScroll
        scrollRef={scrollerRef}
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
      </MouseDragScroll>

      <div className="mt-4 flex items-center justify-center gap-2 pb-7 sm:pb-9">
        {SLIDES.map((slide, index) => {
          const isActive = index === active;
          return (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${index + 1}: ${slide.title}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() => {
                pauseForInteraction();
                scrollToIndex(index);
              }}
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
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}
