import { describe, expect, it } from "vitest";
import { launchNumberSequence } from "./launch-welcome";

describe("launch number sequence", () => {
  it("rolls from ten before the assigned number", () => expect(launchNumberSequence(200)).toEqual([190,191,192,193,194,195,196,197,198,199,200]));
  it("supports the launch starting number", () => expect(launchNumberSequence(100)[0]).toBe(90));
  it("always ends at the authoritative number", () => expect(launchNumberSequence(7).at(-1)).toBe(7));
});
