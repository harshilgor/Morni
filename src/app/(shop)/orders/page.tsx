"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatAed, orderStatusLabel } from "@/lib/format";
import { formatDeliverySlotShort } from "@/lib/delivery-slots";
import type { Order } from "@/lib/types";

type OrderListRow = Order & {
  stores?: { name?: string | null; slug?: string | null } | Array<{ name?: string | null; slug?: string | null }> | null;
  order_items?: Array<{ quantity: number }> | null;
};

function storeName(order: OrderListRow) {
  const store = Array.isArray(order.stores) ? order.stores[0] : order.stores;
  return store?.name ?? "Morni store";
}

function statusCopy(order: OrderListRow) {
  if (order.status === "delivered") return "Delivered · Returns available for 14 days";
  if (order.status === "cancelled") return "Cancelled · Inventory restored";
  return orderStatusLabel(order.status);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("orders")
        .select("*, stores(name, slug), order_items(quantity)")
        .eq("shopper_id", user.id)
        .order("placed_at", { ascending: false });
      setOrders((data as OrderListRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="skeleton h-10 w-48" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-muted">Sign in to see your orders.</p>
        <Link href="/auth?next=/orders" className="mt-4 inline-block text-accent-deep underline">
          Sign in
        </Link>
      </div>
    );
  }

  const active = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-deep">Morni account</p><h1 className="mt-2 font-display text-4xl text-ink">Your orders</h1><p className="mt-2 text-sm text-muted">Track every delivery, return, and refund in one place.</p></div>
        {active ? <span className="rounded-full bg-[#eef8f1] px-3 py-1.5 text-xs font-bold text-[#277044]">{active} in progress</span> : null}
      </div>
      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="group block h-full rounded-[1.35rem] border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_16px_30px_-26px_rgba(33,61,51,0.8)]"
              >
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-accent-deep">{order.order_number}</p><p className="mt-1 font-semibold text-ink">{storeName(order)}</p></div><span className="text-lg text-accent-deep transition group-hover:translate-x-0.5">→</span></div>
                <p className="mt-4 text-sm font-medium text-ink">{statusCopy(order)}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>{order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} item{(order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0) === 1 ? "" : "s"}</span><span>{formatDeliverySlotShort(order.delivery_slot_start, order.delivery_slot_end) ?? `ETA ${order.delivery_eta_minutes} min`}</span><span className="font-semibold text-ink">{formatAed(order.total_aed)}</span></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
