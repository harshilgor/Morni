import { describe, expect, it } from "vitest";
import {
  AFS_SUCCESS_RESULT_CODE_PATTERN,
  isAfsCheckoutPending,
  isAfsPaymentSuccess,
} from "@/lib/afs/result-codes";
import { amountsMatchAed, formatAfsAmount, redactAfsPayload } from "@/lib/afs/money";

describe("AFS result codes", () => {
  it("accepts documented success codes", () => {
    expect(isAfsPaymentSuccess("000.000.000")).toBe(true);
    expect(isAfsPaymentSuccess("000.100.110")).toBe(true);
    expect(isAfsPaymentSuccess("000.100.111")).toBe(true);
    expect(isAfsPaymentSuccess("000.300.100")).toBe(true);
    expect(isAfsPaymentSuccess("000.400.110")).toBe(true);
    expect(isAfsPaymentSuccess("000.400.120")).toBe(true);
    expect(AFS_SUCCESS_RESULT_CODE_PATTERN.test("000.000.000")).toBe(true);
  });

  it("rejects declines and pending checkout codes", () => {
    expect(isAfsPaymentSuccess("800.100.152")).toBe(false);
    expect(isAfsPaymentSuccess("000.200.000")).toBe(false);
    expect(isAfsPaymentSuccess(null)).toBe(false);
    expect(isAfsCheckoutPending("000.200.100")).toBe(true);
  });
});

describe("AFS amount helpers", () => {
  it("formats AED amounts with two decimals", () => {
    expect(formatAfsAmount(12)).toBe("12.00");
    expect(formatAfsAmount(12.5)).toBe("12.50");
    expect(formatAfsAmount(99.999)).toBe("100.00");
  });

  it("compares amounts safely", () => {
    expect(amountsMatchAed(25.5, "25.50")).toBe(true);
    expect(amountsMatchAed(25.5, "25.5")).toBe(true);
    expect(amountsMatchAed(25.5, "26.00")).toBe(false);
    expect(amountsMatchAed(25.5, null)).toBe(false);
  });

  it("redacts sensitive payload keys", () => {
    const redacted = redactAfsPayload({
      id: "pay-1",
      amount: "10.00",
      card: { bin: "411111", last4Digits: "1111" },
      result: { code: "000.000.000" },
    });
    expect(redacted.card).toBeUndefined();
    expect(redacted.id).toBe("pay-1");
    expect(redacted.result).toEqual({ code: "000.000.000" });
  });
});
