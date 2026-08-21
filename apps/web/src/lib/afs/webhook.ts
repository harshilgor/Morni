import { createDecipheriv } from "node:crypto";

export class AfsWebhookError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AfsWebhookError";
    this.status = status;
  }
}

function hexToBuffer(hex: string, label: string): Buffer {
  const cleaned = hex.trim().toLowerCase();
  if (!cleaned || cleaned.length % 2 !== 0 || !/^[0-9a-f]+$/.test(cleaned)) {
    throw new AfsWebhookError(`Invalid ${label}.`);
  }
  return Buffer.from(cleaned, "hex");
}

export function getAfsWebhookSecret(): string | null {
  const secret = process.env.AFS_WEBHOOK_SECRET?.trim() ?? "";
  return secret || null;
}

/**
 * Decrypt an OPPWA/AFS webhook body (AES-256-GCM).
 * Headers: X-Initialization-Vector, X-Authentication-Tag (hex).
 * Body: raw hex ciphertext, or JSON `{ "encryptedBody": "<hex>" }`.
 */
export function decryptAfsWebhookPayload(input: {
  bodyText: string;
  ivHex: string;
  authTagHex: string;
  secretHex: string;
}): Record<string, unknown> {
  const key = hexToBuffer(input.secretHex, "webhook secret");
  if (key.length !== 32) {
    throw new AfsWebhookError("AFS webhook secret must be 64 hex characters (32 bytes).", 503);
  }

  const iv = hexToBuffer(input.ivHex, "initialization vector");
  const authTag = hexToBuffer(input.authTagHex, "authentication tag");

  let cipherHex = input.bodyText.trim();
  if (cipherHex.startsWith("{")) {
    try {
      const parsed = JSON.parse(cipherHex) as { encryptedBody?: string };
      if (typeof parsed.encryptedBody !== "string" || !parsed.encryptedBody.trim()) {
        throw new AfsWebhookError("Missing encryptedBody in webhook JSON.");
      }
      cipherHex = parsed.encryptedBody.trim();
    } catch (error) {
      if (error instanceof AfsWebhookError) throw error;
      throw new AfsWebhookError("Invalid webhook JSON wrapper.");
    }
  }

  const ciphertext = hexToBuffer(cipherHex, "encrypted body");

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plain.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AfsWebhookError("Decrypted webhook payload is not an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AfsWebhookError) throw error;
    throw new AfsWebhookError("Unable to decrypt AFS webhook payload.", 401);
  }
}
