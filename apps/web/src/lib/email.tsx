import "server-only";
import { Resend } from "resend";
import { WelcomeEmail } from "@/emails/welcome-email";
import {
  OrderConfirmationEmail,
  type EmailOrderItem,
} from "@/emails/order-confirmation-email";
import { OrderStatusEmail } from "@/emails/order-status-email";
import { StoreNewOrderEmail } from "@/emails/store-new-order-email";
import { DeliveryInviteEmail } from "@/emails/delivery-invite-email";
import { LifecycleEmail } from "@/emails/lifecycle-email";
import { deliveryPromise, formatAed, orderStatusLabel } from "@/lib/format";
import { formatDeliverySlotWindow } from "@/lib/delivery-slots";
import type { OrderStatus } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.morniuae.com";

type NotificationEvent =
  | "welcome"
  | "order_confirmation"
  | "order_status"
  | "store_new_order"
  | "delivery_invite"
  | LifecycleEmailKind
  | "store_payment_failed"
  | "store_order_cancelled"
  | "store_delivery_failed"
  | "store_order_delivered";

export type LifecycleEmailKind =
  | "payment_failed"
  | "delivery_failed"
  | "review_request";

type OrderEmailRecord = {
  id: string;
  order_number: string;
  shopper_id: string;
  store_id: string;
  status: OrderStatus;
  total_aed: number | string;
  delivery_area: string;
  delivery_phone: string | null;
  delivery_eta_minutes: number;
  delivery_slot_start: string | null;
  delivery_slot_end: string | null;
  stores: { name: string | null } | { name: string | null }[] | null;
  order_items: Array<{
    title: string;
    quantity: number;
    size: string | null;
    color_name: string | null;
    customization: Record<string, string> | null;
    line_total_aed: number | string;
  }> | null;
};

function getMailer() {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_EMAIL_DOMAIN;

  if (!apiKey || !domain) {
    throw new Error("Resend credentials are not configured.");
  }

  return {
    resend: new Resend(apiKey),
    from: `Morni <hello@${domain}>`,
  };
}

function displayName(fullName: string | null | undefined, email: string) {
  return fullName?.trim() || email.split("@")[0] || "there";
}

async function reserveNotification(
  eventType: NotificationEvent,
  entityId: string,
  recipientId: string,
  recipientEmail: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("email_notifications").insert({
    event_type: eventType,
    entity_id: entityId,
    recipient_id: recipientId,
    recipient_email: recipientEmail,
  });

  if (!error) return true;
  if (error.code === "23505") {
    const { data: existing, error: lookupError } = await admin
      .from("email_notifications")
      .select("status")
      .eq("event_type", eventType)
      .eq("entity_id", entityId)
      .maybeSingle();
    if (lookupError) throw new Error(`Unable to inspect email notification: ${lookupError.message}`);
    if (existing?.status === "sent") return false;
    const { error: resetError } = await admin
      .from("email_notifications")
      .update({ status: "pending", error_message: null })
      .eq("event_type", eventType)
      .eq("entity_id", entityId)
      .eq("status", "failed");
    if (resetError) throw new Error(`Unable to retry email notification: ${resetError.message}`);
    return true;
  }
  throw new Error(`Unable to reserve email notification: ${error.message}`);
}

async function finishNotification(
  eventType: NotificationEvent,
  entityId: string,
  resendId: string | null,
  errorMessage?: string,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_notifications")
    .update({
      status: errorMessage ? "failed" : "sent",
      resend_id: resendId,
      error_message: errorMessage ?? null,
      sent_at: errorMessage ? null : new Date().toISOString(),
    })
    .eq("event_type", eventType)
    .eq("entity_id", entityId);

  if (error) throw new Error(`Unable to record email result: ${error.message}`);
}

async function sendWithRetry(
  eventType: NotificationEvent,
  entityId: string,
  payload: Parameters<Resend["emails"]["send"]>[0],
) {
  const { resend } = getMailer();
  let lastError = "Email sending failed.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await resend.emails.send(payload, {
      idempotencyKey: `${eventType}/${entityId}`,
    });
    if (!error) return data?.id ?? null;

    lastError = error.message;
    const isRetryable =
      error.name === "rate_limit_exceeded" || error.name === "internal_server_error";
    if (!isRetryable || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
  }

  throw new Error(lastError);
}

async function getOrderEmailRecord(orderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, order_number, shopper_id, store_id, status, total_aed, delivery_area, delivery_phone, delivery_eta_minutes, delivery_slot_start, delivery_slot_end, stores(name), order_items(title, quantity, size, color_name, customization, line_total_aed)",
    )
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Order not found.");
  }

  return data as OrderEmailRecord;
}

