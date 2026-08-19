"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";

/**
 * Reveals child elements with a staggered fade-up when the container
 * scrolls into view. Fires once per element, never replays.
 *
 * @param selector  CSS selector for children to animate (default: direct children via `[data-reveal]`)
 * @param stagger   ms between each child animation (default: 60)
 * @param distance  translateY start offset in px (default: 18)
 * @param duration  animation duration in ms (default: 600)
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>({
  selector = "[data-reveal]",
  stagger = 60,
  distance = 18,
  duration = 600,
  threshold = 0.15,
}: {
  selector?: string;
  stagger?: number;
  distance?: number;
  duration?: number;
  threshold?: number;
} = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>(selector);
    if (items.length === 0) return;

    items.forEach((el) => {
      el.style.opacity = "0";
      el.style.willChange = "opacity, transform";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);

          const index = Array.from(items).indexOf(entry.target as HTMLElement);
          animate(entry.target, {
            opacity: [0, 1],
            translateY: [distance, 0],
            duration,
            delay: index * stagger,
            easing: "easeOutCubic",
          });
          (entry.target as HTMLElement).style.willChange = "";
        });
      },
      { threshold },
    );

    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [selector, stagger, distance, duration, threshold]);

  return ref;
}

/**
 * Single-element fade-in-up on scroll. Lighter than the stagger variant.
 */
export function useRevealOnce<T extends HTMLElement = HTMLDivElement>({
  distance = 14,
  duration = 600,
  threshold = 0.2,
}: {
  distance?: number;
  duration?: number;
  threshold?: number;
} = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.opacity = "0";
    el.style.willChange = "opacity, transform";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        animate(el, {
          opacity: [0, 1],
          translateY: [distance, 0],
          duration,
          easing: "easeOutCubic",
        });
        el.style.willChange = "";
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [distance, duration, threshold]);

  return ref;
}
