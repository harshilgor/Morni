import { describe, expect, it } from "vitest";
import { isNewPaidOrder, isPaidOrder } from "@/lib/order-payment-state";

describe("order payment state", () => {
  it("does not treat unpaid checkout drafts as new orders", () => {
    expect(
      isNewPaidOrder({ status: "placed", payment_status: "pending" }),
    ).toBe(false);
    expect(
      isNewPaidOrder({ status: "placed", payment_status: "failed" }),
    ).toBe(false);
  });

  it("counts paid placed orders as new", () => {
    expect(isNewPaidOrder({ status: "placed", payment_status: "paid" })).toBe(
      true,
    );
    expect(isPaidOrder({ payment_status: "paid" })).toBe(true);
  });

  it("never treats wishlist-like absence of payment as paid", () => {
    expect(isPaidOrder({ payment_status: null })).toBe(false);
    expect(isPaidOrder({})).toBe(false);
  });
});