async function getStoreMemberIds(storeId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("store_members")
    .select("user_id")
    .eq("store_id", storeId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.user_id as string);
}

async function getRecipient(userId: string) {
  const admin = createAdminClient();
  const [{ data: authData, error: authError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("full_name").eq("id", userId).single(),
    ]);

  if (authError || !authData.user?.email) {
    throw new Error(authError?.message ?? "Recipient email is unavailable.");
  }
  if (profileError) throw new Error(profileError.message);

  return {
    email: authData.user.email,
    name: displayName(profile?.full_name, authData.user.email),
  };
}

function getStoreName(order: OrderEmailRecord) {
  const store = Array.isArray(order.stores) ? order.stores[0] : order.stores;
  return store?.name ?? "your Morni boutique";
}

function statusMessage(status: OrderStatus) {
  const messages: Record<OrderStatus, string> = {
    placed: "The boutique has received your order.",
    accepted: "The boutique has accepted your order and will begin preparing it shortly.",
    picking: "Your items are being carefully prepared.",
    out_for_delivery: "Your order is on its way to you.",
    delivered: "Your order has been delivered. We hope you love it.",
    cancelled: "This order has been cancelled. Please contact Morni if you need help.",
  };
  return messages[status];
}

export async function sendWelcomeEmail(userId: string) {
  const recipient = await getRecipient(userId);
  const reserved = await reserveNotification("welcome", userId, userId, recipient.email);
  if (!reserved) return { sent: false, reason: "already_sent" as const };

  try {
    const { from } = getMailer();
    const resendId = await sendWithRetry("welcome", userId, {
      from,
      to: [recipient.email],
      subject: "Welcome to Morni",
      react: WelcomeEmail({ name: recipient.name, ordersUrl: `${siteUrl}/orders` }),
    });
    await finishNotification("welcome", userId, resendId);
    return { sent: true, resendId };
  } catch (error) {
    await finishNotification(
      "welcome",
      userId,
      null,
      error instanceof Error ? error.message : "Unknown email error",
    );
    throw error;
  }
}

export async function sendDeliveryInviteEmail({
  email,
  partnerName,
  role,
  accessUrl,
  inviteToken,
}: {
  email: string;
  partnerName: string;
  role: "dispatcher" | "driver";
  accessUrl: string;
  inviteToken: string;
}) {
  const { from } = getMailer();
  const resendId = await sendWithRetry("delivery_invite", inviteToken, {
    from,
    to: [email],
    subject: `Welcome to Morni delivery with ${partnerName}`,
    react: DeliveryInviteEmail({ partnerName, role, accessUrl }),
  });

  return { sent: true, resendId };
}

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await getOrderEmailRecord(orderId);
  const recipient = await getRecipient(order.shopper_id);
  const reserved = await reserveNotification(
    "order_confirmation",
    order.id,
    recipientId(order),
    recipient.email,
  );
  if (!reserved) return { sent: false, reason: "already_sent" as const };

  const items: EmailOrderItem[] = (order.order_items ?? []).map((item) => ({
    title: item.title,
    quantity: item.quantity,
    size: item.size,
    colorName: item.color_name,
    customization: item.customization ? Object.entries(item.customization).map(([key, value]) => `${key.replaceAll("_", " ")} ${value}`).join(", ") : null,
    lineTotal: formatAed(item.line_total_aed),
  }));

  try {
    const { from } = getMailer();
    const resendId = await sendWithRetry("order_confirmation", order.id, {
      from,
      to: [recipient.email],
      subject: `Your Morni order ${order.order_number} is confirmed`,
      react: OrderConfirmationEmail({
        name: recipient.name,
        orderNumber: order.order_number,
        storeName: getStoreName(order),
        total: formatAed(order.total_aed),
        deliveryArea: order.delivery_area,
        deliveryEta:
          formatDeliverySlotWindow(order.delivery_slot_start, order.delivery_slot_end)
          ?? deliveryPromise(order.delivery_eta_minutes),
        items,
        orderUrl: `${siteUrl}/orders/${order.id}`,
      }),
    });
    await finishNotification("order_confirmation", order.id, resendId);
    return { sent: true, resendId };
  } catch (error) {
    await finishNotification(
      "order_confirmation",
      order.id,
      null,
      error instanceof Error ? error.message : "Unknown email error",
    );
    throw error;
  }
}

