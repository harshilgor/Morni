import { describe, expect, it } from "vitest";
import {
  classifyFounderPath,
  founderProtectedRedirectNext,
} from "@/lib/founder-auth-proxy";

describe("founder auth proxy gate", () => {
  it("does not treat /founder/auth as a protected route", () => {
    expect(classifyFounderPath("/founder/auth")).toEqual({
      isFounderAuthRoute: true,
      isFounderProtectedRoute: false,
    });
    expect(classifyFounderPath("/founder/auth/")).toEqual({
      isFounderAuthRoute: true,
      isFounderProtectedRoute: false,
    });
  });

  it("protects the founder workspace", () => {
    expect(classifyFounderPath("/founder")).toEqual({
      isFounderAuthRoute: false,
      isFounderProtectedRoute: true,
    });
  });

  it("never rewrites next to /founder/auth after a successful login path", () => {
    expect(founderProtectedRedirectNext("/founder")).toBe("/founder");
    expect(founderProtectedRedirectNext("/founder", "?view=orders")).toBe(
      "/founder?view=orders",
    );
    expect(founderProtectedRedirectNext("/founder/auth", "?next=%2Ffounder")).toBe(
      "/founder",
    );
  });
});
