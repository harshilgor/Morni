"use client";

import type {
  CartSnapshotItem,
  MarketplaceEventInput,
  MarketplaceEventName,
} from "@/lib/analytics/events";

const ANON_KEY = "morni-analytics-anon";
const SESSION_KEY = "morni-analytics-session";
const ONCE_KEY = "morni-analytics-once";
const FLUSH_MS = 1800;
const MAX_QUEUE = 40;

type QueuedEvent = MarketplaceEventInput & { occurred_at: string };

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cartTimer: ReturnType<typeof setTimeout> | null = null;
let sessionBootstrapped = false;

function randomId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function readOrCreate(key: string, prefix: string) {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
    const next = randomId(prefix);
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return randomId(prefix);
  }
}

export function getAnalyticsAnonymousId() {
  return readOrCreate(ANON_KEY, "anon");
}

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomId("sess");
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return randomId("sess");
  }
}

function onceSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(ONCE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.slice(-200) : []);
  } catch {
    return new Set();
  }
}

function rememberOnce(key: string) {
  if (typeof window === "undefined") return;
  try {
    const set = onceSet();
    set.add(key);
    window.sessionStorage.setItem(ONCE_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    // ignore
  }
}

export function hasTrackedOnce(key: string) {
  return onceSet().has(key);
}

async function flushEvents() {
  if (typeof window === "undefined" || !queue.length) return;
  const batch = queue.splice(0, 25);
  const anonymousId = getAnalyticsAnonymousId();
  const sessionId = getAnalyticsSessionId();
  if (!anonymousId) return;

  const payload = JSON.stringify({
    anonymous_id: anonymousId,
    session_id: sessionId,
    events: batch,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/analytics/events", blob);
      if (sent) return;
    }
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    queue = [...batch.slice(0, 10), ...queue].slice(0, MAX_QUEUE);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushEvents();
  }, FLUSH_MS);
}

export function track(
  eventName: MarketplaceEventName,
  input: Omit<MarketplaceEventInput, "event_name"> = {},
) {
  if (typeof window === "undefined") return;
  ensureSessionStart();
  queue.push({
    event_name: eventName,
    product_id: input.product_id ?? null,
    store_id: input.store_id ?? null,
    quantity: input.quantity ?? null,
    metadata: input.metadata,
    occurred_at: new Date().toISOString(),
  });
  if (queue.length >= 20) {
    void flushEvents();
    return;
  }
  scheduleFlush();
}

/** Fire at most once per browser tab session for a given key. */
export function trackOnce(
  onceKey: string,
  eventName: MarketplaceEventName,
  input: Omit<MarketplaceEventInput, "event_name"> = {},
) {
  if (typeof window === "undefined") return;
  if (hasTrackedOnce(onceKey)) return;
  rememberOnce(onceKey);
  track(eventName, input);
}

export function ensureSessionStart() {
  if (typeof window === "undefined" || sessionBootstrapped) return;
  sessionBootstrapped = true;
  const params = new URLSearchParams(window.location.search);
  trackOnce(`session_start:${getAnalyticsSessionId() ?? "x"}`, "session_start", {
    metadata: {
      landing_path: `${window.location.pathname}`.slice(0, 160),
      referrer: document.referrer ? document.referrer.slice(0, 160) : null,
      utm_source: params.get("utm_source")?.slice(0, 80) ?? null,
      utm_medium: params.get("utm_medium")?.slice(0, 80) ?? null,
      utm_campaign: params.get("utm_campaign")?.slice(0, 80) ?? null,
    },
  });
}

export function syncCartSnapshot(input: {
  items: CartSnapshotItem[];
  subtotalAed: number;
}) {
  if (typeof window === "undefined") return;
  if (cartTimer) clearTimeout(cartTimer);
  cartTimer = setTimeout(() => {
    const anonymousId = getAnalyticsAnonymousId();
    if (!anonymousId) return;
    void fetch("/api/analytics/cart-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymous_id: anonymousId,
        items: input.items,
        subtotal_aed: input.subtotalAed,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, 900);
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushEvents();
  });
  window.addEventListener("pagehide", () => {
    void flushEvents();
  });
}
