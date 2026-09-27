import { NextResponse } from "next/server";
import {
  isUuid,
  sanitizeAnonymousId,
  type CartSnapshotItem,
} from "@/lib/analytics/events";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SnapshotBody = {
  anonymous_id?: string;
  items?: CartSnapshotItem[];
  subtotal_aed?: number;
};

export async function POST(request: Request) {
  const limited = rateLimit(`analytics-cart:${clientIp(request)}`, 40, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const body = (await request.json().catch(() => null)) as SnapshotBody | null;
  const anonymousId = sanitizeAnonymousId(body?.anonymous_id);
  if (!anonymousId) {
    return NextResponse.json(
      { error: "A valid anonymous_id is required." },
      { status: 400 },
    );
  }

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length > 40) {
    return NextResponse.json(
      { error: "Cart snapshot is too large." },
      { status: 400 },
    );
  }

  const items = rawItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      if (!isUuid(item.product_id) || !isUuid(item.store_id)) return null;
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) return null;
      return {
        product_id: item.product_id,
        store_id: item.store_id,
        quantity: Math.floor(quantity),
        price_aed:
          typeof item.price_aed === "number" && Number.isFinite(item.price_aed)
            ? Math.max(0, Number(item.price_aed.toFixed(2)))
            : undefined,
        title:
          typeof item.title === "string" ? item.title.slice(0, 120) : undefined,
      };
    })
    .filter(Boolean) as CartSnapshotItem[];

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal =
    typeof body?.subtotal_aed === "number" && Number.isFinite(body.subtotal_aed)
      ? Math.max(0, Number(body.subtotal_aed.toFixed(2)))
      : items.reduce(
          (sum, item) => sum + (item.price_aed ?? 0) * item.quantity,
          0,
        );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  if (itemCount === 0) {
    const existingQuery = user
      ? admin.from("cart_snapshots").select("id, shopper_id, updated_at").eq("shopper_id", user.id).maybeSingle()
      : admin.from("cart_snapshots").select("id, shopper_id, updated_at").eq("anonymous_id", anonymousId).maybeSingle();
    const { data: existingCart, error: lookupError } = await existingQuery;
    if (lookupError) {
      console.error("[analytics/cart-snapshot] lookup before clear", lookupError.message);
      return NextResponse.json({ error: "Unable to clear cart snapshot." }, { status: 500 });
    }
    if (existingCart?.shopper_id) {
      if (user?.id !== existingCart.shopper_id) {
        return NextResponse.json({ ok: true, cleared: true, reminder_preserved: true });
      }
      const { data: recentOrder, error: orderError } = await admin
        .from("orders")
        .select("id")
        .eq("shopper_id", existingCart.shopper_id)
        .gte("placed_at", existingCart.updated_at)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle();
      if (orderError) {
        console.error("[analytics/cart-snapshot] check recent order", orderError.message);
        return NextResponse.json({ error: "Unable to clear cart snapshot." }, { status: 500 });
      }
      if (recentOrder) {
        await admin.from("cart_snapshots").update({ reminder_claimed_at: null }).eq("id", existingCart.id);
        return NextResponse.json({ ok: true, cleared: true, reminder_preserved: true });
      }
    }
    const { error } = await admin.from("cart_snapshots").delete().eq("anonymous_id", anonymousId);
    if (error) {
      console.error("[analytics/cart-snapshot] delete", error.message);
      return NextResponse.json({ error: "Unable to clear cart snapshot." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: true });
  }

  let snapshotAnonymousId = anonymousId;
  if (user) {
    const { data: shopperCart, error: shopperCartError } = await admin
      .from("cart_snapshots")
      .select("anonymous_id")
      .eq("shopper_id", user.id)
      .maybeSingle();
    if (shopperCartError) {
      console.error("[analytics/cart-snapshot] read shopper snapshot", shopperCartError.message);
      return NextResponse.json({ error: "Unable to store cart snapshot." }, { status: 500 });
    }
    if (shopperCart?.anonymous_id) snapshotAnonymousId = shopperCart.anonymous_id;
  }

  const { error: previousCartError } = await admin
    .from("cart_snapshots")
    .select("id")
    .eq("anonymous_id", snapshotAnonymousId)
    .maybeSingle();
  if (previousCartError) {
    console.error("[analytics/cart-snapshot] read previous snapshot", previousCartError.message);
    return NextResponse.json({ error: "Unable to store cart snapshot." }, { status: 500 });
  }

  const row = {
    anonymous_id: snapshotAnonymousId,
    shopper_id: user?.id ?? null,
    item_count: itemCount,
    subtotal_aed: subtotal,
    items,
    updated_at: new Date().toISOString(),
    reminder_claimed_at: null,
    reminder_sent_at: null,
  };

  const { error } = await admin.from("cart_snapshots").upsert(row, {
    onConflict: "anonymous_id",
  });
  if (error) {
    console.error("[analytics/cart-snapshot]", error.message);
    return NextResponse.json({ error: "Unable to store cart snapshot." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item_count: itemCount });
}
