"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { emirateLabel, formatAed, orderStatusLabel } from "@/lib/format";
import type { Order, OrderItem, ProductReview } from "@/lib/types";
import { ProductReviewForm } from "@/components/product-review-form";
import { StarRating } from "@/components/star-rating";

const STEPS = ["placed", "accepted", "picking", "out_for_delivery", "delivered"] as const;

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
      setOrder((orderData as Order) ?? null);
      const { data: itemData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", params.id);
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
  }, [params.id, reloadKey]);

  if (!order) {
    return <div className="mx-auto max-w-3xl px-4 py-14 text-muted">Loading…</div>;
  }

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
              </span>
              <span>{formatAed(item.line_total_aed)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Payment</span>
            <span>
              {order.payment_method.toUpperCase()} · {order.payment_status}
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
      </div>
    </div>
  );
}
