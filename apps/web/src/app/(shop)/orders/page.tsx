"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatAed, orderStatusLabel } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
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
        .select("*")
        .eq("shopper_id", user.id)
        .order("placed_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-14 text-muted">Loading orders…</div>;
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl text-ink">Your orders</h1>
      {orders.length === 0 ? (
        <p className="mt-8 text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-accent"
              >
                <div>
                  <p className="font-medium text-ink">{order.order_number}</p>
                  <p className="text-sm text-muted">
                    {orderStatusLabel(order.status)} · {formatAed(order.total_aed)}
                  </p>
                </div>
                <span className="text-xs text-accent-deep">
                  ETA {order.delivery_eta_minutes} min
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
