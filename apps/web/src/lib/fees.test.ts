import { describe, expect, it } from "vitest";
import { calculateCheckoutFees } from "@/lib/fees";

describe("calculateCheckoutFees", () => {
  it("charges only delivery and service fees below AED 99", () => {
    const fees = calculateCheckoutFees(55);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(7);
    expect(fees.serviceFeeAed).toBe(3);
    expect(fees.totalAed).toBe(65);
  });

  it("does not add a small order fee at AED 98", () => {
    const fees = calculateCheckoutFees(98);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(7);
    expect(fees.totalAed).toBe(108);
  });

  it("waives delivery at AED 199 and above", () => {
    const fees = calculateCheckoutFees(199);
    expect(fees.smallOrderFeeAed).toBe(0);
    expect(fees.deliveryFeeAed).toBe(0);
    expect(fees.totalAed).toBe(202);
  });
});
