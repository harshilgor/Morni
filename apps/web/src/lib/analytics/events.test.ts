import { describe, expect, it } from "vitest";
import {
  isAddToCartBlockedReason,
  isMarketplaceEventName,
  sanitizeAnonymousId,
  sanitizeMetadata,
} from "@/lib/analytics/events";

describe("marketplace analytics validation", () => {
  it("allowlists expanded event names", () => {
    expect(isMarketplaceEventName("product_view")).toBe(true);
    expect(isMarketplaceEventName("search_zero_results")).toBe(true);
    expect(isMarketplaceEventName("listing_impression")).toBe(true);
    expect(isMarketplaceEventName("checkout_payment_success")).toBe(true);
    expect(isMarketplaceEventName("auth_fail")).toBe(true);
    expect(isMarketplaceEventName("session_start")).toBe(true);
    expect(isMarketplaceEventName("order_created")).toBe(false);
  });

  it("allowlists blocked add-to-cart reasons", () => {
    expect(isAddToCartBlockedReason("size_required")).toBe(true);
    expect(isAddToCartBlockedReason("out_of_stock")).toBe(true);
    expect(isAddToCartBlockedReason("free_text")).toBe(false);
  });

  it("rejects weak anonymous ids", () => {
    expect(sanitizeAnonymousId("short")).toBeNull();
    expect(sanitizeAnonymousId("https://evil.example")).toBeNull();
    expect(sanitizeAnonymousId("anon_abc12345")).toBe("anon_abc12345");
  });

  it("keeps useful metadata and strips nested objects", () => {
    expect(
      sanitizeMetadata({
        query: "silk saree",
        result_count: 12,
        nested: { a: 1 },
        utm_source: "instagram",
      }),
    ).toEqual({
      query: "silk saree",
      result_count: 12,
      utm_source: "instagram",
    });
  });
});
