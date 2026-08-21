import { NextResponse } from "next/server";
import {
  AfsError,
  getAfsWidgetScriptUrl,
  prepareAfsCheckout,
} from "@/lib/afs/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CheckoutBody = {
  orderId?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const orderId = body?.orderId?.trim() ?? "";
  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "A valid order id is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, shopper_id, payment_method, payment_status, total_aed, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.shopper_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.payment_method !== "card") {
    return NextResponse.json({ error: "This order is not a card payment." }, { status: 400 });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
  }
  if (order.status === "cancelled") {
    return NextResponse.json({ error: "This order was cancelled." }, { status: 409 });
  }

  const amountAed = Number(order.total_aed);
  if (!Number.isFinite(amountAed) || amountAed <= 0) {
    return NextResponse.json({ error: "Order total is invalid." }, { status: 400 });
  }

  try {
    const prepared = await prepareAfsCheckout({
      amountAed,
      merchantTransactionId: order.id,
      customerEmail: user.email,
    });

    const { error: sessionError } = await admin.rpc("upsert_afs_checkout_session", {
      p_order_id: order.id,
      p_afs_checkout_id: prepared.checkoutId,
      p_amount_aed: amountAed,
    });
    if (sessionError) {
      console.error("Failed to persist AFS checkout session", {
        orderId: order.id,
        message: sessionError.message,
      });
      return NextResponse.json(
        { error: "Unable to start payment session." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      checkoutId: prepared.checkoutId,
      integrity: prepared.integrity,
      scriptUrl: getAfsWidgetScriptUrl(prepared.checkoutId),
      amountAed,
      currency: "AED",
      orderId: order.id,
    });
  } catch (error) {
    if (error instanceof AfsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("AFS prepare checkout failed", error);
    return NextResponse.json({ error: "Unable to start payment." }, { status: 502 });
  }
}
