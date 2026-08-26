"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { PortalIcon } from "@/components/portal-icons";
import { PortalEmpty, PortalMetric, PortalPageHeader, StatusBadge } from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { formatAed, orderStatusLabel } from "@/lib/format";
import { useOwnerStore } from "@/lib/use-owner-store";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";
import { formatCustomizationValues } from "@/lib/product-customization";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "picking",
};

const FILTERS: { status: "all" | OrderStatus; label: string }[] = [
  { status: "all", label: "All orders" },
  { status: "placed", label: "New" },
  { status: "accepted", label: "Accepted" },
  { status: "picking", label: "Preparing" },
  { status: "out_for_delivery", label: "On delivery" },
  { status: "delivered", label: "Delivered" },
];

const FLOW: OrderStatus[] = ["placed", "accepted", "picking", "out_for_delivery", "delivered"];
type OrderFilter = "all" | "preparing" | OrderStatus;
type DeliveryProofSummary = { id: string; storage_path: string; created_at: string };
type DeliveryJobSummary = { id: string; status: "unassigned" | "assigned" | "accepted" | "at_pickup" | "collected" | "delivered" | "failed" | "cancelled"; delivery_proofs?: DeliveryProofSummary[] | null };
type OrderWithItems = Order & { order_items?: OrderItem[] | null; delivery_jobs?: DeliveryJobSummary[] | null };
type PickupHandoff = { id: string; status: "pending" | "verified" | "expired"; otp_code: string; requested_at: string };

function dueText(order: Order) {
  const due = new Date(new Date(order.placed_at).getTime() + order.delivery_eta_minutes * 60000);
  const minutes = Math.round((due.getTime() - Date.now()) / 60000);
  const clock = due.toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" });
  if (order.status === "delivered") return "Delivered";
  if (order.status === "cancelled") return "Cancelled";
  if (minutes < 0) return `${Math.abs(minutes)} min overdue`;
  if (minutes < 60) return `Due in ${minutes} min`;
  return `Due by ${clock}`;
}

function orderAddress(order: Order) {
  return [order.delivery_street, order.delivery_building, order.delivery_apartment, order.delivery_area]
    .filter(Boolean)
    .join(", ");
}

