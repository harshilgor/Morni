"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed, orderStatusLabel, slugify } from "@/lib/format";
import type { Order, OrderStatus, Store } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "picking",
  picking: "out_for_delivery",
  out_for_delivery: "delivered",
};

export default function PortalOrdersPage() {
  const { store, loading, error, userId, refresh } = useOwnerStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [claimable, setClaimable] = useState<Store[]>([]);
  const [newStoreName, setNewStoreName] = useState("");
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
    if (loading || store || error === "unauthenticated") return;
    const supabase = createClient();
    supabase
      .from("stores")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => setClaimable((data as Store[]) ?? []));
  }, [loading, store, error]);

  async function claimStore(storeId: string) {
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ role: "store_owner" }).eq("id", userId);
    const { error: err } = await supabase.from("store_members").insert({
      store_id: storeId,
      user_id: userId,
    });
    setBusy(false);
    if (err) {
      setMessage(err.message);
      return;
    }
    await refresh();
  }

  async function createStore(e: FormEvent) {
    e.preventDefault();
    if (!userId || !newStoreName.trim()) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ role: "store_owner" }).eq("id", userId);
    const slug = slugify(newStoreName);
    const { data, error: err } = await supabase
      .from("stores")
      .insert({
        name: newStoreName.trim(),
        slug,
        description: "",
        emirate: "dubai",
        area: "Dubai Marina",
        address: "Update your address in Store settings",
        is_active: true,
        delivery_eta_minutes: 60,
      })
      .select("*")
      .single();
    if (err || !data) {
      setMessage(err?.message ?? "Could not create store");
      setBusy(false);
      return;
    }
    await supabase.from("store_members").insert({
      store_id: data.id,
      user_id: userId,
    });
    setBusy(false);
    await refresh();
  }

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
      <div className="max-w-xl space-y-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Set up your store</h1>
          <p className="mt-2 text-sm text-muted">
            Claim a demo store or create a new one to manage catalog and orders.
          </p>
        </div>

        {claimable.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-ink">Claim a demo store</h2>
            {claimable.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => claimStore(s.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left text-sm hover:border-accent"
              >
                <span>{s.name}</span>
                <span className="text-accent-deep">Claim</span>
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={createStore} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Or create a new store</h2>
          <input
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
            placeholder="Boutique name"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            Create store
          </button>
        </form>
        {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
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
