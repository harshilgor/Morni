"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const AUTOPLAY_MS = 2000;
const CARD_GAP = 16;

const OCCASIONS = [
  {
    title: "Wedding",
    subtitle: "Statement lehengas and festive sets for the big day.",
    href: "/categories/lehengas",
    image:
      "https://images.unsplash.com/photo-1654764746225-e63f5e90facd?w=1200&q=85",
    tone: "#f2b7c8",
  },
  {
    title: "Party night",
    subtitle: "Bold silhouettes for dinners, birthdays, and nights out.",
    href: "/categories/party-wear",
    image:
      "https://images.unsplash.com/photo-1716504628204-47f2df8d2634?w=1200&q=85",
    tone: "#f0c07a",
  },
  {
    title: "Office",
    subtitle: "Polished workwear kurtis, delivered within the hour.",
    href: "/categories/kurtis",
    image:
      "https://images.unsplash.com/photo-1769063382610-6be8acb7552f?w=1200&q=85",
    tone: "#9fd4cc",
  },
  {
    title: "Eid & festive",
    subtitle: "Shararas and suits with celebration-ready embroidery.",
    href: "/categories/shararas",
    image:
      "https://images.unsplash.com/photo-1724412665971-114bd351a42d?w=1200&q=85",
    tone: "#e7c39b",
  },
  {
    title: "Gifting",
    subtitle: "Jewellery and accessories that always land well.",
    href: "/categories/jewelry",
    image:
      "https://images.unsplash.com/photo-1758995116383-f51775896add?w=1200&q=85",
    tone: "#f4d58d",
  },
  {
    title: "Brunch & everyday",
    subtitle: "Easy casual pieces for weekends and coffee runs.",
    href: "/categories/casual-wear",
    image:
      "https://images.unsplash.com/photo-1763559301384-32971cd65ccb?w=1200&q=85",
    tone: "#f0b9a8",
  },
];

export function HomeCollections() {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      const card = track.firstElementChild as HTMLElement | null;
      if (!card) return;

      const atEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + card.offsetWidth + CARD_GAP,
        behavior: "smooth",
      });
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="w-full py-12">
      <div className="mx-auto mb-6 max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl text-ink">Shop by occasion</h2>
        <p className="mt-1 text-sm text-muted">
          Curated edits from local UAE boutiques, for wherever you are headed.
        </p>
      </div>
      <div
        ref={trackRef}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
        onFocusCapture={() => (pausedRef.current = true)}
        onBlurCapture={() => (pausedRef.current = false)}
        onTouchStart={() => (pausedRef.current = true)}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {OCCASIONS.map((occasion) => (
          <Link
            key={occasion.title}
            href={occasion.href}
            className="group relative h-[400px] w-[280px] shrink-0 snap-start overflow-hidden rounded-3xl sm:w-[330px] lg:w-[380px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={occasion.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: occasion.tone }}
              >
                Occasion
              </p>
              <h3 className="mt-1.5 font-display text-2xl leading-tight text-white">
                {occasion.title}
              </h3>
              <p className="mt-1.5 text-xs text-white/85">
                {occasion.subtitle}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                Explore
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
