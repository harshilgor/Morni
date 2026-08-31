"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InventoryNotification = {
  id: string;
  kind: "legacy_size_inventory" | "restored_inventory";
  title: string;
  detail: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  product_id: string | null;
};

export function InventoryNotifications({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<InventoryNotification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void createClient().from("store_inventory_notifications").select("id,kind,title,detail,status,created_at,product_id").eq("store_id", storeId).order("created_at", { ascending: false }).limit(20).then(({ data }) => { if (active) setItems((data ?? []) as InventoryNotification[]); });
    return () => { active = false; };
  }, [storeId]);

  async function resolve(id: string, decision: "accepted" | "rejected") {
    setBusyId(id);
    const { data, error } = await createClient().rpc("resolve_inventory_notification", { p_notification_id: id, p_decision: decision });
    if (!error && data) setItems((current) => current.map((item) => item.id === id ? { ...item, status: decision } : item));
    setBusyId(null);
  }

  const pending = items.filter((item) => item.status === "pending");
  if (!items.length) return null;
  return <section className="rounded-2xl border border-[#e4bda9] bg-[#fff9f4] p-5 shadow-[0_12px_30px_-24px_rgba(127,65,45,0.55)]" aria-labelledby="inventory-notifications-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="portal-eyebrow text-[#a6542e]">Inventory notifications</p><h2 id="inventory-notifications-heading" className="mt-1 text-xl font-semibold text-[#1d2925]">Review stock changes</h2><p className="mt-1 text-sm leading-6 text-[#6f5148]">Confirm restored stock or reject it if the item should remain unavailable.</p></div>{pending.length ? <span className="rounded-full bg-[#f4d6c5] px-2.5 py-1 text-xs font-bold text-[#8c492d]">{pending.length} pending</span> : null}</div>
    <div className="mt-4 space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-[#f0d7ca] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#263530]">{item.title}</p><p className="mt-1 text-xs leading-5 text-[#6f5148]">{item.detail}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${item.status === "pending" ? "bg-[#fff1dc] text-[#9c5b05]" : item.status === "accepted" ? "bg-[#e2f3e8] text-[#277044]" : "bg-[#f1e8e8] text-[#8c5555]"}`}>{item.status}</span></div>{item.status === "pending" && item.kind === "restored_inventory" ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busyId === item.id} onClick={() => void resolve(item.id, "accepted")} className="rounded-lg bg-[#21342e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Accept restoration</button><button type="button" disabled={busyId === item.id} onClick={() => void resolve(item.id, "rejected")} className="rounded-lg border border-[#d7b4a4] px-3 py-2 text-xs font-semibold text-[#8c492d] disabled:opacity-50">Reject restoration</button></div> : null}{item.status === "pending" && item.kind === "legacy_size_inventory" ? <a href={`/portal/products?edit=${item.product_id ?? ""}`} className="mt-3 inline-flex rounded-lg bg-[#21342e] px-3 py-2 text-xs font-semibold text-white">Set size quantities</a> : null}</div>)}</div>
  </section>;
}
