import { describe, expect, it } from "vitest";
import {
  founderAuthNext,
  isFounderDestination,
  safeInternalPath,
} from "@/lib/auth-redirect";

describe("safeInternalPath", () => {
  it("allows safe relative paths", () => {
    expect(safeInternalPath("/founder")).toBe("/founder");
    expect(safeInternalPath("/portal/orders")).toBe("/portal/orders");
    expect(safeInternalPath("/checkout?step=1")).toBe("/checkout?step=1");
  });

  it("rejects open redirects", () => {
    expect(safeInternalPath("https://evil.example", "/founder")).toBe("/founder");
    expect(safeInternalPath("//evil.example", "/")).toBe("/");
    expect(safeInternalPath("/\\evil.example", "/")).toBe("/");
    expect(safeInternalPath("javascript:alert(1)", "/")).toBe("/");
  });

  it("rejects auth destinations that would loop after login", () => {
    expect(safeInternalPath("/founder/auth", "/founder")).toBe("/founder");
    expect(safeInternalPath("/founder/auth?next=%2Ffounder", "/founder")).toBe(
      "/founder",
    );
    expect(safeInternalPath("/auth?next=/founder", "/")).toBe("/");
    expect(safeInternalPath("/auth", "/account")).toBe("/account");
  });

  it("defaults founder auth to /founder", () => {
    expect(founderAuthNext(null)).toBe("/founder");
    expect(founderAuthNext("/founder")).toBe("/founder");
    expect(isFounderDestination("/founder")).toBe(true);
    expect(isFounderDestination("/portal")).toBe(false);
  });
});
