import { createCipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AfsWebhookError, decryptAfsWebhookPayload } from "@/lib/afs/webhook";

function encryptPayload(secretHex: string, payload: object) {
  const key = Buffer.from(secretHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    body: encrypted.toString("hex"),
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
  };
}

describe("decryptAfsWebhookPayload", () => {
  const secret =
    "000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f";

  it("decrypts a raw hex OPPWA webhook body", () => {
    const payload = {
      type: "PAYMENT",
      payload: {
        id: "pay_123",
        merchantTransactionId: "11111111-1111-1111-1111-111111111111",
        amount: "10.00",
        currency: "AED",
        result: { code: "000.000.000", description: "ok" },
      },
    };
    const encrypted = encryptPayload(secret, payload);
    const decrypted = decryptAfsWebhookPayload({
      bodyText: encrypted.body,
      ivHex: encrypted.ivHex,
      authTagHex: encrypted.authTagHex,
      secretHex: secret,
    });
    expect(decrypted).toEqual(payload);
  });

  it("decrypts a JSON-wrapped encryptedBody", () => {
    const payload = { type: "PAYMENT", payload: { id: "pay_456" } };
    const encrypted = encryptPayload(secret, payload);
    const decrypted = decryptAfsWebhookPayload({
      bodyText: JSON.stringify({ encryptedBody: encrypted.body }),
      ivHex: encrypted.ivHex,
      authTagHex: encrypted.authTagHex,
      secretHex: secret,
    });
    expect(decrypted).toEqual(payload);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptPayload(secret, { type: "PAYMENT" });
    const tamperedBody = `${encrypted.body[0] === "0" ? "1" : "0"}${encrypted.body.slice(1)}`;
    expect(() =>
      decryptAfsWebhookPayload({
        bodyText: tamperedBody,
        ivHex: encrypted.ivHex,
        authTagHex: encrypted.authTagHex,
        secretHex: secret,
      }),
    ).toThrow(AfsWebhookError);
  });
});
