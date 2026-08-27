"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { emirateLabel, formatAed, orderStatusLabel } from "@/lib/format";
import { formatDeliverySlotWindow } from "@/lib/delivery-slots";
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
type DeliveryTracking = {
  status: string | null;
  driver_name: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  eta_minutes: number | null;
  accepted_at: string | null;
  updated_at: string | null;
};

function resolveStore(stores: OrderWithStore["stores"]): OrderStore | null {
  if (!stores) return null;
  return Array.isArray(stores) ? (stores[0] ?? null) : stores;
}

export default function OrderDetailPageClient({ orderId }: { orderId: string }) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetailPageContent orderId={orderId} />
    </Suspense>
  );
}

function OrderDetailSkeleton() {
  return <div className="mx-auto max-w-3xl space-y-5 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading order details">
    <div className="h-4 w-24 animate-pulse rounded bg-line/70" />
    <div className="h-12 w-56 animate-pulse rounded bg-line/70" />
    <div className="h-24 animate-pulse rounded-2xl bg-line/50" />
    <div className="h-56 animate-pulse rounded-[1.5rem] bg-line/50" />
  </div>;
}

function OrderDetailPageContent({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderWithStore | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [deliveryCode, setDeliveryCode] = useState<DeliveryCode | null>(null);
  const [deliveryTracking, setDeliveryTracking] = useState<DeliveryTracking | null>(null);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [instructionError, setInstructionError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
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
    if (!order) { window.queueMicrotask(() => setDeliveryCode(null)); return; }
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

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  useEffect(() => {
    if (!order) {
      const timeout = window.setTimeout(() => setDeliveryTracking(null), 0);
      return () => window.clearTimeout(timeout);
    }
    if (!online) return;
    let active = true;
    const loadTracking = async () => {
      const { data } = await createClient().rpc("shopper_order_delivery_tracking", { p_order_id: order.id });
      if (active) setDeliveryTracking((data as DeliveryTracking | null) ?? null);
    };
    void loadTracking();
    const interval = window.setInterval(() => void loadTracking(), 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [order, online]);

  useEffect(() => {
    if (!order) return;
    const timeout = window.setTimeout(() => {
      setInstructionDraft(order.delivery_notes ?? "");
      setEditingInstructions(false);
      setInstructionError(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [order]);

  async function saveInstructions() {
    setSavingInstructions(true);
    setInstructionError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNotes: instructionDraft }),
      });
      const payload = (await response.json().catch(() => null)) as { order?: { delivery_notes?: string | null }; error?: string } | null;
      if (!response.ok) {
        setInstructionError(payload?.error ?? "Could not save delivery instructions.");
        return;
      }
      setOrder((current) => current ? { ...current, delivery_notes: payload?.order?.delivery_notes ?? null } : current);
      setEditingInstructions(false);
    } catch {
      setInstructionError("Could not save delivery instructions. Check your connection and try again.");
    } finally {
      setSavingInstructions(false);
    }
  }

  if (!order) {
    return <OrderDetailSkeleton />;
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
      {!online ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">You are offline. This page will refresh delivery updates when you reconnect.</p> : null}
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

      {deliveryTracking?.status && ["accepted", "at_pickup", "collected"].includes(deliveryTracking.status) ? (
        <section className="mt-6 rounded-[1.5rem] border border-[#cfe5dc] bg-[#f2f9f5] p-5" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#277044]">Delivery update</p>
              <h2 className="mt-1 text-xl font-semibold text-[#19342b]">
                {deliveryTracking.status === "collected" ? "Your rider is on the way" : "Your rider is heading to the store"}
              </h2>
              <p className="mt-1 text-sm text-[#5d7268]">
                {deliveryTracking.driver_name ? `${deliveryTracking.driver_name} is handling your delivery.` : "A rider has been assigned to your delivery."}
              </p>
            </div>
            {deliveryTracking.eta_minutes ? <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#155C4B]">About {deliveryTracking.eta_minutes} min</span> : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#5d7268]">
            <span>{deliveryTracking.status === "collected" ? "Heading to your address" : "Preparing pickup"}</span>
            {deliveryTracking.last_location_at ? <span>· Location updated {new Intl.DateTimeFormat("en-AE", { hour: "numeric", minute: "2-digit" }).format(new Date(deliveryTracking.last_location_at))}</span> : null}
            {deliveryTracking.last_lat != null && deliveryTracking.last_lng != null ? (
              <a className="font-semibold text-[#155C4B] underline underline-offset-2" href={`https://www.google.com/maps/search/?api=1&query=${deliveryTracking.last_lat},${deliveryTracking.last_lng}`} target="_blank" rel="noreferrer">View latest location</a>
            ) : null}
          </div>
        </section>
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
        {["placed", "accepted"].includes(order.status) ? (
          <div className="mt-4 border-t border-line pt-4">
            {!editingInstructions ? (
              <button type="button" onClick={() => setEditingInstructions(true)} className="min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-sand" aria-label="Edit delivery instructions">
                {order.delivery_notes ? "Edit delivery instructions" : "Add delivery instructions"}
              </button>
            ) : (
              <div>
                <label htmlFor="order-delivery-instructions" className="text-sm font-semibold text-ink">Delivery instructions</label>
                <textarea id="order-delivery-instructions" value={instructionDraft} onChange={(event) => setInstructionDraft(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm" placeholder="Gate code, landmark, or preferred drop-off spot" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void saveInstructions()} disabled={savingInstructions} className="min-h-10 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingInstructions ? "Saving…" : "Save instructions"}</button>
                  <button type="button" onClick={() => { setInstructionDraft(order.delivery_notes ?? ""); setEditingInstructions(false); setInstructionError(null); }} disabled={savingInstructions} className="min-h-10 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink">Cancel</button>
                  <span className="text-xs text-muted">{instructionDraft.length}/1000</span>
                </div>
                {instructionError ? <p className="mt-2 text-sm text-accent-deep" role="alert">{instructionError}</p> : null}
              </div>
            )}
          </div>
        ) : null}
        {formatDeliverySlotWindow(order.delivery_slot_start, order.delivery_slot_end) ? (
          <p className="mt-3 font-medium text-ink">
            Scheduled: {formatDeliverySlotWindow(order.delivery_slot_start, order.delivery_slot_end)}
          </p>
        ) : null}
        {deliveryCode ? (
          <div className="mt-5 rounded-2xl border border-[#b9d9c7] bg-[#f0faf3] p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#277044]">Delivery verification</p>
            <h3 className="mt-1 text-lg font-semibold text-[#19342b]">Show this code to your rider</h3>
            <p className="mt-1 text-sm text-[#5d7268]">Keep this code ready. The rider needs it after taking a photo of your parcel.</p>
            <p className="mt-4 rounded-xl bg-white py-3 text-3xl font-bold tracking-[0.3em] text-[#155C4B]">{deliveryCode.otp_code}</p>
          </div>
        ) : null}
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-semibold text-ink">Need help with this delivery?</p>
          <a
            href={`mailto:mymorniuae@gmail.com?subject=${encodeURIComponent(`Help with order ${order.order_number}`)}`}
            className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
          >
            Contact Morni support
          </a>
        </div>
      </div>
    </div>
  );
}
