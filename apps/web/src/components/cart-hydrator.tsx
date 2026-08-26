"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

/** Restores the local cart only after the initial React hydration completes. */
export function CartHydrator() {
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);

  return null;
}
