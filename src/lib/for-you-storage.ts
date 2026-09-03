"use client";

import {
  emptyTasteProfile,
  isTasteProfile,
  type TasteProfile,
} from "@/lib/for-you";

export const FOR_YOU_STORAGE_KEY = "morni-for-you-taste";

export type StoredForYouTaste = {
  profile: TasteProfile;
  dismissedProductIds: string[];
};

export function readStoredForYouTaste(): StoredForYouTaste {
  if (typeof window === "undefined") {
    return { profile: emptyTasteProfile(), dismissedProductIds: [] };
  }
  try {
    const raw = window.localStorage.getItem(FOR_YOU_STORAGE_KEY);
    if (!raw) return { profile: emptyTasteProfile(), dismissedProductIds: [] };
    const value = JSON.parse(raw) as StoredForYouTaste;
    if (!isTasteProfile(value.profile)) {
      window.localStorage.removeItem(FOR_YOU_STORAGE_KEY);
      return { profile: emptyTasteProfile(), dismissedProductIds: [] };
    }
    return {
      profile: value.profile,
      dismissedProductIds: value.dismissedProductIds ?? [],
    };
  } catch {
    return { profile: emptyTasteProfile(), dismissedProductIds: [] };
  }
}

export function storeForYouTaste(value: StoredForYouTaste) {
  window.localStorage.setItem(FOR_YOU_STORAGE_KEY, JSON.stringify(value));
}
