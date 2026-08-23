"use client";

export const FOR_YOU_INTRO_SEEN_KEY = "morni-for-you-intro-seen";

export function hasSeenForYouIntro() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(FOR_YOU_INTRO_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markForYouIntroSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FOR_YOU_INTRO_SEEN_KEY, "1");
  } catch {
    // Ignore private-mode / quota failures — intro simply may reappear.
  }
}
