import { NextResponse } from "next/server";
import {
  isMarketplaceEventName,
  isUuid,
  sanitizeAnonymousId,
  sanitizeMetadata,
  sanitizeSessionId,
  type MarketplaceEventInput,
} from "@/lib/analytics/events";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EventsBody = {
  anonymous_id?: string;
  session_id?: string;
  events?: MarketplaceEventInput[];
};

export async function POST(request: Request) {
  const limited = rateLimit(`analytics-events:${clientIp(request)}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const body = (await request.json().catch(() => null)) as EventsBody | null;
  const anonymousId = sanitizeAnonymousId(body?.anonymous_id);
  const sessionId = sanitizeSessionId(body?.session_id);
  const rawEvents = Array.isArray(body?.events) ? body.events : [];

  if (!anonymousId) {
    return NextResponse.json(
      { error: "A valid anonymous_id is required." },
      { status: 400 },
    );
  }
  if (rawEvents.length < 1 || rawEvents.length > 25) {
    return NextResponse.json(
      { error: "Send between 1 and 25 events per request." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = [];
  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    if (!isMarketplaceEventName(String(event.event_name ?? ""))) continue;
    const productId = isUuid(event.product_id ?? undefined)
      ? event.product_id
      : null;
    const storeId = isUuid(event.store_id ?? undefined) ? event.store_id : null;
    const quantity =
      typeof event.quantity === "number" &&
      Number.isFinite(event.quantity) &&
      event.quantity >= 0 &&
      event.quantity <= 99
        ? Math.floor(event.quantity)
        : null;
    const occurredAt =
      typeof event.occurred_at === "string" &&
      !Number.isNaN(Date.parse(event.occurred_at))
        ? new Date(event.occurred_at).toISOString()
        : new Date().toISOString();

    rows.push({
      event_name: event.event_name,
      shopper_id: user?.id ?? null,
      anonymous_id: anonymousId,
      session_id: sessionId,
      product_id: productId,
      store_id: storeId,
      quantity,
      metadata: sanitizeMetadata(event.metadata),
      occurred_at: occurredAt,
      source: "web",
    });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No valid events to store." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("marketplace_events").insert(rows);
  if (error) {
    console.error("[analytics/events]", error.message);
    return NextResponse.json({ error: "Unable to store events." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: rows.length });
}
