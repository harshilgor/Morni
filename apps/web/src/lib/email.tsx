import "server-only";
import { Resend } from "resend";
import { WelcomeEmail } from "@/emails/welcome-email";
import {
  OrderConfirmationEmail,
  type EmailOrderItem,
} from "@/emails/order-confirmation-email";
import { OrderStatusEmail } from "@/emails/order-status-email";
import { StoreNewOrderEmail } from "@/emails/store-new-order-email";
import { deliveryPromise, formatAed, orderStatusLabel } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.morniuae.com";

type NotificationEvent =
  | "welcome"
  | "order_confirmation"
  | "order_status"
  | "store_new_order";

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
  stores: { name: string | null } | { name: string | null }[] | null;
  order_items: Array<{
    title: string;
    quantity: number;
    size: string | null;
    color_name: string | null;
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
  if (error.code === "23505") return false;
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
      "id, order_number, shopper_id, store_id, status, total_aed, delivery_area, delivery_phone, delivery_eta_minutes, stores(name), order_items(title, quantity, size, color_name, line_total_aed)",
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
        deliveryEta: deliveryPromise(order.delivery_eta_minutes),
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

export async function sendOrderStatusEmail(orderId: string) {
  const order = await getOrderEmailRecord(orderId);
  const recipient = await getRecipient(order.shopper_id);
  const eventId = `${order.id}:${order.status}`;
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
      subject: `Your Morni order ${order.order_number} is ${orderStatusLabel(order.status).toLowerCase()}`,
      react: OrderStatusEmail({
        name: recipient.name,
        orderNumber: order.order_number,
        statusLabel: orderStatusLabel(order.status),
        statusMessage: statusMessage(order.status),
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

function recipientId(order: OrderEmailRecord) {
  return order.shopper_id;
}
