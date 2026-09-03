import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/content-security-policy";

describe("contentSecurityPolicy", () => {
  it("allows issuer-controlled HTTPS 3DS frames only on payment pages", () => {
    const paymentPolicy = contentSecurityPolicy("/checkout/pay/order-id");
    const storefrontPolicy = contentSecurityPolicy("/checkout");
    const paymentFrameDirective = paymentPolicy
      .split("; ")
      .find((directive) => directive.startsWith("frame-src"));
    const storefrontFrameDirective = storefrontPolicy
      .split("; ")
      .find((directive) => directive.startsWith("frame-src"));

    expect(paymentFrameDirective).toBe("frame-src 'self' https:");
    expect(storefrontFrameDirective).not.toBe("frame-src 'self' https:");
    expect(storefrontPolicy).toContain("https://eu-prod.oppwa.com");
  });
});
