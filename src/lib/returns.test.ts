import { describe, expect, it } from "vitest";
import { canAdvanceReturnJob, isReturnWindowOpen, RETURN_WINDOW_DAYS } from "./returns";

describe("return workflow contract", () => {
  it("keeps the return pickup sequence ordered", () => {
    expect(canAdvanceReturnJob("assigned", "accepted")).toBe(true);
    expect(canAdvanceReturnJob("accepted", "at_customer")).toBe(true);
    expect(canAdvanceReturnJob("at_customer", "collected")).toBe(true);
    expect(canAdvanceReturnJob("collected", "at_store")).toBe(true);
    expect(canAdvanceReturnJob("assigned", "at_customer")).toBe(false);
    expect(canAdvanceReturnJob("at_store", "completed")).toBe(false);
  });

  it("uses the fourteen-day shopper return window", () => {
    const now = Date.parse("2026-09-01T00:00:00.000Z");
    expect(RETURN_WINDOW_DAYS).toBe(14);
    expect(isReturnWindowOpen("2026-08-20T00:00:00.000Z", now)).toBe(true);
    expect(isReturnWindowOpen("2026-08-17T00:00:00.000Z", now)).toBe(false);
  });
});
