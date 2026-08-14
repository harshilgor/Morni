"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { formatAed, orderStatusLabel } from "@/lib/format";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import type { OrderStatus } from "@/lib/types";

type FounderView = "overview" | "operations" | "delivery" | "stores" | "customers" | "catalogue" | "finance" | "alerts";
type FounderTone = "urgent" | "warning" | "default";

type DeliveryJobStatus = "unassigned" | "assigned" | "accepted" | "at_pickup" | "collected" | "delivered" | "failed" | "cancelled";

type FounderDeliveryData = {
  generated_at: string;
  metrics: {
    active_jobs: number;
    waiting_jobs: number;
    exceptions: number;
    available_drivers: number;
  };
  partners: Array<{
    id: string;
    name: string;
    is_active: boolean;
    auto_dispatch_enabled: boolean;
    active_jobs: number;
    available_drivers: number;
    total_drivers: number;
  }>;
  drivers: Array<{
    id: string;
    display_name: string;
    partner_name: string;
    availability: "offline" | "available" | "assigned" | "paused";
    is_active: boolean;
    last_location_at: string | null;
  }>;
  jobs: Array<{
    id: string;
    order_number: string;
    status: DeliveryJobStatus;
    store_name: string;
    pickup_area: string;
    delivery_area: string;
    partner_name: string | null;
    driver_name: string | null;
    attempts: number;
    ready_at: string;
    failure_reason: string | null;
  }>;
};

type FounderData = {
  generated_at: string;
  range_days: number;
  metrics: {
    today_orders: number;
    today_revenue: number;
    average_order_value: number;
    new_shoppers: number;
    new_stores: number;
    active_stores: number;
    open_orders: number;
    delivery_rate: number;
  };
  daily_sales: Array<{ day: string; label: string; revenue: number; orders: number; shoppers: number }>;
  status_breakdown: Partial<Record<OrderStatus, number>>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    status: OrderStatus;
    total_aed: number;
    placed_at: string;
    store_name: string;
    shopper_name: string;
    delivery_area: string;
  }>;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    emirate: string;
    is_active: boolean;
    created_at: string;
    live_products: number;
    low_stock_products: number;
    period_orders: number;
    period_revenue: number;
    today_orders: number;
    today_revenue: number;
  }>;
  top_products: Array<{
    id: string;
    title: string;
    store_name: string;
    units: number;
    revenue: number;
    stock: number | null;
  }>;
  customers: Array<{
    id: string;
    full_name: string;
    created_at: string;
    orders: number;
    revenue: number;
    last_order_at: string | null;
  }>;
  finance: {
    gross_sales: number;
    product_sales: number;
    delivery_fees: number;
    service_fees: number;
    small_order_fees: number;
    paid_orders: number;
    pending_orders: number;
  };
  alerts: Array<{ tone: FounderTone; title: string; detail: string; href: string }>;
};

const navItems: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "overview", label: "Today", icon: "overview" },
  { id: "operations", label: "Orders", icon: "orders" },
  { id: "delivery", label: "Delivery", icon: "location" },
  { id: "stores", label: "Stores", icon: "store" },
  { id: "customers", label: "Customers", icon: "reviews" },
  { id: "catalogue", label: "Catalogue", icon: "products" },
  { id: "finance", label: "Finance", icon: "analytics" },
  { id: "alerts", label: "Action centre", icon: "warning" },
];

const statusOrder: OrderStatus[] = ["placed", "accepted", "picking", "out_for_delivery", "delivered"];

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("en-AE").format(Number(value ?? 0));
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function routeToView(href: string): FounderView {
  if (href.includes("catalogue")) return "catalogue";
  if (href.includes("stores")) return "stores";
  return "operations";
}

function statusStyle(status: OrderStatus) {
  const styles: Record<OrderStatus, string> = {
    placed: "border-[#dca74d]/30 bg-[#fff4d9] text-[#80550b]",
    accepted: "border-[#8fb5cd]/35 bg-[#eef7fc] text-[#285d7c]",
    picking: "border-[#bb9bce]/35 bg-[#faf0fc] text-[#6d367e]",
    out_for_delivery: "border-[#73b7ac]/35 bg-[#eaf8f5] text-[#17665a]",
    delivered: "border-[#8abf96]/35 bg-[#eff9ef] text-[#236434]",
    cancelled: "border-[#df9a9a]/35 bg-[#fff1f1] text-[#8b3030]",
  };
  return styles[status];
}

