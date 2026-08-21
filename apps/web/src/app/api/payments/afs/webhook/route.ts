import { NextResponse } from "next/server";
import { fulfillAfsPayment, paymentPayloadFromWebhook } from "@/lib/afs/fulfill";
import {
  AfsWebhookError,
  decryptAfsWebhookPayload,
  getAfsWebhookSecret,
} from "@/lib/afs/webhook";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`afs-webhook:${ip}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const secret = getAfsWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "AFS webhook secret is not configured." },
      { status: 503 },
    );
  }

  const ivHex = request.headers.get("x-initialization-vector") ?? "";
  const authTagHex = request.headers.get("x-authentication-tag") ?? "";
  const bodyText = await request.text();

  let decrypted: Record<string, unknown>;
  try {
    decrypted = decryptAfsWebhookPayload({
      bodyText,
      ivHex,
      authTagHex,
      secretHex: secret,
    });
  } catch (error) {
    if (error instanceof AfsWebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  const eventType =
    typeof decrypted.type === "string" ? decrypted.type.toUpperCase() : "";
  if (eventType && eventType !== "PAYMENT") {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_payment" });
  }

  const payload =
    decrypted.payload && typeof decrypted.payload === "object" && !Array.isArray(decrypted.payload)
      ? (decrypted.payload as Record<string, unknown>)
      : decrypted;

  const parsed = paymentPayloadFromWebhook(payload);
  if (!parsed.orderId || !parsed.status.id) {
    // ACK test pings / incomplete payloads so AFS can activate the webhook.
    return NextResponse.json({ ok: true, ignored: true, reason: "incomplete_payload" });
  }

  const result = await fulfillAfsPayment({
    orderId: parsed.orderId,
    checkoutId: parsed.checkoutId,
    status: parsed.status,
  });

  return NextResponse.json({ ok: true, ...result });
}