export async function sendOrderStatusEmail(orderId: string, statusOverride?: OrderStatus) {
  const order = await getOrderEmailRecord(orderId);
  const status = statusOverride ?? order.status;
  const recipient = await getRecipient(order.shopper_id);
  const eventId = `${order.id}:${status}`;
  const reserved = await reserveNotification(
    "order_status",
    eventId,
    recipientId(order),
    recipient.email,
  );
  if (!reserved) return { sent: false, reason: "already_sent" as const };

  try {
    const { from } = getMailer();
    const resendId = await sendWithRetry("order_status", eventId, {
      from,
      to: [recipient.email],
      subject: `Your Morni order ${order.order_number} is ${orderStatusLabel(status).toLowerCase()}`,
      react: OrderStatusEmail({
        name: recipient.name,
        orderNumber: order.order_number,
        statusLabel: orderStatusLabel(status),
        statusMessage: statusMessage(status),
        orderUrl: `${siteUrl}/orders/${order.id}`,
      }),
    });
    await finishNotification("order_status", eventId, resendId);
    return { sent: true, resendId };
  } catch (error) {
    await finishNotification(
      "order_status",
      eventId,
      null,
      error instanceof Error ? error.message : "Unknown email error",
    );
    throw error;
  }
}

export async function sendStoreNewOrderEmails(orderId: string) {
  const order = await getOrderEmailRecord(orderId);
  const memberIds = await getStoreMemberIds(order.store_id);
  if (memberIds.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const items: EmailOrderItem[] = (order.order_items ?? []).map((item) => ({
    title: item.title,
    quantity: item.quantity,
    size: item.size,
    colorName: item.color_name,
    customization: item.customization ? Object.entries(item.customization).map(([key, value]) => `${key.replaceAll("_", " ")} ${value}`).join(", ") : null,
    lineTotal: formatAed(item.line_total_aed),
  }));
  const storeName = getStoreName(order);
  const portalOrdersUrl = `${siteUrl}/portal/orders`;
  const { from } = getMailer();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const memberId of memberIds) {
    const eventId = `${order.id}:${memberId}`;
    try {
      const recipient = await getRecipient(memberId);
      const reserved = await reserveNotification(
        "store_new_order",
        eventId,
        memberId,
        recipient.email,
      );
      if (!reserved) {
        skipped += 1;
        continue;
      }

      try {
        const resendId = await sendWithRetry("store_new_order", eventId, {
          from,
          to: [recipient.email],
          subject: `New order ${order.order_number} at ${storeName}`,
          react: StoreNewOrderEmail({
            name: recipient.name,
            orderNumber: order.order_number,
            storeName,
            total: formatAed(order.total_aed),
            deliveryArea: order.delivery_area,
            deliveryPhone: order.delivery_phone,
            items,
            portalOrdersUrl,
          }),
        });
        await finishNotification("store_new_order", eventId, resendId);
        sent += 1;
      } catch (error) {
        await finishNotification(
          "store_new_order",
          eventId,
          null,
          error instanceof Error ? error.message : "Unknown email error",
        );
        failed += 1;
        console.error("Store new-order email failed", { orderId, memberId, error });
      }
    } catch (error) {
      failed += 1;
      console.error("Store new-order email recipient lookup failed", {
        orderId,
        memberId,
        error,
      });
    }
  }

  return { sent, failed, skipped };
}

export async function sendLifecycleEmail(
  kind: LifecycleEmailKind,
  orderId: string,
  detail?: string | null,
) {
  const order = await getOrderEmailRecord(orderId);
  const recipient = await getRecipient(order.shopper_id);
  const reserved = await reserveNotification(kind, orderId, order.shopper_id, recipient.email);
  if (!reserved) return { sent: false, reason: "already_sent" as const };

  const content = {
    payment_failed: {
      subject: `Payment needed for Morni order ${order.order_number}`,
      preview: `Payment for order ${order.order_number} needs your attention.`,
      title: "Payment needs your attention",
      message: "We couldn’t confirm your payment. Your order is still waiting, so please return to checkout and try again.",
      action: "Retry payment",
      path: `/checkout/pay/${order.id}`,
    },
    delivery_failed: {
      subject: `A delivery update for Morni order ${order.order_number}`,
      preview: `We need your help completing order ${order.order_number}.`,
      title: "We need your help with delivery",
      message: detail?.trim() || "Your rider could not complete delivery. Please open your order for the latest next step.",
      action: "Open your order",
      path: `/orders/${order.id}`,
    },
    review_request: {
      subject: `How did your Morni order ${order.order_number} go?`,
      preview: `Your Morni order has arrived — tell us what you think.`,
      title: "How did we do?",
      message: "Your order has arrived. A quick review helps independent UAE boutiques and helps other shoppers discover something special.",
      action: "Leave a review",
      path: `/orders/${order.id}`,
    },
  }[kind];

  try {
    const { from } = getMailer();
    const resendId = await sendWithRetry(kind, orderId, {
      from,
      to: [recipient.email],
      subject: content.subject,
      react: LifecycleEmail({
        name: recipient.name,
        orderNumber: order.order_number,
        preview: content.preview,
        title: content.title,
        message: content.message,
        action: { label: content.action, href: `${siteUrl}${content.path}` },
      }),
    });
    await finishNotification(kind, orderId, resendId);
    return { sent: true, resendId };
  } catch (error) {
    await finishNotification(kind, orderId, null, error instanceof Error ? error.message : "Unknown email error");
    throw error;
  }
}

