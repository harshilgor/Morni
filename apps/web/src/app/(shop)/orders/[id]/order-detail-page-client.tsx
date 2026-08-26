"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { emirateLabel, formatAed, orderStatusLabel } from "@/lib/format";
import type { Order, OrderItem, ProductReview } from "@/lib/types";
import { formatCustomizationValues } from "@/lib/product-customization";
import { ProductReviewForm } from "@/components/product-review-form";
import { StarRating } from "@/components/star-rating";
import { ReturnRefundPanel } from "@/components/return-refund-panel";

const STEPS = ["placed", "accepted", "picking", "out_for_delivery", "delivered"] as const;

type OrderStore = {
  name: string;
  slug: string;
};

type OrderWithStore = Order & {
  stores: OrderStore | OrderStore[] | null;
};
type DeliveryCode = { status: "pending"; otp_code: string };

function resolveStore(stores: OrderWithStore["stores"]): OrderStore | null {
  if (!stores) return null;
  return Array.isArray(stores) ? (stores[0] ?? null) : stores;
}

export default function OrderDetailPageClient({ orderId }: { orderId: string }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-14 text-muted">Loading…</div>}>
      <OrderDetailPageContent orderId={orderId} />
    </Suspense>
  );
}

function OrderDetailPageContent({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderWithStore | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [deliveryCode, setDeliveryCode] = useState<DeliveryCode | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const paymentFlash = searchParams.get("paid") === "1"
    ? "paid"
    : searchParams.get("payment") === "failed"
      ? "failed"
      : null;

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: orderData } = await supabase
        .from("orders")
        .select("*, stores(name, slug)")
        .eq("id", orderId)
        .maybeSingle();
      setOrder((orderData as OrderWithStore) ?? null);
      const { data: itemData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      setItems((itemData as OrderItem[]) ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setReviews([]);
        return;
      }
      const productIds = ((itemData as OrderItem[]) ?? [])
        .map((item) => item.product_id)
        .filter(Boolean) as string[];
      if (productIds.length === 0) {
        setReviews([]);
        return;
      }
      const { data: reviewData } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("shopper_id", user.id)
        .in("product_id", productIds);
      setReviews((reviewData as ProductReview[]) ?? []);
    })();
  }, [orderId, reloadKey]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => setReloadKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs" }, () => setReloadKey((value) => value + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId]);

  useEffect(() => {
    if (!order || order.status !== "out_for_delivery") { window.queueMicrotask(() => setDeliveryCode(null)); return; }
    let active = true;
    const checkCode = async () => {
      const { data } = await createClient().rpc("shopper_delivery_handoff_code", { p_order_id: order.id });
      const next = data as DeliveryCode | { status: "not_requested" } | null;
      if (active) setDeliveryCode(next && next.status === "pending" && "otp_code" in next ? next : null);
    };
    void checkCode();
    const interval = window.setInterval(() => void checkCode(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [order]);

  if (!order) {
    return <div className="mx-auto max-w-3xl px-4 py-14 text-muted">Loading…</div>;
  }

  const store = resolveStore(order.stores);
  const stepIndex = STEPS.indexOf(
    order.status === "cancelled" ? "placed" : (order.status as (typeof STEPS)[number]),
  );
  const reviewableItems = order.status === "delivered"
    ? items.filter((item) => item.product_id)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/orders" className="text-sm text-muted hover:text-ink">
        ← All orders
      </Link>
      <h1 className="mt-4 font-display text-4xl text-ink">{order.order_number}</h1>
      <p className="mt-2 text-muted">{orderStatusLabel(order.status)}</p>
      {store ? (
        <p className="mt-1 text-sm text-muted">
          From{" "}
          <Link
            href={`/stores/${store.slug}`}
            className="font-medium text-ink underline-offset-2 hover:text-accent-deep hover:underline"
          >
            {store.name}
          </Link>
        </p>
      ) : null}

      {paymentFlash === "paid" ? (
        <p className="mt-6 rounded-xl bg-[#eef8f1] px-4 py-3 text-sm text-ink">
          Payment received. The boutique has been notified.
        </p>
      ) : null}
      {paymentFlash === "failed" ||
      (order.payment_method === "card" &&
        order.payment_status !== "paid" &&
        order.status !== "cancelled") ? (
        <div className="mt-6 space-y-3 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
          <p>
            {paymentFlash === "failed"
              ? "Payment was not completed. You can try again below."
              : "Payment required. Complete card payment so the boutique can start preparing your order."}
          </p>
          <Link
            href={`/checkout/pay/${order.id}`}
            className="inline-flex border-b border-accent-deep font-semibold uppercase tracking-[0.08em]"
          >
            Pay now
          </Link>
        </div>
      ) : null}

      {order.status !== "cancelled" ? (
        <div className="mt-8 grid grid-cols-5 gap-2">
          {STEPS.map((step, i) => (
            <div key={step} className="text-center">
              <div
                className={`mx-auto h-2 rounded-full ${i <= stepIndex ? "bg-accent" : "bg-line"}`}
              />
              <p className="mt-2 text-[10px] uppercase tracking-wide text-muted">
                {orderStatusLabel(step)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
          This order was cancelled.
        </p>
      )}

      <div className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
        <h2 className="font-display text-2xl">Items</h2>
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.title}
                {item.color_name ? ` · ${item.color_name}` : ""}
                {item.size ? ` · Size ${item.size}` : ""} × {item.quantity}
                {formatCustomizationValues(null, item.customization).length ? ` · Custom: ${formatCustomizationValues(null, item.customization).map((measurement) => `${measurement.label} ${measurement.value}`).join(", ")}` : ""}
              </span>
              <span>{formatAed(item.line_total_aed)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Payment</span>
            <span>
              {order.payment_method === "cod"
                ? "Cash on delivery"
                : order.payment_status === "paid"
                  ? "Card · Paid"
                  : order.payment_status === "failed"
                    ? "Card · Payment failed"
                    : "Card · Payment required"}
            </span>
          </div>
          <div className="mt-2 flex justify-between font-medium">
            <span>Total</span>
            <span>{formatAed(order.total_aed)}</span>
          </div>
        </div>
      </div>

      {reviewableItems.length > 0 ? (
        <div className="mt-4 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
          <div>
            <h2 className="font-display text-2xl text-ink">Rate your items</h2>
            <p className="mt-1 text-sm text-muted">
              Share a verified review for products from this delivered order.
            </p>
          </div>
          {reviewableItems.map((item) => {
            const existing = reviews.find(
              (review) => review.product_id === item.product_id,
            );
            return (
              <div key={item.id} className="rounded-2xl border border-line/70 bg-white/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  {existing ? (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <StarRating value={existing.rating} />
                      <span>Review submitted</span>
                    </div>
                  ) : null}
                </div>
                {item.product_id ? (
                  <ProductReviewForm
                    key={existing?.id ?? item.id}
                    productId={item.product_id}
                    orderId={order.id}
                    orderItemId={item.id}
                    existingReviewId={existing?.id}
                    initialRating={existing?.rating}
                    initialBody={existing?.body}
                    onSaved={() => setReloadKey((value) => value + 1)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {order.status === "delivered" && items.length > 0 ? (
        <ReturnRefundPanel order={order} items={items} />
      ) : null}

      <div className="mt-4 rounded-[1.5rem] border border-line bg-surface p-6 text-sm">
        <h2 className="font-display text-2xl">Delivery</h2>
        <p className="mt-3 text-ink">
          {order.delivery_street}
          {order.delivery_building ? `, ${order.delivery_building}` : ""}
          {order.delivery_apartment ? `, ${order.delivery_apartment}` : ""}
        </p>
        <p className="text-muted">
          {order.delivery_area}, {emirateLabel(order.delivery_emirate)}
        </p>
        {order.delivery_phone ? (
          <p className="mt-2 text-muted">Contact: {order.delivery_phone}</p>
        ) : null}
        {order.delivery_notes ? (
          <p className="mt-2 text-muted">Notes: {order.delivery_notes}</p>
        ) : null}
        {deliveryCode ? (
          <div className="mt-5 rounded-2xl border border-[#b9d9c7] bg-[#f0faf3] p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#277044]">Delivery verification</p>
            <h3 className="mt-1 text-lg font-semibold text-[#19342b]">Show this code to your rider</h3>
            <p className="mt-1 text-sm text-[#5d7268]">Your order is on the way. The rider needs this code to complete delivery.</p>
            <p className="mt-4 rounded-xl bg-white py-3 text-3xl font-bold tracking-[0.3em] text-[#155C4B]">{deliveryCode.otp_code}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
