import "server-only";
import { amountsMatchAed, type AfsPaymentStatus } from "@/lib/afs/client";
import { redactAfsPayload } from "@/lib/afs/money";
import {
  isAfsCheckoutPending,
  isAfsPaymentSuccess,
} from "@/lib/afs/result-codes";
import {
  sendOrderConfirmationEmail,
  sendStoreNewOrderEmails,
} from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

export type FulfillAfsPaymentInput = {
  orderId: string;
  checkoutId: string | null;
  status: Pick<
    AfsPaymentStatus,
    | "id"
    | "amount"
    | "currency"
    | "merchantTransactionId"
    | "resultCode"
    | "resultDescription"
    | "raw"
  >;
};

export type FulfillAfsPaymentResult =
  | { outcome: "paid"; firstPaid: boolean }
  | { outcome: "already_paid" }
  | { outcome: "pending" }
  | { outcome: "failed"; reason: string }
  | { outcome: "ignored"; reason: string };

type OrderRow = {
  id: string;
  payment_method: string;
  payment_status: string;
  total_aed: number | string;
  status: string;
};

export async function fulfillAfsPayment(
  input: FulfillAfsPaymentInput,
): Promise<FulfillAfsPaymentResult> {
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, payment_method, payment_status, total_aed, status")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { outcome: "ignored", reason: "order_not_found" };
  }

  const typed = order as OrderRow;
  if (typed.payment_status === "paid") {
    return { outcome: "already_paid" };
  }
  if (typed.payment_method !== "card") {
    return { outcome: "ignored", reason: "not_card" };
  }
  if (typed.status === "cancelled") {
    return { outcome: "ignored", reason: "cancelled" };
  }

  // Checkout-prepared/pending responses do not contain the final payment
  // amount yet. They are not declines and must never move an order to failed.
  if (isAfsCheckoutPending(input.status.resultCode)) {
    return { outcome: "pending" };
  }

  const merchantOk = input.status.merchantTransactionId === typed.id;
  const amountOk = amountsMatchAed(Number(typed.total_aed), input.status.amount);
  const currencyOk = (input.status.currency ?? "AED").toUpperCase() === "AED";
  const success =
    isAfsPaymentSuccess(input.status.resultCode) &&
    Boolean(input.status.id) &&
    merchantOk &&
    amountOk &&
    currencyOk;

  if (!success) {
    await admin.rpc("mark_order_payment_failed_from_afs", {
      p_order_id: typed.id,
      p_afs_checkout_id: input.checkoutId,
      p_result_code: input.status.resultCode,
      p_result_description: input.status.resultDescription,
      p_raw_status: input.status.raw,
    });
    return {
      outcome: "failed",
      reason: !merchantOk
        ? "merchant_mismatch"
        : !amountOk
          ? "amount_mismatch"
          : !currencyOk
            ? "currency_mismatch"
            : "not_successful",
    };
  }

  const { data: markResult, error: markError } = await admin.rpc(
    "mark_order_paid_from_afs",
    {
      p_order_id: typed.id,
      p_afs_checkout_id: input.checkoutId,
      p_afs_payment_id: input.status.id,
      p_result_code: input.status.resultCode,
      p_result_description: input.status.resultDescription,
      p_amount_aed: Number(typed.total_aed),
      p_raw_status: input.status.raw ?? redactAfsPayload({}),
    },
  );

  if (markError) {
    console.error("Failed to mark order paid from AFS", {
      orderId: typed.id,
      message: markError.message,
      resultCode: input.status.resultCode,
    });
    return { outcome: "failed", reason: "mark_paid_error" };
  }

  const firstPaid =
    markResult &&
    typeof markResult === "object" &&
    "first_paid" in markResult &&
    Boolean((markResult as { first_paid?: boolean }).first_paid);

  if (firstPaid) {
    try {
      await sendOrderConfirmationEmail(typed.id);
    } catch (sendError) {
      console.error("Paid order confirmation email failed", sendError);
    }
    try {
      await sendStoreNewOrderEmails(typed.id);
    } catch (sendError) {
      console.error("Paid order store email failed", sendError);
    }
  }

  return { outcome: "paid", firstPaid: Boolean(firstPaid) };
}

export function paymentPayloadFromWebhook(
  payload: Record<string, unknown>,
): {
  orderId: string | null;
  checkoutId: string | null;
  status: FulfillAfsPaymentInput["status"];
} {
  const result = payload.result as { code?: string; description?: string } | undefined;
  const merchantTransactionId =
    typeof payload.merchantTransactionId === "string"
      ? payload.merchantTransactionId
      : null;
  const ndc = typeof payload.ndc === "string" ? payload.ndc : null;
  const checkoutId =
    typeof (payload as { checkoutId?: string }).checkoutId === "string"
      ? (payload as { checkoutId: string }).checkoutId
      : ndc;

  return {
    orderId: merchantTransactionId,
    checkoutId,
    status: {
      id: typeof payload.id === "string" ? payload.id : null,
      amount: typeof payload.amount === "string" ? payload.amount : null,
      currency: typeof payload.currency === "string" ? payload.currency : null,
      merchantTransactionId,
      resultCode: result?.code ?? null,
      resultDescription: result?.description ?? null,
      raw: redactAfsPayload(payload),
    },
  };
}
