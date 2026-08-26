"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { useLocation } from "@/lib/location";
import { useRecentlyViewed } from "@/lib/recently-viewed";

/** Restores browser-only shopper state after the initial React hydration. */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    void useLocation.persist.rehydrate();
    void useRecentlyViewed.persist.rehydrate();
  }, []);

  return null;
}
