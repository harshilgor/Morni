import { describe, expect, it } from "vitest";
import { calculateCheckoutFees, deliveryFeeForDistanceMeters } from "@/lib/fees";

describe("distance based checkout fees", () => {
  it("charges AED 7 through exactly 10 km", () => {
    expect(deliveryFeeForDistanceMeters(0)).toBe(7);
    expect(deliveryFeeForDistanceMeters(10_000)).toBe(7);
    const fees = calculateCheckoutFees(250, 10_000);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(7);
    expect(fees.serviceFeeAed).toBe(3);
    expect(fees.totalAed).toBe(260);
  });

  it("charges AED 10 above 10 km through exactly 15 km", () => {
    expect(deliveryFeeForDistanceMeters(10_001)).toBe(10);
    expect(deliveryFeeForDistanceMeters(15_000)).toBe(10);
  });

  it("charges AED 15 above 15 km", () => {
    expect(deliveryFeeForDistanceMeters(15_001)).toBe(15);
    expect(deliveryFeeForDistanceMeters(50_000)).toBe(15);
  });

  it("does not waive the distance fee on large orders", () => {
    const fees = calculateCheckoutFees(200, 12_000);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(10);
    expect(fees.totalAed).toBe(213);
  });

  it("does not total delivery before the road distance is known", () => {
    const fees = calculateCheckoutFees(200, null);
    expect(fees.deliveryDistanceKm).toBeNull();
    expect(fees.totalAed).toBe(203);
  });
});
