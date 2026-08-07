"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed, orderStatusLabel } from "@/lib/format";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "picking",
  picking: "out_for_delivery",
  out_for_delivery: "delivered",
};

type OrderWithItems = Order & { order_items?: OrderItem[] };

export default function PortalOrdersPage() {
  const { store, loading, error } = useOwnerStore();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("store_id", store.id)
      .order("placed_at", { ascending: false })
      .then(({ data }) => setOrders((data as OrderWithItems[]) ?? []));
  }, [store]);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`portal-orders-${store.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${store.id}`,
        },
        async () => {
          const { data } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("store_id", store.id)
            .order("placed_at", { ascending: false });
          setOrders((data as OrderWithItems[]) ?? []);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store]);

  async function advance(order: OrderWithItems) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const supabase = createClient();
    const updatePayload: { status: OrderStatus } = { status: next };
    const { error: err } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);
    if (err) {
      setMessage(err.message);
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: next,
            }
          : o,
      ),
    );
  }

  const visibleOrders = useMemo(
    () =>
      statusFilter === "all"
        ? orders
        : orders.filter((order) => order.status === statusFilter),
    [orders, statusFilter],
  );

  if (error === "unauthenticated") {
    return (
      <div>
        <p className="text-muted">Sign in as a store owner to open the portal.</p>
        <Link
          href="/auth?next=/portal/orders"
          className="mt-3 inline-block text-accent-deep underline"
        >
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
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Orders</h1>
          <p className="mt-1 text-sm text-muted">{store.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "placed", "accepted", "picking", "out_for_delivery", "delivered", "cancelled"] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  statusFilter === status
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {status === "all" ? "All" : orderStatusLabel(status)}
              </button>
            ),
          )}
        </div>
      </div>

      {message ? <p className="mb-4 text-sm text-accent-deep">{message}</p> : null}

      {visibleOrders.length === 0 ? (
        <p className="text-muted">No matching orders.</p>
      ) : (
        <ul className="space-y-3">
          {visibleOrders.map((order) => {
            const expanded = expandedOrder === order.id;
            return (
              <li
                key={order.id}
                className="rounded-2xl border border-line bg-surface px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
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

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrder((curr) => (curr === order.id ? null : order.id))
                      }
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
                    >
                      {expanded ? "Hide details" : "View details"}
                    </button>
                    {NEXT_STATUS[order.status] ? (
                      <>
                        <button
                          type="button"
                          onClick={() => advance(order)}
                          className="rounded-full bg-ink px-4 py-2 text-xs text-white"
                        >
                          Mark {orderStatusLabel(NEXT_STATUS[order.status]!)}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-line bg-background/40 p-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">Delivery</p>
                      <p className="text-muted">
                        {order.delivery_street}
                        {order.delivery_building ? `, ${order.delivery_building}` : ""}
                        {order.delivery_apartment ? `, ${order.delivery_apartment}` : ""}
                      </p>
                      {order.delivery_notes ? (
                        <p className="mt-1 text-xs text-muted">Notes: {order.delivery_notes}</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="font-medium text-ink">Items</p>
                      {order.order_items?.length ? (
                        <ul className="mt-1 space-y-1">
                          {order.order_items.map((item) => (
                            <li key={item.id} className="text-muted">
                              {item.quantity}x {item.title}
                              {item.color_name ? ` · ${item.color_name}` : ""}
                              {item.size ? ` · Size ${item.size}` : ""} ·{" "}
                              {formatAed(item.line_total_aed)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted">No items listed.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