function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(status)}`}>{orderStatusLabel(status)}</span>;
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9b354f] transition hover:text-[#681e34]">{children}<PortalIcon name="arrow" className="h-3.5 w-3.5" /></button>;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#eadeda] bg-[#fffdf9] shadow-[0_12px_26px_-24px_rgba(55,30,35,0.42)] ${className}`}>{children}</section>;
}

function SectionTitle({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3"><div>{eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b354f]">{eyebrow}</p> : null}<h2 className={`${eyebrow ? "mt-2" : ""} text-lg font-semibold tracking-[-0.035em] text-[#271b1e]`}>{title}</h2><p className="mt-1 text-sm leading-6 text-[#75666a]">{detail}</p></div>{action}</div>;
}

function MetricCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "attention" }) {
  return <section className={`rounded-xl border p-4 ${tone === "attention" ? "border-[#e9c8cd] bg-[#fff7f7]" : "border-[#eadeda] bg-[#fffdf9]"}`}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8d7a7e]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#271b1e] tabular-nums">{value}</p><p className="mt-1.5 text-xs leading-5 text-[#75666a]">{detail}</p></section>;
}

function DailyBriefing({ data, ownerName, onViewChange }: { data: FounderData; ownerName?: string; onViewChange: (view: FounderView) => void }) {
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const urgentCount = data.alerts.filter((alert) => alert.tone === "urgent").length;
  const overviewMessage = urgentCount ? `${urgentCount} urgent item${urgentCount === 1 ? "" : "s"} needs your attention.` : data.metrics.open_orders ? `${number(data.metrics.open_orders)} order${data.metrics.open_orders === 1 ? " is" : "s are"} moving through Morni.` : "The marketplace is clear for now.";

  return <section className="overflow-hidden rounded-2xl bg-[#2a1b20] text-[#fff9f4] shadow-[0_18px_34px_-26px_rgba(45,21,29,0.7)]"><div className="flex flex-col gap-7 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e5a5af]">Morni daily briefing</p><h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{greeting}{ownerName ? `, ${ownerName}` : ""}.</h1><p className="mt-3 text-sm leading-6 text-[#e7d7d8]">{overviewMessage} {data.metrics.delivery_rate}% of completed activity has been delivered successfully.</p></div><button type="button" onClick={() => onViewChange("alerts")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#f1d9d2]/45 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#fff9f4] transition hover:bg-white/10">Open action centre <PortalIcon name="arrow" className="h-4 w-4" /></button></div><div className="grid border-t border-white/15 sm:grid-cols-3"><div className="border-b border-white/15 px-5 py-4 sm:border-b-0 sm:border-r sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#cfa9af]">Sales today</p><p className="mt-1.5 text-xl font-semibold tracking-[-0.04em] tabular-nums">{formatAed(data.metrics.today_revenue)}</p></div><div className="border-b border-white/15 px-5 py-4 sm:border-b-0 sm:border-r sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#cfa9af]">Orders today</p><p className="mt-1.5 text-xl font-semibold tracking-[-0.04em] tabular-nums">{number(data.metrics.today_orders)}</p></div><div className="px-5 py-4 sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#cfa9af]">Active boutiques</p><p className="mt-1.5 text-xl font-semibold tracking-[-0.04em] tabular-nums">{number(data.metrics.active_stores)}</p></div></div></section>;
}

function ActionCentre({ alerts, onViewChange, limit }: { alerts: FounderData["alerts"]; onViewChange: (view: FounderView) => void; limit?: number }) {
  const visibleAlerts = typeof limit === "number" ? alerts.slice(0, limit) : alerts;
  return <Panel className="p-5 sm:p-6"><SectionTitle eyebrow="Priority queue" title="What needs your attention" detail={alerts.length ? "Work through these marketplace exceptions first." : "No operational exceptions are waiting for you."} action={alerts.length > (limit ?? 0) ? <ActionButton onClick={() => onViewChange("alerts")}>See all</ActionButton> : undefined} /><div className="mt-5 divide-y divide-[#efe5e1]">{visibleAlerts.map((alert, index) => <button key={`${alert.title}-${index}`} type="button" onClick={() => onViewChange(routeToView(alert.href))} className="group flex w-full items-start gap-3 py-4 text-left first:pt-0 last:pb-0"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${alert.tone === "urgent" ? "bg-[#b93b58]" : alert.tone === "warning" ? "bg-[#c78a28]" : "bg-[#7f7777]"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#302225]">{alert.title}</span><span className="mt-1 block text-sm leading-5 text-[#76676b]">{alert.detail}</span></span><PortalIcon name="arrow" className="mt-1 h-4 w-4 shrink-0 text-[#a08f92] transition group-hover:translate-x-0.5 group-hover:text-[#9b354f]" /></button>)}{visibleAlerts.length === 0 ? <div className="py-5 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#edf5ee] text-[#3c7651]"><PortalIcon name="check" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#302225]">Everything is on track</p><p className="mt-1 text-sm text-[#76676b]">New exceptions will appear here as they need attention.</p></div> : null}</div></Panel>;
}

function RevenueChart({ days }: { days: FounderData["daily_sales"] }) {
  const maximumRevenue = Math.max(...days.map((day) => Number(day.revenue)), 1);
  return <div className="mt-6 flex h-48 items-end gap-2">{days.map((day) => { const height = Math.max((Number(day.revenue) / maximumRevenue) * 100, 4); return <div key={day.day} className="group flex min-w-0 flex-1 flex-col items-center gap-2"><div className="relative flex h-36 w-full items-end rounded-sm bg-[#f7efeb]"><div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#2a1b20] px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">{formatAed(day.revenue)}</div><div className="w-full rounded-sm bg-[#9b354f] transition-[height] duration-500" style={{ height: `${height}%` }} /></div><span className="truncate text-[10px] font-semibold text-[#8b7a7e]">{day.label}</span></div>; })}</div>;
}

function OperationsSummary({ data, onViewChange }: { data: FounderData; onViewChange: (view: FounderView) => void }) {
  return <Panel className="p-5 sm:p-6"><SectionTitle title="Order flow" detail="A simple read on what is moving right now." action={<ActionButton onClick={() => onViewChange("operations")}>View orders</ActionButton>} /><div className="mt-5 space-y-1">{statusOrder.map((status) => <div key={status} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[#fbf6f3]"><span className="flex items-center gap-2.5 text-sm text-[#4b3b3f]"><span className={`h-2 w-2 rounded-full ${status === "placed" ? "bg-[#c78a28]" : status === "out_for_delivery" ? "bg-[#3d8b83]" : status === "delivered" ? "bg-[#4c845a]" : "bg-[#9d8d90]"}`} />{orderStatusLabel(status)}</span><span className="text-sm font-semibold tabular-nums text-[#2d2023]">{number(data.status_breakdown[status])}</span></div>)}</div><div className="mt-4 border-t border-[#efe5e1] pt-4"><p className="text-xs text-[#76676b]"><span className="font-semibold text-[#2d2023]">{data.metrics.delivery_rate}%</span> delivery completion rate across the marketplace.</p></div></Panel>;
}

function StoreHealth({ stores, onViewChange }: { stores: FounderData["stores"]; onViewChange: (view: FounderView) => void }) {
  const priorityStores = [...stores].sort((a, b) => (b.low_stock_products > 0 ? 1 : 0) - (a.low_stock_products > 0 ? 1 : 0) || b.period_revenue - a.period_revenue).slice(0, 4);
  return <Panel className="p-5 sm:p-6"><SectionTitle title="Boutique health" detail="A quick commercial and catalogue check." action={<ActionButton onClick={() => onViewChange("stores")}>All stores</ActionButton>} /><div className="mt-5 space-y-4">{priorityStores.map((store) => { const needsCatalogue = store.is_active && store.live_products === 0; const label = needsCatalogue ? "Needs catalogue" : store.low_stock_products ? `${store.low_stock_products} low stock` : "Healthy"; const labelClass = needsCatalogue ? "text-[#9b354f]" : store.low_stock_products ? "text-[#9a6514]" : "text-[#397447]"; return <button key={store.id} type="button" onClick={() => onViewChange("stores")} className="flex w-full items-center gap-3 text-left"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4e9e6] text-xs font-bold text-[#703147]">{store.name.charAt(0)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#302225]">{store.name}</span><span className="mt-0.5 block text-xs text-[#7d6d71]">{number(store.period_orders)} orders · {number(store.live_products)} live pieces</span></span><span className={`text-right text-xs font-semibold ${labelClass}`}>{label}</span></button>; })}{priorityStores.length === 0 ? <p className="py-5 text-center text-sm text-[#7d6d71]">Boutique health will appear as stores come online.</p> : null}</div></Panel>;
}

function FounderSidebar({ activeView, onViewChange, alertCount }: { activeView: FounderView; onViewChange: (view: FounderView) => void; alertCount: number }) {
  return <aside className="border-b border-white/10 bg-[#251b1e] lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r"><div className="flex h-full flex-col"><div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 lg:px-5 lg:py-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#fbf4ed] font-display text-xl text-[#7d2944]">M</span><span><span className="block font-display text-xl text-[#fff9f3]">Morni</span><span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#d1afb7]">Founder workspace</span></span></div><nav className="flex gap-1 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:space-y-1 lg:overflow-visible lg:px-3 lg:py-5">{navItems.map((item) => { const active = item.id === activeView; return <button key={item.id} type="button" onClick={() => onViewChange(item.id)} className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${active ? "bg-[#fff9f4] text-[#2b1c20]" : "text-[#d7c3c7] hover:bg-white/10 hover:text-white"}`}><PortalIcon name={item.icon} className="h-[17px] w-[17px]" /><span>{item.label}</span>{item.id === "alerts" && alertCount ? <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[#b93b58] px-1.5 py-0.5 text-[10px] font-bold text-white">{alertCount}</span> : null}</button>; })}</nav><div className="mt-auto hidden border-t border-white/10 p-3 lg:block"><Link href="/" className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold text-[#eadcdf] transition hover:bg-white/10 hover:text-white">Open shopper site <PortalIcon name="external" className="h-3.5 w-3.5" /></Link></div></div></aside>;
}

function Overview({ data, ownerName, onViewChange }: { data: FounderData; ownerName?: string; onViewChange: (view: FounderView) => void }) {
  return <div className="space-y-5"><DailyBriefing data={data} ownerName={ownerName} onViewChange={onViewChange} /><div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]"><ActionCentre alerts={data.alerts} onViewChange={onViewChange} limit={4} /><OperationsSummary data={data} onViewChange={onViewChange} /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Average order" value={formatAed(data.metrics.average_order_value)} detail={`Across the last ${data.range_days} days`} /><MetricCard label="New shoppers" value={number(data.metrics.new_shoppers)} detail="Joined today" /><MetricCard label="Open orders" value={number(data.metrics.open_orders)} detail="Across all active boutiques" tone={data.metrics.open_orders ? "attention" : "default"} /><MetricCard label="New boutiques" value={number(data.metrics.new_stores)} detail="Joined today" /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]"><Panel className="p-5 sm:p-6"><SectionTitle eyebrow="Commercial" title="Sales over time" detail={`Gross order value across the last ${data.range_days} days.`} action={<ActionButton onClick={() => onViewChange("finance")}>Open finance</ActionButton>} /><RevenueChart days={data.daily_sales} /></Panel><StoreHealth stores={data.stores} onViewChange={onViewChange} /></div><Panel className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle title="Latest orders" detail="Recent marketplace activity, ready to inspect." action={<ActionButton onClick={() => onViewChange("operations")}>View all orders</ActionButton>} /></div><OrderTable orders={data.recent_orders.slice(0, 6)} compact /></Panel></div>;
}

function OrderTable({ orders, compact = false }: { orders: FounderData["recent_orders"]; compact?: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-y border-[#efe5e1] bg-[#fbf7f4]"><tr>{["Order", "Boutique", "Shopper", "Status", "Value", "Placed"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#89777b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#f0e7e3]">{orders.map((order) => <tr key={order.id} className="transition hover:bg-[#fff9f6]"><td className="px-5 py-3.5 text-sm font-semibold text-[#302225]">{order.order_number}</td><td className="px-5 py-3.5 text-sm text-[#5f5054]">{order.store_name}</td><td className="px-5 py-3.5 text-sm text-[#5f5054]">{order.shopper_name}</td><td className="px-5 py-3.5"><StatusPill status={order.status} /></td><td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#302225]">{formatAed(order.total_aed)}</td><td className="px-5 py-3.5 text-xs text-[#857478]">{compact ? dateTime(order.placed_at) : `${dateTime(order.placed_at)} · ${order.delivery_area}`}</td></tr>)}{orders.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#7d6d71]">No orders in this period yet.</td></tr> : null}</tbody></table></div>;
}

function StoresView({ stores }: { stores: FounderData["stores"] }) {
  return <Panel className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle eyebrow="Network" title="Boutique health" detail="Find catalogue gaps, stock risks, and commercial activity in one place." /></div><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left"><thead className="border-y border-[#efe5e1] bg-[#fbf7f4]"><tr>{["Boutique", "Location", "Status", "Live pieces", "Low stock", "Orders", "Sales"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#89777b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#f0e7e3]">{stores.map((store) => <tr key={store.id} className="transition hover:bg-[#fff9f6]"><td className="px-5 py-4"><span className="block text-sm font-semibold text-[#302225]">{store.name}</span><span className="mt-1 block text-xs text-[#867579]">Joined {dateTime(store.created_at)}</span></td><td className="px-5 py-4 text-sm text-[#5f5054]">{store.emirate.replace("_", " ")}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${store.is_active ? "border-[#a9cdb0] bg-[#eef8ef] text-[#286435]" : "border-[#dfb1b6] bg-[#fff2f2] text-[#8c3140]"}`}>{store.is_active ? "Live" : "Paused"}</span></td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{number(store.live_products)}</td><td className={`px-5 py-4 text-sm font-semibold tabular-nums ${store.low_stock_products ? "text-[#9a6514]" : "text-[#5f5054]"}`}>{number(store.low_stock_products)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{number(store.period_orders)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{formatAed(store.period_revenue)}</td></tr>)}</tbody></table></div></Panel>;
}

function CustomersView({ customers }: { customers: FounderData["customers"] }) {
  return <Panel className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle eyebrow="Relationships" title="Customer value" detail="See your most valuable shopper relationships and their latest activity." /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-y border-[#efe5e1] bg-[#fbf7f4]"><tr>{["Customer", "Joined", "Orders", "Lifetime value", "Last order"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#89777b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#f0e7e3]">{customers.map((customer) => <tr key={customer.id} className="transition hover:bg-[#fff9f6]"><td className="px-5 py-4 text-sm font-semibold text-[#302225]">{customer.full_name}</td><td className="px-5 py-4 text-sm text-[#5f5054]">{dateTime(customer.created_at)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{number(customer.orders)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{formatAed(customer.revenue)}</td><td className="px-5 py-4 text-sm text-[#5f5054]">{dateTime(customer.last_order_at)}</td></tr>)}{customers.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#7d6d71]">Customer relationships will appear as shoppers order.</td></tr> : null}</tbody></table></div></Panel>;
}

function CatalogueView({ products }: { products: FounderData["top_products"] }) {
  return <Panel className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle eyebrow="Demand" title="Product performance" detail="Top-selling pieces, alongside inventory signals that may need follow-up." /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-y border-[#efe5e1] bg-[#fbf7f4]"><tr>{["Product", "Boutique", "Units", "Sales", "Stock"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#89777b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#f0e7e3]">{products.map((product, index) => <tr key={`${product.id}-${index}`} className="transition hover:bg-[#fff9f6]"><td className="px-5 py-4"><span className="mr-3 inline-grid h-6 w-6 place-items-center rounded-full bg-[#f5e8e5] text-[10px] font-bold text-[#80334a]">{index + 1}</span><span className="text-sm font-semibold text-[#302225]">{product.title}</span></td><td className="px-5 py-4 text-sm text-[#5f5054]">{product.store_name}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{number(product.units)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#302225]">{formatAed(product.revenue)}</td><td className={`px-5 py-4 text-sm font-semibold tabular-nums ${product.stock !== null && product.stock <= 5 ? "text-[#9a6514]" : "text-[#5f5054]"}`}>{product.stock === null ? "—" : number(product.stock)}</td></tr>)}{products.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#7d6d71]">Product performance will appear once orders are placed.</td></tr> : null}</tbody></table></div></Panel>;
}

function FinanceView({ data }: { data: FounderData }) {
  const financeRows = [{ label: "Product sales", value: data.finance.product_sales, detail: "Merchandise value before fees" }, { label: "Delivery fees", value: data.finance.delivery_fees, detail: "Charged to customers" }, { label: "Service fees", value: data.finance.service_fees, detail: "Marketplace service revenue" }, { label: "Small order fees", value: data.finance.small_order_fees, detail: "Orders below AED 99" }];
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><Panel className="p-5 sm:p-6"><SectionTitle eyebrow="Commercial" title="Sales composition" detail={`All non-cancelled orders in the last ${data.range_days} days.`} /><div className="mt-6 space-y-2">{financeRows.map((row) => <div key={row.label} className="flex items-center justify-between gap-4 rounded-xl border border-[#eee3df] bg-[#fdf9f6] p-3.5"><div><p className="text-sm font-semibold text-[#3a2a2e]">{row.label}</p><p className="mt-1 text-xs text-[#7e6e72]">{row.detail}</p></div><p className="text-sm font-semibold tabular-nums text-[#302225]">{formatAed(row.value)}</p></div>)}</div><div className="mt-5 flex items-center justify-between border-t border-[#eadeda] pt-5"><span className="text-sm font-semibold text-[#4b3b3f]">Gross sales</span><span className="text-2xl font-semibold tracking-[-0.05em] text-[#302225]">{formatAed(data.finance.gross_sales)}</span></div></Panel><Panel className="p-5 sm:p-6"><SectionTitle title="Payment readiness" detail="Orders with confirmed or pending payment state." /><div className="mt-6 grid grid-cols-2 gap-3"><MetricCard label="Paid" value={number(data.finance.paid_orders)} detail="Verified payments" /><MetricCard label="Pending" value={number(data.finance.pending_orders)} detail="Awaiting completion" tone={data.finance.pending_orders ? "attention" : "default"} /></div><p className="mt-5 rounded-xl bg-[#f7efeb] px-3.5 py-3 text-xs leading-5 text-[#746468]">Settlement and boutique payout reporting will appear here once Morni connects provider settlement data.</p></Panel></div>;
}

function AlertsView({ alerts, onViewChange }: { alerts: FounderData["alerts"]; onViewChange: (view: FounderView) => void }) {
  return <ActionCentre alerts={alerts} onViewChange={onViewChange} />;
}

function WorkspaceContent({ data, activeView, ownerName, onViewChange }: { data: FounderData; activeView: FounderView; ownerName?: string; onViewChange: (view: FounderView) => void }) {
  if (activeView === "operations") return <Panel className="overflow-hidden"><OrderTable orders={data.recent_orders} /></Panel>;
  if (activeView === "stores") return <StoresView stores={data.stores} />;
  if (activeView === "customers") return <CustomersView customers={data.customers} />;
  if (activeView === "catalogue") return <CatalogueView products={data.top_products} />;
  if (activeView === "finance") return <FinanceView data={data} />;
  if (activeView === "alerts") return <AlertsView alerts={data.alerts} onViewChange={onViewChange} />;
  return <Overview data={data} ownerName={ownerName} onViewChange={onViewChange} />;
}

export function FounderWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<FounderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);
  const [activeView, setActiveView] = useState<FounderView>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = auth?.profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void createClient().rpc("founder_workspace_data", { p_range_days: range }).then(({ data: response, error: rpcError }) => {
      if (!active) return;
      if (rpcError) { setError(rpcError.message); setData(null); } else { setData(response as unknown as FounderData); }
      setLoadingData(false);
    });
    return () => { active = false; };
  }, [isAdmin, range, refreshKey]);

  function changeRange(days: 7 | 30) { if (days !== range) { setLoadingData(true); setError(null); setRange(days); } }
  function refreshData() { setLoadingData(true); setError(null); setRefreshKey((value) => value + 1); }

  const viewHeading = useMemo(() => ({
    overview: ["Today at Morni", "Your daily marketplace briefing and priority actions."],
    operations: ["Orders", "The live order queue across every Morni boutique."],
    stores: ["Stores", "Commercial and catalogue health across your boutique network."],
    customers: ["Customers", "The shopper relationships that are growing Morni."],
    catalogue: ["Catalogue", "Demand and inventory signals from the live marketplace."],
    finance: ["Finance", "Sales, customer fees, and payment readiness in one view."],
    alerts: ["Action centre", "The exceptions that deserve your attention first."],
  } satisfies Record<FounderView, [string, string]>)[activeView], [activeView]);

  if (authLoading) return <FounderLoading />;
  if (!auth) return <FounderAccess title="Sign in to open Founder" description="Use the Morni administrator account to access the company workspace." action="Sign in" href="/auth?next=/founder" />;
  if (!isAdmin) return <FounderAccess title="Founder access is restricted" description="This workspace is available only to Morni administrator accounts. Seller accounts continue to use the Seller Portal." action="Open Seller Portal" href="/portal" />;

  return <div className="min-h-screen bg-[#f7f2ed] text-[#302225]"><div className="flex min-h-screen flex-col lg:flex-row"><FounderSidebar activeView={activeView} onViewChange={setActiveView} alertCount={data?.alerts.length ?? 0} /><div className="min-w-0 flex-1"><header className="sticky top-0 z-30 border-b border-[#eadeda] bg-[#f7f2ed]/95 backdrop-blur-xl"><div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-9"><div className="mr-auto"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9b354f]">Morni · Founder</p><p className="mt-0.5 text-sm font-semibold text-[#322326]">{viewHeading[0]}</p></div><div className="flex items-center gap-1 rounded-full border border-[#e6d9d5] bg-[#fffaf6] p-1">{([7, 30] as const).map((days) => <button key={days} type="button" onClick={() => changeRange(days)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${range === days ? "bg-[#2a1b20] text-white" : "text-[#78676b] hover:text-[#2a1b20]"}`}>Last {days}d</button>)}</div><button type="button" onClick={refreshData} className="grid h-8 w-8 place-items-center rounded-full border border-[#e4d6d2] bg-[#fffaf6] text-[#6b585d] transition hover:bg-white hover:text-[#9b354f]" aria-label="Refresh founder data"><PortalIcon name="refresh" className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} /></button><span className="hidden rounded-full border border-[#e4d6d2] bg-[#fffaf6] px-3 py-1.5 text-xs font-semibold text-[#5c4a4e] sm:inline">{auth.firstName}</span></div></header><main className="mx-auto w-full max-w-[1550px] px-4 py-7 sm:px-6 lg:px-9 lg:py-9"><div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-4xl tracking-[-0.045em] text-[#2a1b20] sm:text-[2.7rem]">{viewHeading[0]}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#75666a]">{viewHeading[1]}</p></div>{data ? <p className="text-xs text-[#88777b]">Updated {dateTime(data.generated_at)} · Dubai time</p> : null}</div>{!data && !error ? <FounderLoading /> : null}{error ? <FounderError error={error} onRetry={refreshData} /> : null}{data ? <WorkspaceContent data={data} activeView={activeView} ownerName={auth.firstName} onViewChange={setActiveView} /> : null}</main></div></div></div>;
}

function FounderLoading() { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className={`${index > 3 ? "h-52" : "h-32"} animate-pulse rounded-2xl border border-[#eadeda] bg-[#fffaf6]`} />)}</div>; }

function FounderAccess({ title, description, action, href }: { title: string; description: string; action: string; href: string }) { return <div className="grid min-h-screen place-items-center bg-[#f7f2ed] p-6 text-center"><div className="max-w-md rounded-2xl border border-[#e6d9d5] bg-[#fffaf6] p-8 shadow-[0_24px_60px_-30px_rgba(74,38,47,0.35)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f2dedf] text-[#9b354f]"><PortalIcon name="overview" className="h-5 w-5" /></span><h1 className="mt-5 font-display text-3xl tracking-[-0.04em] text-[#2a1b20]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#75666a]">{description}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2a1b20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4b2a34]">{action}<PortalIcon name="arrow" className="h-4 w-4" /></Link></div></div>; }

function FounderError({ error, onRetry }: { error: string; onRetry: () => void }) { const migrationMissing = /founder_workspace_data|function/i.test(error); return <Panel className="p-6"><div className="flex flex-wrap items-start gap-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#f8e2e4] text-[#9b354f]"><PortalIcon name="warning" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-[#302225]">{migrationMissing ? "Founder data is not connected yet" : "Founder data could not be loaded"}</h2><p className="mt-1 text-sm leading-6 text-[#75666a]">{migrationMissing ? "Apply the Founder Workspace Supabase migration to enable the secure analytics endpoint, then refresh this page." : error}</p></div><button type="button" onClick={onRetry} className="rounded-full border border-[#dfcfca] px-3 py-2 text-xs font-semibold text-[#5b464b] hover:bg-[#fbf4f1]">Try again</button></div></Panel>; }
