"use client";

import Image from "next/image";
import Link from "next/link";
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
  cta: string;
  href: string;
  image: string;
  imagePosition?: string;
  titleTone?: "light" | "sun";
  visualOnly?: boolean;
};

const SLIDES: Slide[] = [
  {
    id: "under-99",
    eyebrow: "Under AED 99",
    title: "Under AED 99",
    subtitle: "Everyday boutique finds under AED 99.",
    cta: "Shop under AED 99",
    href: "/under-99",
    image: "/hero/under-99.jpeg",
    visualOnly: true,
  },
  {
    id: "up-to-50-off",
    eyebrow: "Limited-time sale",
    title: "Up to 50% off",
    subtitle: "Special reductions from boutiques near you.",
    cta: "Shop the sale",
    href: "/clearance",
    image: "/hero/up-to-50-off.jpeg",
    visualOnly: true,
  },
  {
    id: "premium-collection",
    eyebrow: "Premium collection",
    title: "Premium collection",
    subtitle: "Elevated occasionwear from UAE boutiques.",
    cta: "Explore premium pieces",
    href: "/search?min=500",
    image: "/hero/premium-collection.jpeg",
    visualOnly: true,
  },
  {
    id: "under-149",
    eyebrow: "Under AED 149",
    title: "Under AED 149",
    subtitle: "Boutique looks at an easy price point.",
    cta: "Shop under AED 149",
    href: "/under-149",
    image: "/hero/under-149.jpeg",
    visualOnly: true,
  },
  {
    id: "brunch-everyday",
    eyebrow: "Weekend dressing",
    title: "Brunch & everyday",
    subtitle: "Easy outfits for every moment.",
    cta: "Shop brunch & everyday",
    href: "/categories/casual-wear",
    image: "/hero/brunch-everyday.png",
    visualOnly: true,
  },
  {
    id: "gifting-edit",
    eyebrow: "A thoughtful gesture",
    title: "The gifting edit",
    subtitle: "Celebrate beautifully with a look they will keep.",
    cta: "Discover gifting",
    href: "/categories/jewelry",
    image: "/hero/gifting-edit.png",
    visualOnly: true,
  },
  {
    id: "office-edit",
    eyebrow: "The work edit",
    title: "Polished days",
    subtitle: "Modern officewear, ready for your next meeting.",
    cta: "Shop officewear",
    href: "/categories/office-wear",
    image: "/categories/office-wear.webp",
    imagePosition: "center 30%",
  },
  {
    id: "wedding-edit",
    eyebrow: "For the celebrations",
    title: "Wedding season",
    subtitle: "Statement lehengas for every invitation on your calendar.",
    cta: "Shop wedding looks",
    href: "/categories/lehengas",
    image: "/categories/lehengas.webp",
    imagePosition: "center top",
  },
];

const AUTOPLAY_MS = 3600;
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
      const left = slide.offsetLeft - (scroller.clientWidth - slide.clientWidth) / 2;
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
      if (scroller.scrollLeft <= 1) {
        setActiveIndex(0);
        return;
      }

      const slides = Array.from(
        scroller.querySelectorAll<HTMLElement>("[data-carousel-slide]"),
      );
      if (slides.length === 0) return;
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let closest = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      slides.forEach((slide, index) => {
        const midpoint = slide.offsetLeft + slide.clientWidth / 2;
        const distance = Math.abs(center - midpoint);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
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

    const intervalId = window.setInterval(() => {
      if (interactingRef.current) return;
      const next = (activeRef.current + 1) % SLIDES.length;
      scrollToIndex(next, next === 0 ? "auto" : "smooth");
    }, AUTOPLAY_MS);

    return () => window.clearInterval(intervalId);
  }, [inView, reduceMotion, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="animate-rise relative w-full bg-white py-3 sm:py-4"
      aria-roledescription="carousel"
      aria-label="Featured Morni edits"
    >
      <div
        ref={scrollerRef}
        className="relative flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pl-3 pr-0 pb-1 sm:gap-3 sm:pl-4 sm:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >

        {SLIDES.map((slide, index) => (
          <Link
            key={slide.id}
            href={slide.href}
            data-carousel-slide
            className="group relative h-[min(64vh,560px)] w-[88vw] shrink-0 snap-center overflow-hidden bg-ink sm:h-[min(76vh,700px)] sm:w-[min(58vw,620px)] lg:w-[min(46vw,720px)]"
            aria-label={`${slide.title}. ${slide.subtitle}`}
            aria-current={index === active ? "true" : undefined}
          >
            <Image
              src={slide.image}
              alt=""
              fill
              priority={index === 0}
              sizes="(max-width: 639px) 88vw, (max-width: 1023px) 58vw, 46vw"
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
              style={{ objectPosition: slide.imagePosition ?? "center" }}
            />
            {!slide.visualOnly ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/18 to-black/5" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-5 sm:p-7 lg:p-9">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80 sm:text-xs">
                    {slide.eyebrow}
                  </p>
                  <h2
                    className={`mt-2 max-w-[8ch] font-sans text-[2.8rem] font-semibold uppercase leading-[0.83] tracking-[-0.07em] sm:text-[clamp(3.6rem,6vw,6.8rem)] ${
                      slide.titleTone === "sun" ? "text-[#f4ed68]" : "text-white"
                    }`}
                  >
                    {slide.title}
                  </h2>
                  <p className="mt-4 max-w-[22rem] text-sm leading-relaxed text-white/88 sm:text-base">
                    {slide.subtitle}
                  </p>
                  <span className="mt-5 rounded-full border border-white/75 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition group-hover:bg-white group-hover:text-ink sm:px-5 sm:text-[11px]">
                    {slide.cta}
                  </span>
                </div>
              </>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-7 z-10 flex items-center justify-center gap-2 sm:bottom-8">
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
                isActive ? "w-7 bg-white" : "w-1.5 bg-white/55 hover:bg-white"
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
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}
