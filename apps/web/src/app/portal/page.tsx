"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed, orderStatusLabel } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "picking",
  picking: "out_for_delivery",
  out_for_delivery: "delivered",
};

export default function PortalOrdersPage() {
  const { store, loading, error } = useOwnerStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", store.id)
      .order("placed_at", { ascending: false })
      .then(({ data }) => setOrders((data as Order[]) ?? []));
  }, [store]);

  async function advance(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const supabase = createClient();
    const { error: err } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);
    if (err) {
      setMessage(err.message);
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    );
  }

  if (error === "unauthenticated") {
    return (
      <div>
        <p className="text-muted">Sign in as a store owner to open the portal.</p>
        <Link href="/auth?next=/portal" className="mt-3 inline-block text-accent-deep underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) return <p className="text-muted">Loading portal…</p>;

  if (!store) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="font-display text-3xl text-ink">Finish store setup</h1>
        <p className="text-sm text-muted">
          You don’t have a store linked yet. Continue the seller onboarding to create
          one, then come back to manage orders here.
        </p>
        <Link
          href="/sell/setup"
          className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-white"
        >
          Continue setup
        </Link>
        <Link href="/sell" className="ml-3 text-sm text-accent-deep underline">
          About selling on Morni
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">Orders</h1>
        <p className="mt-1 text-sm text-muted">{store.name}</p>
      </div>

      {message ? <p className="mb-4 text-sm text-accent-deep">{message}</p> : null}

      {orders.length === 0 ? (
        <p className="text-muted">No orders yet for this store.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4"
            >
              <div>
                <p className="font-medium">{order.order_number}</p>
                <p className="text-sm text-muted">
                  {orderStatusLabel(order.status)} · {formatAed(order.total_aed)} ·{" "}
                  {order.payment_method.toUpperCase()}
                </p>
                <p className="text-xs text-muted">
                  {order.delivery_area} · ETA {order.delivery_eta_minutes} min
                </p>
              </div>
              {NEXT_STATUS[order.status] ? (
                <button
                  type="button"
                  onClick={() => advance(order)}
                  className="rounded-full bg-ink px-4 py-2 text-xs text-white"
                >
                  Mark {orderStatusLabel(NEXT_STATUS[order.status]!)}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