function placedText(value: string) {
  return new Date(value).toLocaleString("en-AE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function PortalOrdersPage() {
  const { store, loading, error } = useOwnerStore();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOrderId, setMobileOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pickupHandoff, setPickupHandoff] = useState<PickupHandoff | null>(null);
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  const loadOrders = useCallback(async (storeId: string) => {
    const { data } = await createClient().from("orders").select("*, order_items(*), delivery_jobs(id, status, delivery_proofs(id, storage_path, created_at))").eq("store_id", storeId).order("placed_at", { ascending: false });
    const rows = (data as OrderWithItems[]) ?? [];
    setOrders(rows);
    setSelectedId((current) => current && rows.some((order) => order.id === current) ? current : rows.find((order) => order.status === "placed")?.id ?? rows[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!store) return;
    const load = () => void loadOrders(store.id);
    if (typeof queueMicrotask === "function") queueMicrotask(load);
    else window.setTimeout(load, 0);
  }, [loadOrders, store]);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    const channel = supabase.channel(`portal-orders-${store.id}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, () => void loadOrders(store.id)).on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs" }, () => void loadOrders(store.id)).on("postgres_changes", { event: "*", schema: "public", table: "delivery_handoffs" }, () => void loadOrders(store.id)).on("postgres_changes", { event: "*", schema: "public", table: "delivery_proofs" }, () => void loadOrders(store.id)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadOrders, store]);

  useEffect(() => {
    const job = selectedOrder?.delivery_jobs?.[0];
    if (!job || job.status !== "at_pickup") { window.queueMicrotask(() => setPickupHandoff(null)); return; }
    let active = true;
    const check = async () => {
      const { data } = await createClient().rpc("store_delivery_handoff", { p_delivery_job_id: job.id });
      const next = data as PickupHandoff | { status: "not_requested" } | null;
      if (active && next && next.status === "pending" && "otp_code" in next) setPickupHandoff(next);
    };
    void check();
    const interval = window.setInterval(() => void check(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [selectedOrder]);

  useEffect(() => {
    const proofs = selectedOrder?.delivery_jobs?.[0]?.delivery_proofs ?? [];
    if (!proofs.length) { window.queueMicrotask(() => setProofUrls([])); return; }
    let active = true;
    void Promise.all(proofs.map(async (proof) => {
      const { data } = await createClient().storage.from("delivery-proofs").createSignedUrl(proof.storage_path, 3600);
      return data?.signedUrl ?? null;
    })).then((urls) => { if (active) setProofUrls(urls.filter((url): url is string => Boolean(url))); });
    return () => { active = false; };
  }, [selectedOrder]);

  const visibleOrders = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || (statusFilter === "preparing" ? ["accepted", "picking"].includes(order.status) : order.status === statusFilter);
      const matchesQuery = !q || [order.order_number, order.delivery_area, order.delivery_phone, ...(order.order_items ?? []).map((item) => item.title)].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [deferredQuery, orders, statusFilter]);
  const mobileOrder = visibleOrders.find((order) => order.id === mobileOrderId) ?? null;
  const stats = useMemo(() => ({
    newOrders: orders.filter((order) => order.status === "placed").length,
    preparing: orders.filter((order) => ["accepted", "picking"].includes(order.status)).length,
    delivery: orders.filter((order) => order.status === "out_for_delivery").length,
    today: orders.filter((order) => new Date(order.placed_at).toDateString() === new Date().toDateString() && order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total_aed), 0),
  }), [orders]);

  async function advance(order: OrderWithItems) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    setMessage(null);
    const response = await fetch(`/api/orders/${order.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to update this order.");
      setUpdatingId(null);
      return;
    }
    setOrders((current) => current.map((candidate) => candidate.id === order.id ? { ...candidate, status: next } : candidate));
    setMessage(`${order.order_number} marked ${orderStatusLabel(next).toLowerCase()}.`);
    setUpdatingId(null);
  }

  async function markReadyForPickup(order: OrderWithItems) {
    setUpdatingId(order.id);
    setMessage(null);
    const response = await fetch(`/api/orders/${order.id}/ready-for-pickup`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { error?: string; delivery?: DeliveryJobSummary } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to send this order to delivery dispatch.");
      setUpdatingId(null);
      return;
    }
    setOrders((current) => current.map((candidate) => candidate.id === order.id ? { ...candidate, delivery_jobs: payload?.delivery ? [payload.delivery] : candidate.delivery_jobs } : candidate));
    setMessage(`${order.order_number} is now in the delivery dispatch queue.`);
    setUpdatingId(null);
  }

  async function copyAddress(order: Order) {
    try {
      await navigator.clipboard.writeText(orderAddress(order));
      setMessage("Delivery address copied.");
    } catch {
      setMessage("Could not copy the delivery address.");
    }
  }

  if (error === "unauthenticated") return <PortalEmpty icon="orders" title="Sign in to manage orders" description="Use the owner account linked to your Morni store." action={{ label: "Sign in", href: "/auth?next=/portal/orders" }} />;
  if (loading) return <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/65" />)}</div>;
  if (!store) return <PortalEmpty icon="store" title="Set up your store to receive orders" description="Once your store is live, every new shopper order will appear here." action={{ label: "Start store setup", href: "/sell/setup" }} />;

  return <div className="space-y-5 sm:space-y-6">
    <PortalPageHeader eyebrow="Fulfilment" title="Orders" description="See what needs attention, then move each order forward." />
    <section className="sm:hidden" aria-label="Order summary">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_8px_24px_rgba(28,48,40,0.05)]">
        <button type="button" onClick={() => setStatusFilter("placed")} aria-pressed={statusFilter === "placed"} className={`border-b border-r border-[#edf1ef] px-3 py-3 text-left transition ${statusFilter === "placed" ? "bg-[#fff7f2]" : "hover:bg-[#fafcfb]"}`}><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#687870]"><PortalIcon name="orders" className="h-3.5 w-3.5" />New</span><span className={`mt-1 block text-xl font-semibold tracking-[-0.04em] ${stats.newOrders ? "text-[#b55a36]" : "text-[#17231f]"}`}>{stats.newOrders}</span></button>
        <button type="button" onClick={() => setStatusFilter("preparing")} aria-pressed={statusFilter === "preparing"} className={`border-b border-[#edf1ef] px-3 py-3 text-left transition ${statusFilter === "preparing" ? "bg-[#f3f8f5]" : "hover:bg-[#fafcfb]"}`}><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#687870]"><PortalIcon name="package" className="h-3.5 w-3.5" />Preparing</span><span className="mt-1 block text-xl font-semibold tracking-[-0.04em] text-[#17231f]">{stats.preparing}</span></button>
        <button type="button" onClick={() => setStatusFilter("out_for_delivery")} aria-pressed={statusFilter === "out_for_delivery"} className={`border-r border-[#edf1ef] px-3 py-3 text-left transition ${statusFilter === "out_for_delivery" ? "bg-[#f3f8f5]" : "hover:bg-[#fafcfb]"}`}><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#687870]"><PortalIcon name="location" className="h-3.5 w-3.5" />On delivery</span><span className="mt-1 block text-xl font-semibold tracking-[-0.04em] text-[#17231f]">{stats.delivery}</span></button>
        <button type="button" onClick={() => setStatusFilter("all")} aria-pressed={statusFilter === "all"} className={`px-3 py-3 text-left transition ${statusFilter === "all" ? "bg-[#f3f8f5]" : "hover:bg-[#fafcfb]"}`}><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#687870]"><PortalIcon name="analytics" className="h-3.5 w-3.5" />Today</span><span className="mt-1 block text-lg font-semibold tracking-[-0.04em] text-[#17231f]">{formatAed(stats.today)}</span></button>
      </div>
    </section>
    <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4"><PortalMetric label="New orders" value={String(stats.newOrders)} detail="Need acceptance" icon="orders" tone={stats.newOrders ? "urgent" : "default"} /><PortalMetric label="Preparing" value={String(stats.preparing)} detail="Accepted or being packed" icon="package" /><PortalMetric label="On delivery" value={String(stats.delivery)} detail="With a courier" icon="location" /><PortalMetric label="Sales today" value={formatAed(stats.today)} detail="Excludes cancelled orders" icon="analytics" /></div>
    <section className="portal-card overflow-hidden"><div className="border-b border-[#edf1ef] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-[#1d2925]">Order queue</h2><p className="mt-1 text-xs text-[#7b8882]">Updates arrive here as shoppers place orders.</p></div><label className="relative w-full sm:w-72"><PortalIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8882]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="portal-input w-full pl-9" placeholder="Search order, area, item" /></label></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{FILTERS.map((filter) => { const count = filter.status === "all" ? orders.length : orders.filter((order) => order.status === filter.status).length; return <button key={filter.status} type="button" onClick={() => setStatusFilter(filter.status)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${statusFilter === filter.status ? "bg-[#21342e] text-white" : "border border-[#dce5e0] bg-white text-[#5b6a64] hover:border-[#afc2bb]"}`}>{filter.label}{count ? <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === filter.status ? "bg-white/15 text-white" : "bg-[#edf3f0] text-[#52756b]"}`}>{count}</span> : null}</button>; })}</div></div>
      {message ? <p role="status" className="border-b border-[#c9e7d4] bg-[#f1faf5] px-5 py-3 text-sm text-[#277044]">{message}</p> : null}
      {orders.length === 0 ? <div className="p-5"><PortalEmpty icon="orders" title="Your queue is clear" description="When customers order from your store, the next step will be ready right here." /></div> : <>
        <div className="sm:hidden">
          {mobileOrder ? <div><button type="button" onClick={() => setMobileOrderId(null)} className="flex w-full items-center gap-2 border-b border-[#edf1ef] px-4 py-3 text-sm font-semibold text-[#42675c]"><PortalIcon name="arrow" className="h-3.5 w-3.5 rotate-180" />All orders</button><OrderDetail order={mobileOrder} proofUrls={mobileOrder.id === selectedId ? proofUrls : []} onAdvance={advance} onReadyForPickup={markReadyForPickup} updatingId={updatingId} onCopyAddress={copyAddress} /></div> : <MobileOrderList orders={visibleOrders} onSelect={(order) => { setSelectedId(order.id); setMobileOrderId(order.id); }} />}
        </div>
        <div className="hidden min-h-[34rem] sm:grid xl:grid-cols-[minmax(0,1fr)_24rem]"><div className="min-w-0 overflow-x-auto"><table className="portal-table min-w-[740px] w-full text-left"><thead className="bg-[#fbfdfc]"><tr><th className="px-5 py-3">Order</th><th className="px-4 py-3">Delivery</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Due</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id} onClick={() => setSelectedId(order.id)} className={`cursor-pointer transition hover:bg-[#f8faf9] ${selectedId === order.id ? "bg-[#edf7f3]" : ""}`}><td className="px-5 py-4"><p className="text-sm font-semibold text-[#263530]">{order.order_number}</p><p className="mt-1 text-xs text-[#7b8882]">{placedText(order.placed_at)} · {(order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0)} item{(order.order_items ?? []).reduce((sum, item) => item.quantity + sum, 0) === 1 ? "" : "s"}</p></td><td className="px-4 py-4"><p className="text-sm text-[#34423d]">{order.delivery_area}</p><p className="mt-1 text-xs text-[#7b8882]">{order.delivery_emirate.replace("_", " ")}</p></td><td className="px-4 py-4"><StatusBadge status={order.status} /></td><td className={`px-4 py-4 text-xs font-semibold ${dueText(order).includes("overdue") ? "text-[#b55a36]" : "text-[#65746e]"}`}>{dueText(order)}</td><td className="px-5 py-4 text-right text-sm font-semibold text-[#263530]">{formatAed(order.total_aed)}</td></tr>)}</tbody></table>{visibleOrders.length === 0 ? <div className="p-8 text-center text-sm text-[#7b8882]">No orders match these filters.</div> : null}</div><OrderDetail order={selectedOrder} proofUrls={proofUrls} onAdvance={advance} onReadyForPickup={markReadyForPickup} updatingId={updatingId} onCopyAddress={copyAddress} /></div>
      </>}
      {pickupHandoff ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#132c2a]/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[1.5rem] bg-white p-6 text-center shadow-2xl"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff1df] text-[#b55a36]"><PortalIcon name="package" className="h-5 w-5" /></span><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b55a36]">Pickup handoff</p><h2 className="mt-1 text-2xl font-semibold text-[#19342b]">Give this code to the rider</h2><p className="mt-2 text-sm leading-6 text-[#64736c]">The rider requested a pickup verification code for this order.</p><p className="mt-5 rounded-xl bg-[#fff7ed] py-4 text-4xl font-bold tracking-[0.3em] text-[#8a4b2c]">{pickupHandoff.otp_code}</p><button type="button" onClick={() => setPickupHandoff(null)} className="mt-5 min-h-11 w-full rounded-xl border border-[#dce5e0] px-4 py-2.5 text-sm font-semibold text-[#42675c]">Close</button></div></div> : null}
    </section>
  </div>;
}

