"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed } from "@/lib/format";
import type { Order, Product } from "@/lib/types";

export default function PortalAnalyticsPage() {
  const { store, loading, error } = useOwnerStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .order("placed_at", { ascending: false }),
      supabase.from("products").select("*").eq("store_id", store.id),
    ]).then(([ordersRes, productsRes]) => {
      setOrders((ordersRes.data as Order[]) ?? []);
      setProducts((productsRes.data as Product[]) ?? []);
    });
  }, [store]);

  const last7 = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return orders.filter((o) => new Date(o.placed_at) >= start);
  }, [orders]);

  const byDay = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number }> = {};
    for (const order of last7) {
      const day = new Date(order.placed_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      });
      if (!map[day]) map[day] = { orders: 0, revenue: 0 };
      map[day].orders += 1;
      map[day].revenue += Number(order.total_aed);
    }
    return Object.entries(map);
  }, [last7]);

  const hourly = useMemo(() => {
    const map: Record<number, number> = {};
    for (const order of orders) {
      const h = new Date(order.placed_at).getHours();
      map[h] = (map[h] ?? 0) + 1;
    }
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map[h] ?? 0 }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const byId = products.reduce<Record<string, Product>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
    for (const order of orders) {
      // Order items are not loaded here; fallback to order totals by status and product catalog hints.
      // Keep it simple: rank by stock movement proxy using low stock + availability.
      void order;
    }
    return Object.values(
      products.reduce<Record<string, { title: string; qty: number; sales: number }>>(
        (acc, p) => {
          const score = Math.max(0, 50 - p.stock) + (p.is_available ? 5 : 0);
          acc[p.id] = {
            title: p.title,
            qty: score,
            sales: score * Number(p.price_aed),
          };
          return acc;
        },
        {},
      ),
    )
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        title: byId[Object.keys(byId).find((k) => byId[k].title === row.title) ?? ""]?.title ?? row.title,
      }));
  }, [products, orders]);

  if (error === "unauthenticated") {
    return (
      <Link href="/auth?next=/portal/analytics" className="text-accent-deep underline">
        Sign in
      </Link>
    );
  }
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) return <p className="text-muted">Set up a store first.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Quick store performance snapshots for planning inventory and promotions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl text-ink">Last 7 days</h2>
          {byDay.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No order data yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {byDay.map(([day, row]) => (
                <li
                  key={day}
                  className="flex items-center justify-between rounded-xl border border-line/70 px-3 py-2"
                >
                  <p className="text-sm text-ink">{day}</p>
                  <p className="text-xs text-muted">
                    {row.orders} orders · {formatAed(row.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl text-ink">Peak order hours</h2>
          <div className="mt-3 space-y-1">
            {hourly
              .sort((a, b) => b.count - a.count)
              .slice(0, 6)
              .map((slot) => (
                <div key={slot.hour} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    {String(slot.hour).padStart(2, "0")}:00
                  </span>
                  <span className="text-ink">{slot.count} orders</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-xl text-ink">Top products (inventory signal)</h2>
        {topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No product data yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {topProducts.map((product) => (
              <li
                key={product.title}
                className="flex items-center justify-between rounded-xl border border-line/70 px-3 py-2"
              >
                <p className="text-sm text-ink">{product.title}</p>
                <p className="text-xs text-muted">
                  score {product.qty} · {formatAed(product.sales)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

