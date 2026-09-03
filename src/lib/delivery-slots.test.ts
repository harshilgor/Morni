import { describe, expect, it } from "vitest";
import {
  DELIVERY_SLOT_DEFINITIONS,
  dubaiDateKey,
  dubaiLocalToUtcIso,
  findBookableDeliverySlot,
  isPastSameDayBookingCutoff,
  listBookableDeliverySlots,
} from "./delivery-slots";

describe("delivery slots", () => {
  it("converts Dubai wall time to UTC (UTC+4)", () => {
    expect(dubaiLocalToUtcIso("2026-08-26", 10 * 60)).toBe("2026-08-26T06:00:00.000Z");
    expect(dubaiLocalToUtcIso("2026-08-26", 18 * 60)).toBe("2026-08-26T14:00:00.000Z");
  });

  it("detects the 6:30 PM same-day booking cutoff", () => {
    // 18:29 Dubai = 14:29 UTC
    expect(isPastSameDayBookingCutoff(new Date("2026-08-26T14:29:00.000Z"))).toBe(false);
    // 18:30 Dubai = 14:30 UTC
    expect(isPastSameDayBookingCutoff(new Date("2026-08-26T14:30:00.000Z"))).toBe(true);
  });

  it("offers remaining same-day slots before cutoff", () => {
    // 12:00 Dubai = 08:00 UTC — first two slots already started
    const slots = listBookableDeliverySlots(new Date("2026-08-26T08:00:00.000Z"));
    expect(slots.map((slot) => slot.id)).toEqual([
      "2026-08-26__13:30-14:30",
      "2026-08-26__14:30-16:00",
      "2026-08-26__16:00-18:00",
    ]);
    expect(slots.every((slot) => slot.dateLabel === "Today")).toBe(true);
  });

  it("rolls to tomorrow after the 6:30 PM cutoff", () => {
    const slots = listBookableDeliverySlots(new Date("2026-08-26T14:30:00.000Z"));
    expect(slots).toHaveLength(DELIVERY_SLOT_DEFINITIONS.length);
    expect(slots.every((slot) => slot.dateKey === "2026-08-27")).toBe(true);
    expect(slots[0]?.dateLabel).toBe("Tomorrow");
  });

  it("validates a still-bookable slot payload", () => {
    const now = new Date("2026-08-26T08:00:00.000Z");
    const startIso = dubaiLocalToUtcIso("2026-08-26", 16 * 60);
    const endIso = dubaiLocalToUtcIso("2026-08-26", 18 * 60);
    expect(findBookableDeliverySlot(startIso, endIso, now)?.id).toBe("2026-08-26__16:00-18:00");
    expect(findBookableDeliverySlot(startIso, endIso, new Date("2026-08-26T14:30:00.000Z"))).toBeUndefined();
  });

  it("reads Dubai calendar date from UTC instants", () => {
    expect(dubaiDateKey(new Date("2026-08-26T20:00:00.000Z"))).toBe("2026-08-27");
  });
});