function MobileOrderList({ orders, onSelect }: { orders: OrderWithItems[]; onSelect: (order: OrderWithItems) => void }) {
  if (!orders.length) return <div className="p-8 text-center text-sm text-[#7b8882]">No orders match these filters.</div>;

  return <ol className="divide-y divide-[#edf1ef]">
    {orders.map((order) => {
      const itemCount = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
      const due = dueText(order);
      const overdue = due.includes("overdue");
      return <li key={order.id}>
        <button type="button" onClick={() => onSelect(order)} className="w-full px-4 py-4 text-left transition hover:bg-[#f8faf9] active:bg-[#f1f7f4]">
          <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block text-sm font-semibold text-[#263530]">{order.order_number}</span><span className="mt-1 block truncate text-xs text-[#718078]">{order.delivery_area || "Delivery address pending"} · {itemCount} item{itemCount === 1 ? "" : "s"}</span></span><StatusBadge status={order.status} /></span>
          <span className="mt-3 flex items-center justify-between gap-3 border-t border-[#f0f3f1] pt-3"><span className={`flex items-center gap-1.5 text-xs font-semibold ${overdue ? "text-[#b55a36]" : "text-[#527267]"}`}><PortalIcon name="clock" className="h-3.5 w-3.5" />{due}</span><span className="flex items-center gap-2 text-sm font-semibold text-[#263530]">{formatAed(order.total_aed)}<PortalIcon name="arrow" className="h-3.5 w-3.5 text-[#59786d]" /></span></span>
        </button>
      </li>;
    })}
  </ol>;
}

function OrderDetail({ order, proofUrls, onAdvance, onReadyForPickup, updatingId, onCopyAddress }: { order: OrderWithItems | null; proofUrls: string[]; onAdvance: (order: OrderWithItems) => void; onReadyForPickup: (order: OrderWithItems) => void; updatingId: string | null; onCopyAddress: (order: Order) => void }) {
  if (!order) return <aside className="border-l border-[#edf1ef] bg-[#fbfdfc] p-5"><p className="text-sm text-[#7b8882]">Select an order to see its delivery and fulfilment details.</p></aside>;
  const next = NEXT_STATUS[order.status];
  const currentIndex = FLOW.indexOf(order.status);
  const deliveryJob = order.delivery_jobs?.[0] ?? null;
  const awaitingCardPayment =
    order.payment_method === "card" && order.payment_status !== "paid";
  return <aside className="border-t border-[#edf1ef] bg-[#fbfdfc] p-5 xl:border-l xl:border-t-0"><div className="flex items-start justify-between gap-3"><div><p className="portal-eyebrow">Selected order</p><h2 className="mt-1 text-lg font-semibold text-[#1d2925]">{order.order_number}</h2><p className="mt-1 text-xs text-[#7b8882]">Placed {placedText(order.placed_at)}</p></div><StatusBadge status={order.status} /></div>
    <div className="mt-5"><p className="portal-eyebrow">Fulfilment progress</p><ol className="mt-3 space-y-3">{FLOW.map((status, index) => <li key={status} className="flex gap-3"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${currentIndex >= index ? "bg-[#5b9183] text-white" : "bg-[#e7edeb] text-[#7f8d87]"}`}>{currentIndex > index ? <PortalIcon name="check" className="h-3 w-3" /> : index + 1}</span><span className={`-mt-0.5 text-xs font-medium ${currentIndex >= index ? "text-[#315b51]" : "text-[#8a9792]"}`}>{orderStatusLabel(status)}</span></li>)}</ol></div>
    {awaitingCardPayment ? <div className="mt-5 rounded-lg border border-[#f0d7c8] bg-[#fff7f2] px-3 py-3"><p className="text-sm font-semibold text-[#8a4b2c]">Awaiting card payment</p><p className="mt-1 text-xs leading-5 text-[#8a5a42]">This order stays on hold until the shopper completes payment.</p></div> : null}
    {next ? <button type="button" onClick={() => onAdvance(order)} disabled={updatingId === order.id || awaitingCardPayment} className="portal-button-primary mt-5 w-full disabled:opacity-55">{updatingId === order.id ? "Updating…" : awaitingCardPayment ? "Waiting for payment" : `Mark ${orderStatusLabel(next)}`}<PortalIcon name="arrow" className="h-3.5 w-3.5" /></button> : null}
    {order.status === "picking" && !deliveryJob ? <button type="button" onClick={() => onReadyForPickup(order)} disabled={updatingId === order.id || awaitingCardPayment} className="portal-button-primary mt-5 w-full disabled:opacity-55">{updatingId === order.id ? "Sending to dispatch…" : "Ready for pickup"}<PortalIcon name="package" className="h-3.5 w-3.5" /></button> : null}
    {deliveryJob ? <div className="mt-5 rounded-lg border border-[#cfe5dc] bg-[#f2f9f5] px-3 py-3"><p className="portal-eyebrow text-[#3f7567]">Delivery dispatch</p><p className="mt-1 text-sm font-semibold capitalize text-[#245448]">{deliveryJob.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs leading-5 text-[#5b756b]">Morni automatically assigns an eligible delivery partner and rider. You will be notified when the rider collects this order.</p></div> : null}
    <div className="mt-6 border-t border-[#e5ece8] pt-5"><div className="flex items-center justify-between"><p className="portal-eyebrow">Delivery</p><span className={`text-xs font-semibold ${dueText(order).includes("overdue") ? "text-[#b55a36]" : "text-[#477064]"}`}>{dueText(order)}</span></div><p className="mt-2 text-sm font-medium leading-6 text-[#34423d]">{orderAddress(order)}</p>{order.delivery_notes ? <p className="mt-2 rounded-lg bg-[#f2f6f3] px-3 py-2 text-xs leading-5 text-[#5a6d66]">“{order.delivery_notes}”</p> : null}<div className="mt-3 flex flex-wrap gap-2">{order.delivery_phone ? <a href={`tel:${order.delivery_phone}`} className="portal-button-secondary text-xs"><PortalIcon name="phone" className="h-3.5 w-3.5" />Call customer</a> : null}<button type="button" onClick={() => onCopyAddress(order)} className="portal-button-secondary text-xs">Copy address</button></div></div>
    <div className="mt-6 border-t border-[#e5ece8] pt-5"><p className="portal-eyebrow">Items</p><ul className="mt-3 space-y-3">{order.order_items?.length ? order.order_items.map((item) => { const measurements = formatCustomizationValues(null, item.customization); return <li key={item.id} className="flex gap-3 text-sm"><span className="grid h-6 min-w-6 place-items-center rounded-md bg-[#edf3f0] text-[11px] font-bold text-[#3c685c]">{item.quantity}</span><span className="min-w-0 flex-1"><span className="block font-medium text-[#34423d]">{item.title}</span><span className="mt-0.5 block text-xs text-[#7b8882]">{[item.color_name, item.size ? `Size ${item.size}` : null].filter(Boolean).join(" · ") || "Standard"}</span>{measurements.length ? <span className="mt-1 block rounded-md bg-[#fff8f3] px-2 py-1 text-[11px] leading-5 text-[#8a5a42]">Custom: {measurements.map((measurement) => `${measurement.label} ${measurement.value}`).join(" · ")}</span> : null}</span><span className="text-xs font-semibold text-[#5b6a64]">{formatAed(item.line_total_aed)}</span></li>; }) : <li className="text-sm text-[#7b8882]">No items listed.</li>}</ul><div className="mt-4 flex justify-between border-t border-[#e5ece8] pt-3 text-sm font-semibold text-[#263530]"><span>Order total</span><span>{formatAed(order.total_aed)}</span></div></div>
    {proofUrls.length ? <div className="mt-6 border-t border-[#e5ece8] pt-5"><div className="flex items-center justify-between gap-3"><p className="portal-eyebrow">Proof of delivery</p><span className="text-xs font-semibold text-[#277044]">{proofUrls.length} photo{proofUrls.length === 1 ? "" : "s"}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{proofUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[#dce5e0] bg-white"><img src={url} alt={`Delivery proof ${index + 1}`} className="aspect-square h-full w-full object-cover" /></a>)}</div><p className="mt-2 text-xs leading-5 text-[#718079]">The rider uploaded these parcel photos before delivery verification.</p></div> : null}
    <button type="button" onClick={() => window.print()} className="mt-5 flex w-full items-center justify-center gap-2 text-xs font-semibold text-[#65746e] hover:text-[#2f6f66]"><PortalIcon name="external" className="h-3.5 w-3.5" />Print order details</button>
  </aside>;
}
