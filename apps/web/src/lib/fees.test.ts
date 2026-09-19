import { describe, expect, it } from "vitest";
import { calculateCheckoutFees } from "@/lib/fees";

describe("calculateCheckoutFees", () => {
  it("charges AED 7 below AED 50", () => {
    const fees = calculateCheckoutFees(49.99);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(7);
    expect(fees.serviceFeeAed).toBe(3);
    expect(fees.totalAed).toBe(59.99);
  });

  it("charges AED 5 from AED 50 through AED 99.99", () => {
    expect(calculateCheckoutFees(50).deliveryFeeAed).toBe(5);
    expect(calculateCheckoutFees(99.99).deliveryFeeAed).toBe(5);
  });

  it("charges AED 3 from AED 100 through AED 199.99", () => {
    expect(calculateCheckoutFees(100).deliveryFeeAed).toBe(3);
    expect(calculateCheckoutFees(150).deliveryFeeAed).toBe(3);
    expect(calculateCheckoutFees(199.99).deliveryFeeAed).toBe(3);
  });

  it("waives delivery at AED 200 and above", () => {
    const fees = calculateCheckoutFees(200);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(0);
    expect(fees.totalAed).toBe(203);
  });
});
