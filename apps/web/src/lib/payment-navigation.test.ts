import { describe, expect, it, vi } from "vitest";
import {
  navigateToPaymentPage,
  paymentPagePath,
} from "@/lib/payment-navigation";

describe("payment navigation", () => {
  it("uses a full document navigation to load the payment-page CSP", () => {
    const assign = vi.fn();

    navigateToPaymentPage("order/id", assign);

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("/checkout/pay/order%2Fid");
    expect(paymentPagePath("order-id")).toBe("/checkout/pay/order-id");
  });
});
