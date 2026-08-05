"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  deliveryPromise,
  emirateLabel,
  formatAed,
  orderStatusLabel,
} from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

const STEPS = ["placed", "accepted", "picking", "out_for_delivery", "delivered"] as const;

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

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
    })();
  }, [params.id]);

  if (!order) {
    return <div className="mx-auto max-w-3xl px-4 py-14 text-muted">Loading…</div>;
  }

  const stepIndex = STEPS.indexOf(
    order.status === "cancelled" ? "placed" : (order.status as (typeof STEPS)[number]),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/orders" className="text-sm text-muted hover:text-ink">
        ← All orders
      </Link>
      <h1 className="mt-4 font-display text-4xl text-ink">{order.order_number}</h1>
      <p className="mt-2 text-muted">
        {orderStatusLabel(order.status)} · {deliveryPromise(order.delivery_eta_minutes)}
      </p>

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
        {order.delivery_notes ? (
          <p className="mt-2 text-muted">Notes: {order.delivery_notes}</p>
        ) : null}
      </div>
    </div>
  );
}
