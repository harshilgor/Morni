import { describe, expect, it } from "vitest";
import { getOnboardingChecklist, isStoreLaunchReady } from "@/lib/onboarding";
import type { Product, Store } from "@/lib/types";

const store: Store = {
  id: "store-rmt",
  name: "RMT",
  slug: "rmt",
  description: null,
  logo_url: "https://example.com/rmt-logo.png",
  cover_url: null,
  emirate: "dubai",
  area: "Deira",
  address: "Example Street",
  lat: null,
  lng: null,
  is_active: false,
  delivery_eta_minutes: 60,
  opens_at: "10:00",
  closes_at: "22:00",
  pause_note: null,
  onboarding_step: 4,
  onboarding_completed_at: null,
};

const product: Product = {
  id: "product-hampers",
  store_id: store.id,
  category_id: "category-gifting",
  category: { name: "Gifting", slug: "gifting" },
  title: "Hampers",
  description: "Dry fruits",
  price_aed: 10,
  compare_at_price_aed: null,
  image_urls: ["https://example.com/hamper.png"],
  sizes: [],
  stock: 10,
  is_available: true,
};

describe("store onboarding", () => {
  it("accepts a complete gifting product without apparel sizes", () => {
    const checklist = getOnboardingChecklist(store, [product]);
    expect(checklist.find((item) => item.id === "product")?.done).toBe(true);
    expect(isStoreLaunchReady(store, [product])).toBe(true);
  });

  it("still requires sizes for size-based products", () => {
    const apparel = { ...product, category: { name: "Dresses", slug: "dresses" }, sizes: [] };
    const checklist = getOnboardingChecklist(store, [apparel]);
    expect(checklist.find((item) => item.id === "product")?.done).toBe(false);
  });
});
