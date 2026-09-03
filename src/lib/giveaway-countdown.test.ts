import { describe, expect, it } from "vitest";
import { giveawayParts } from "@/components/giveaway-countdown";
describe("giveaway countdown", () => { it("formats duration", () => expect(giveawayParts(48 * 3600000 + 2000)).toEqual({ hours: "48", minutes: "00", seconds: "02" })); it("clamps expiry", () => expect(giveawayParts(-1).hours).toBe("00")); });
