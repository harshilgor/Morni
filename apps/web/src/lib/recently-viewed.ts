"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RecentlyViewedItem = {
  id: string;
  title: string;
  price_aed: number;
  compare_at_price_aed?: number | null;
  image_url?: string | null;
  href: string;
  storeName?: string;
  viewedAt: number;
};

type RecentlyViewedState = {
  items: RecentlyViewedItem[];
  add: (item: Omit<RecentlyViewedItem, "viewedAt">) => void;
};

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const next = [
          { ...item, viewedAt: Date.now() },
          ...get().items.filter((x) => x.id !== item.id),
        ].slice(0, 12);
        set({ items: next });
      },
    }),
    // This rail can render on server pages, so defer browser storage until
    // after React hydration to keep the initial markup deterministic.
    { name: "morni-recently-viewed", skipHydration: true },
  ),
);