export async function processEmailOutbox(limit = 25) {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin
    .from("email_outbox")
    .select("id, event_type, order_id, detail, attempts")
    .is("sent_at", null)
    .lt("attempts", 8)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Unable to load email outbox: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    const { data: claimed, error: claimError } = await admin
      .from("email_outbox")
      .update({ attempts: (job.attempts ?? 0) + 1 })
      .eq("id", job.id)
      .is("sent_at", null)
      .eq("attempts", job.attempts ?? 0)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;

    try {
      if (job.event_type === "order_status") await sendOrderStatusEmail(job.order_id, job.detail as OrderStatus);
      if (job.event_type === "payment_failed") await sendLifecycleEmail("payment_failed", job.order_id);
      if (job.event_type === "delivery_failed") await sendLifecycleEmail("delivery_failed", job.order_id, job.detail);
      if (job.event_type === "review_request") await sendLifecycleEmail("review_request", job.order_id);
      if (job.event_type === "store_payment_failed") await sendStoreOrderAlertEmails(job.order_id, "payment_failed");
      if (job.event_type === "store_order_cancelled") await sendStoreOrderAlertEmails(job.order_id, "cancelled");
      if (job.event_type === "store_delivery_failed") await sendStoreOrderAlertEmails(job.order_id, "delivery_failed", job.detail);
      if (job.event_type === "store_order_delivered") await sendStoreOrderAlertEmails(job.order_id, "delivered");
      await admin.from("email_outbox").update({ sent_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
      sent += 1;
    } catch (sendError) {
      failed += 1;
      await admin.from("email_outbox").update({ last_error: sendError instanceof Error ? sendError.message : "Unknown email error" }).eq("id", job.id);
      console.error("Email outbox job failed", { id: job.id, eventType: job.event_type, error: sendError });
    }
  }
  return { inspected: jobs?.length ?? 0, sent, failed };
}

async function sendStoreOrderAlertEmails(
  orderId: string,
  kind: "payment_failed" | "cancelled" | "delivery_failed" | "delivered",
  detail?: string | null,
) {
  const order = await getOrderEmailRecord(orderId);
  const memberIds = await getStoreMemberIds(order.store_id);
  const content = {
    payment_failed: ["Payment failed", "Payment for this order could not be confirmed. Review the order before taking action."],
    cancelled: ["Order cancelled", "This order has been cancelled. Review the order and any required fulfilment or refund action."],
    delivery_failed: ["Delivery needs attention", detail?.trim() || "The rider reported a delivery issue. Open the order to coordinate the next step."],
    delivered: ["Order delivered", "The rider has completed delivery. The shopper can now leave a verified review."],
  }[kind];

  for (const memberId of memberIds) {
    const recipient = await getRecipient(memberId);
    const event = ({
      payment_failed: "store_payment_failed",
      cancelled: "store_order_cancelled",
      delivery_failed: "store_delivery_failed",
      delivered: "store_order_delivered",
    } as const)[kind];
    const eventId = `${order.id}:${memberId}`;
    if (!(await reserveNotification(event, eventId, memberId, recipient.email))) continue;
    try {
      const { from } = getMailer();
      const resendId = await sendWithRetry(event, eventId, {
        from,
        to: [recipient.email],
        subject: `${content[0]} for Morni order ${order.order_number}`,
        react: LifecycleEmail({
          name: recipient.name,
          orderNumber: order.order_number,
          preview: `${content[0]} for order ${order.order_number}.`,
          title: content[0],
          message: content[1],
          action: { label: "Open store orders", href: `${siteUrl}/portal/orders` },
        }),
      });
      await finishNotification(event, eventId, resendId);
    } catch (error) {
      await finishNotification(event, eventId, null, error instanceof Error ? error.message : "Unknown email error");
      throw error;
    }
  }
}

function recipientId(order: OrderEmailRecord) {
  return order.shopper_id;
}
