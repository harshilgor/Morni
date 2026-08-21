import { NextResponse } from "next/server";
import {
  AfsError,
  amountsMatchAed,
  getAfsPaymentStatus,
  paymentStatusIsSuccessful,
} from "@/lib/afs/client";
import {
  sendOrderConfirmationEmail,
  sendStoreNewOrderEmails,
} from "@/lib/email";
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
    .select("id, shopper_id, payment_method, payment_status, total_aed, status")
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

    const merchantOk = status.merchantTransactionId === order.id;
    const amountOk = amountsMatchAed(Number(order.total_aed), status.amount);
    const currencyOk = (status.currency ?? "AED").toUpperCase() === "AED";

    if (
      paymentStatusIsSuccessful(status) &&
      status.id &&
      merchantOk &&
      amountOk &&
      currencyOk
    ) {
      const { data: markResult, error: markError } = await admin.rpc(
        "mark_order_paid_from_afs",
        {
          p_order_id: order.id,
          p_afs_checkout_id: checkoutIdFromPath,
          p_afs_payment_id: status.id,
          p_result_code: status.resultCode,
          p_result_description: status.resultDescription,
          p_amount_aed: Number(order.total_aed),
          p_raw_status: status.raw,
        },
      );

      if (markError) {
        console.error("Failed to mark order paid from AFS", {
          orderId: order.id,
          message: markError.message,
          resultCode: status.resultCode,
        });
        return redirectToOrder(request, order.id, "payment=failed");
      }

      const firstPaid =
        markResult &&
        typeof markResult === "object" &&
        "first_paid" in markResult &&
        Boolean((markResult as { first_paid?: boolean }).first_paid);

      if (firstPaid) {
        try {
          await sendOrderConfirmationEmail(order.id);
        } catch (sendError) {
          console.error("Paid order confirmation email failed", sendError);
        }
        try {
          await sendStoreNewOrderEmails(order.id);
        } catch (sendError) {
          console.error("Paid order store email failed", sendError);
        }
      }

      return redirectToOrder(request, order.id, "paid=1");
    }

    await admin.rpc("mark_order_payment_failed_from_afs", {
      p_order_id: order.id,
      p_afs_checkout_id: checkoutIdFromPath,
      p_result_code: status.resultCode,
      p_result_description: status.resultDescription,
      p_raw_status: status.raw,
    });

    console.error("AFS payment not successful", {
      orderId: order.id,
      resultCode: status.resultCode,
      amountOk,
      currencyOk,
      merchantOk,
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
