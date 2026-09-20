export const MARKETPLACE_EVENT_NAMES = [
  // Purchase-intent spine
  "product_view",
  "cart_add",
  "cart_remove",
  "cart_update",
  "checkout_start",
  "wishlist_add",
  "wishlist_remove",
  // Search
  "search",
  "search_zero_results",
  "search_result_click",
  // Browse / discovery
  "home_view",
  "category_view",
  "collection_view",
  "store_view",
  "listing_impression",
  "listing_click",
  // Checkout funnel
  "checkout_address_complete",
  "checkout_slot_selected",
  "checkout_place_order",
  "checkout_payment_start",
  "checkout_payment_fail",
  "checkout_payment_success",
  // PDP friction
  "size_selected",
  "variant_selected",
  "add_to_cart_blocked",
  "pdp_related_click",
  // Auth
  "auth_view",
  "auth_signup_success",
  "auth_login_success",
  "auth_fail",
  // Secondary
  "filter_apply",
  "sort_change",
  "location_set",
  "promo_click",
  "empty_cart_view",
  "wishlist_to_cart",
  "error",
  "session_start",
] as const;

export type MarketplaceEventName = (typeof MARKETPLACE_EVENT_NAMES)[number];

export const ADD_TO_CART_BLOCKED_REASONS = [
  "out_of_stock",
  "size_required",
  "variant_required",
  "invalid_customization",
  "quantity_unavailable",
  "other",
] as const;

export type AddToCartBlockedReason = (typeof ADD_TO_CART_BLOCKED_REASONS)[number];

export type MarketplaceEventInput = {
  event_name: MarketplaceEventName;
  product_id?: string | null;
  store_id?: string | null;
  quantity?: number | null;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
};

export type CartSnapshotItem = {
  product_id: string;
  store_id: string;
  quantity: number;
  price_aed?: number;
  title?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function isMarketplaceEventName(
  value: string,
): value is MarketplaceEventName {
  return (MARKETPLACE_EVENT_NAMES as readonly string[]).includes(value);
}

export function isAddToCartBlockedReason(
  value: string,
): value is AddToCartBlockedReason {
  return (ADD_TO_CART_BLOCKED_REASONS as readonly string[]).includes(value);
}

export function sanitizeAnonymousId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeSessionId(value: unknown): string | null {
  return sanitizeAnonymousId(value);
}

export function sanitizeMetadata(
  value: unknown,
): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key.length > 40) continue;
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
    ) {
      out[key] =
        typeof entry === "string" ? entry.slice(0, 160) : entry;
    }
    if (Object.keys(out).length >= 16) break;
  }
  return out;
}
