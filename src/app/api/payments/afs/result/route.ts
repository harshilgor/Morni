import { NextResponse } from "next/server";
import {
  AfsError,
  getAfsPaymentStatus,
} from "@/lib/afs/client";
import { fulfillAfsPayment } from "@/lib/afs/fulfill";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function siteOrigin(request: Request): string {
  return new URL(request.url).origin.replace(/\/+$/, "");
}

function redirectToOrder(request: Request, orderId: string, query: string) {
  return NextResponse.redirect(`${siteOrigin(request)}/orders/${orderId}?${query}`);
}

function extractCheckoutId(resourcePath: string): string | null {
  const match = resourcePath.match(/\/v1\/checkouts\/([^/]+)\/payment/i);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resourcePath = url.searchParams.get("resourcePath")?.trim() ?? "";
  const orderIdParam = url.searchParams.get("orderId")?.trim() ?? "";
  const origin = siteOrigin(request);

  const limited = rateLimit(`afs-result:${clientIp(request)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.redirect(`${origin}/checkout?payment=rate_limited`);
  }

  if (!resourcePath.startsWith("/v1/")) {
    return NextResponse.redirect(`${origin}/checkout?payment=invalid`);
  }

  const checkoutIdFromPath = extractCheckoutId(resourcePath);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = `/api/payments/afs/result?${url.searchParams.toString()}`;
    return NextResponse.redirect(
      `${origin}/auth?next=${encodeURIComponent(next)}`,
    );
  }

  const admin = createAdminClient();

  let orderId = orderIdParam;
  if (!UUID_PATTERN.test(orderId) && checkoutIdFromPath) {
    const { data: paymentRow } = await admin
      .from("order_payments")
      .select("order_id")
      .eq("afs_checkout_id", checkoutIdFromPath)
      .maybeSingle();
    orderId = paymentRow?.order_id ?? "";
  }

  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.redirect(`${origin}/checkout?payment=unknown`);
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, shopper_id, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.redirect(`${origin}/checkout?payment=unknown`);
  }
  if (order.shopper_id !== user.id) {
    return NextResponse.redirect(`${origin}/orders?payment=forbidden`);
  }

  if (order.payment_status === "paid") {
    return redirectToOrder(request, order.id, "paid=1");
  }

  try {
    const status = await getAfsPaymentStatus(resourcePath);
    const result = await fulfillAfsPayment({
      orderId: order.id,
      checkoutId: checkoutIdFromPath,
      status,
    });

    if (result.outcome === "paid" || result.outcome === "already_paid") {
      return redirectToOrder(request, order.id, "paid=1");
    }

    if (result.outcome === "pending") {
      return redirectToOrder(request, order.id, "payment=pending");
    }

    console.error("AFS payment not successful", {
      orderId: order.id,
      resultCode: status.resultCode,
      reason: result.outcome === "failed" || result.outcome === "ignored" ? result.reason : null,
    });
    return redirectToOrder(request, order.id, "payment=failed");
  } catch (error) {
    if (error instanceof AfsError) {
      console.error("AFS result verification failed", {
        orderId: order.id,
        message: error.message,
        resultCode: error.resultCode,
      });
    } else {
      console.error("AFS result verification failed", error);
    }
    return redirectToOrder(request, order.id, "payment=failed");
  }
}
