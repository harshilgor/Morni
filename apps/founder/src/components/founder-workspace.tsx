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
  metrics: { active_jobs: number; waiting_jobs: number; exceptions: number; available_drivers: number };
  partners: Array<{ id: string; name: string; is_active: boolean; auto_dispatch_enabled: boolean; active_jobs: number; available_drivers: number; total_drivers: number }>;
  drivers: Array<{ id: string; display_name: string; partner_name: string; availability: "offline" | "available" | "assigned" | "paused"; is_active: boolean; last_location_at: string | null }>;
  jobs: Array<{ id: string; order_number: string; status: DeliveryJobStatus; store_name: string; pickup_area: string; delivery_area: string; partner_name: string | null; driver_name: string | null; attempts: number; ready_at: string; failure_reason: string | null }>;
};

type FounderData = {
  generated_at: string;
  range_days: number;
  metrics: { today_orders: number; today_revenue: number; average_order_value: number; new_shoppers: number; new_stores: number; active_stores: number; open_orders: number; delivery_rate: number };
  daily_sales: Array<{ day: string; label: string; revenue: number; orders: number; shoppers: number }>;
  status_breakdown: Partial<Record<OrderStatus, number>>;
  recent_orders: Array<{ id: string; order_number: string; status: OrderStatus; total_aed: number; placed_at: string; store_name: string; shopper_name: string; delivery_area: string }>;
  stores: Array<{ id: string; name: string; slug: string; emirate: string; is_active: boolean; created_at: string; live_products: number; low_stock_products: number; period_orders: number; period_revenue: number; today_orders: number; today_revenue: number }>;
  top_products: Array<{ id: string; title: string; store_name: string; units: number; revenue: number; stock: number | null }>;
  customers: Array<{ id: string; full_name: string; created_at: string; orders: number; revenue: number; last_order_at: string | null }>;
  finance: { gross_sales: number; product_sales: number; delivery_fees: number; service_fees: number; small_order_fees: number; paid_orders: number; pending_orders: number };
  alerts: Array<{ tone: FounderTone; title: string; detail: string; href: string }>;
};

const operateNav: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "overview", label: "Today", icon: "overview" },
  { id: "operations", label: "Orders", icon: "orders" },
  { id: "delivery", label: "Delivery", icon: "location" },
  { id: "alerts", label: "Action centre", icon: "bell" },
];

const growNav: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "stores", label: "Stores", icon: "store" },
  { id: "customers", label: "Customers", icon: "reviews" },
  { id: "catalogue", label: "Catalogue", icon: "products" },
  { id: "finance", label: "Finance", icon: "analytics" },
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

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`portal-card overflow-hidden ${className}`}>{children}</section>;
}

function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-[-0.02em] text-[#17231f]">{title}</h2>
        {detail ? <p className="mt-1 max-w-xl text-sm leading-5 text-[#687770]">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="portal-text-link shrink-0">
      {children}
      <PortalIcon name="arrow" className="h-3.5 w-3.5" />
    </button>
  );
}

function MetricCard({ label, value, detail, tone = "default", icon }: { label: string; value: string; detail: string; tone?: "default" | "attention"; icon?: PortalIconName }) {
  return (
    <section className={`portal-card p-4 ${tone === "attention" ? "border-[#efcfbf] bg-[#fff8f3]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="portal-eyebrow">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.04em] text-[#17231f]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-[#687770]">{detail}</p>
        </div>
        {icon ? (
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone === "attention" ? "bg-[#fdeee6] text-[#9c5b05]" : "bg-[#edf3f0] text-[#3c685c]"}`}>
            <PortalIcon name={icon} />
          </span>
        ) : null}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    placed: "bg-[#fff1dc] text-[#9c5b05] ring-[#f2d4a2]",
    accepted: "bg-[#e6f0ff] text-[#215d9f] ring-[#c5dcf7]",
    picking: "bg-[#eee9ff] text-[#5f4ca2] ring-[#d9ceff]",
    out_for_delivery: "bg-[#e2f6f1] text-[#17675b] ring-[#bde8dd]",
    delivered: "bg-[#e5f5eb] text-[#277044] ring-[#c9e7d4]",
    cancelled: "bg-[#f8e8e9] text-[#a3444c] ring-[#efd0d3]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status]}`}>{orderStatusLabel(status)}</span>;
}

function ToneBadge({ tone }: { tone: FounderTone }) {
  const styles = {
    urgent: "bg-[#f8e8e9] text-[#a3444c] ring-[#efd0d3]",
    warning: "bg-[#fff1dc] text-[#9c5b05] ring-[#f2d4a2]",
    default: "bg-[#edf0ef] text-[#66736e] ring-[#dce3df]",
  };
  const labels = { urgent: "Urgent", warning: "Watch", default: "Note" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${styles[tone]}`}>{labels[tone]}</span>;
}

function DailyBriefing({ data, ownerName, onViewChange }: { data: FounderData; ownerName?: string; onViewChange: (view: FounderView) => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const urgentCount = data.alerts.filter((alert) => alert.tone === "urgent").length;
  const overviewMessage = urgentCount
    ? `${urgentCount} urgent item${urgentCount === 1 ? "" : "s"} need your attention.`
    : data.metrics.open_orders
      ? `${number(data.metrics.open_orders)} order${data.metrics.open_orders === 1 ? " is" : "s are"} moving through Morni.`
      : "The marketplace is clear for now.";

  return (
    <section className="founder-briefing overflow-hidden rounded-xl bg-[#21342e] text-[#f4faf7] shadow-[0_18px_40px_-28px_rgba(33,52,46,0.75)]">
      <div className="relative px-5 py-6 sm:px-7 sm:py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(520px 240px at 100% 0%, rgba(95,145,131,0.35), transparent 58%), radial-gradient(420px 200px at 0% 100%, rgba(47,111,102,0.28), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fc4b8]">Daily briefing</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.035em] sm:text-[2.35rem]">
              {greeting}
              {ownerName ? `, ${ownerName}` : ""}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#c5d8d1]">
              {overviewMessage} {data.metrics.delivery_rate}% of completed activity has been delivered successfully.
            </p>
          </div>
          <button type="button" onClick={() => onViewChange("alerts")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#21342e] transition hover:bg-[#eef6f2]">
            Review priorities
            <PortalIcon name="arrow" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid border-t border-white/10 sm:grid-cols-3">
        {[
          { label: "Sales today", value: formatAed(data.metrics.today_revenue) },
          { label: "Orders today", value: number(data.metrics.today_orders) },
          { label: "Active boutiques", value: number(data.metrics.active_stores) },
        ].map((metric, index) => (
          <div key={metric.label} className={`px-5 py-4 sm:px-7 ${index < 2 ? "border-b border-white/10 sm:border-b-0 sm:border-r" : ""}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fb5a8]">{metric.label}</p>
            <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] tabular-nums">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionCentre({ alerts, onViewChange, limit }: { alerts: FounderData["alerts"]; onViewChange: (view: FounderView) => void; limit?: number }) {
  const visibleAlerts = typeof limit === "number" ? alerts.slice(0, limit) : alerts;
  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle
        title="Needs attention"
        detail={alerts.length ? "Work through marketplace exceptions first." : "No operational exceptions waiting."}
        action={typeof limit === "number" && alerts.length > limit ? <TextLink onClick={() => onViewChange("alerts")}>See all</TextLink> : undefined}
      />
      <div className="mt-5 divide-y divide-[#e6ebe8]">
        {visibleAlerts.map((alert, index) => (
          <button
            key={`${alert.title}-${index}`}
            type="button"
            onClick={() => onViewChange(routeToView(alert.href))}
            className="group flex w-full items-start gap-3 py-3.5 text-left first:pt-0 last:pb-0"
          >
            <ToneBadge tone={alert.tone} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#17231f]">{alert.title}</span>
              <span className="mt-1 block text-sm leading-5 text-[#687770]">{alert.detail}</span>
            </span>
            <PortalIcon name="arrow" className="mt-1 h-4 w-4 shrink-0 text-[#9aa8a2] transition group-hover:translate-x-0.5 group-hover:text-[#2f6f66]" />
          </button>
        ))}
        {visibleAlerts.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#edf3f0] text-[#3c685c]">
              <PortalIcon name="check" className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#17231f]">Everything is on track</p>
            <p className="mt-1 text-sm text-[#687770]">New exceptions will appear here when they need you.</p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function RevenueChart({ days }: { days: FounderData["daily_sales"] }) {
  const maximumRevenue = Math.max(...days.map((day) => Number(day.revenue)), 1);
  return (
    <div className="mt-6 flex h-48 items-end gap-1.5 sm:gap-2">
      {days.map((day) => {
        const height = Math.max((Number(day.revenue) / maximumRevenue) * 100, 4);
        return (
          <div key={day.day} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="relative flex h-36 w-full items-end rounded-md bg-[#eef3f0]">
              <div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#21342e] px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                {formatAed(day.revenue)}
              </div>
              <div className="w-full rounded-md bg-[#5b9183] transition-[height] duration-500" style={{ height: `${height}%` }} />
            </div>
            <span className="truncate text-[10px] font-semibold text-[#7b8882]">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function OperationsSummary({ data, onViewChange }: { data: FounderData; onViewChange: (view: FounderView) => void }) {
  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle title="Order flow" detail="What is moving right now." action={<TextLink onClick={() => onViewChange("operations")}>View orders</TextLink>} />
      <div className="mt-5 space-y-1">
        {statusOrder.map((status) => (
          <div key={status} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-[#f4f7f5]">
            <span className="flex items-center gap-2.5 text-sm text-[#3a4a44]">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "placed"
                    ? "bg-[#c78a28]"
                    : status === "out_for_delivery"
                      ? "bg-[#3d8b83]"
                      : status === "delivered"
                        ? "bg-[#4c845a]"
                        : "bg-[#8a9a93]"
                }`}
              />
              {orderStatusLabel(status)}
            </span>
            <span className="text-sm font-semibold tabular-nums text-[#17231f]">{number(data.status_breakdown[status])}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-[#e6ebe8] pt-4">
        <p className="text-xs text-[#687770]">
          <span className="font-semibold text-[#17231f]">{data.metrics.delivery_rate}%</span> delivery completion across the marketplace.
        </p>
      </div>
    </Panel>
  );
}

function StoreHealth({ stores, onViewChange }: { stores: FounderData["stores"]; onViewChange: (view: FounderView) => void }) {
  const priorityStores = [...stores]
    .sort((a, b) => (b.low_stock_products > 0 ? 1 : 0) - (a.low_stock_products > 0 ? 1 : 0) || b.period_revenue - a.period_revenue)
    .slice(0, 4);

  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle title="Boutique health" detail="Commercial and catalogue signals." action={<TextLink onClick={() => onViewChange("stores")}>All stores</TextLink>} />
      <div className="mt-5 space-y-3">
        {priorityStores.map((store) => {
          const needsCatalogue = store.is_active && store.live_products === 0;
          const label = needsCatalogue ? "Needs catalogue" : store.low_stock_products ? `${store.low_stock_products} low stock` : "Healthy";
          const labelClass = needsCatalogue ? "text-[#a3444c]" : store.low_stock_products ? "text-[#9c5b05]" : "text-[#277044]";
          return (
            <button key={store.id} type="button" onClick={() => onViewChange("stores")} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition hover:bg-[#f4f7f5]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#edf3f0] text-xs font-bold text-[#315f54]">{store.name.charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#17231f]">{store.name}</span>
                <span className="mt-0.5 block text-xs text-[#687770]">
                  {number(store.period_orders)} orders · {number(store.live_products)} live
                </span>
              </span>
              <span className={`text-right text-xs font-semibold ${labelClass}`}>{label}</span>
            </button>
          );
        })}
        {priorityStores.length === 0 ? <p className="py-5 text-center text-sm text-[#687770]">Boutique health will appear as stores come online.</p> : null}
      </div>
    </Panel>
  );
}

function NavButton({ item, active, alertCount, onViewChange }: { item: { id: FounderView; label: string; icon: PortalIconName }; active: boolean; alertCount: number; onViewChange: (view: FounderView) => void }) {
  return (
    <button
      type="button"
      onClick={() => onViewChange(item.id)}
      className={`relative flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${
        active
          ? "border-[#bfd0c8] bg-[#e3eee9] text-[#1f594f] shadow-[0_1px_2px_rgba(20,35,29,0.05)]"
          : "border-transparent text-[#52615b] hover:border-[#d2dad6] hover:bg-white hover:text-[#1f302a]"
      }`}
    >
      <PortalIcon name={item.icon} className="h-[18px] w-[18px]" />
      <span>{item.label}</span>
      {item.id === "alerts" && alertCount ? (
        <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[#21342e] px-1.5 py-0.5 text-[10px] font-bold text-white">{alertCount}</span>
      ) : null}
    </button>
  );
}

function FounderSidebar({ activeView, onViewChange, alertCount }: { activeView: FounderView; onViewChange: (view: FounderView) => void; alertCount: number }) {
  return (
    <aside className="founder-sidebar z-40 border-b border-[#c6d0cb] bg-[#f8faf9] lg:sticky lg:top-0 lg:h-screen lg:w-[15.5rem] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="hidden border-b border-[#d5ddd9] px-5 py-5 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#21342e] font-display text-xl text-white shadow-sm">M</span>
            <span>
              <span className="block text-base font-bold tracking-[-0.03em] text-[#17231f]">Morni Founder</span>
              <span className="mt-0.5 block text-[11px] text-[#687770]">Company workspace</span>
            </span>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:overflow-visible lg:px-3 lg:py-4">
          <div className="flex shrink-0 gap-1 lg:block lg:space-y-1">
            {operateNav.map((item) => (
              <NavButton key={item.id} item={item} active={item.id === activeView} alertCount={alertCount} onViewChange={onViewChange} />
            ))}
          </div>
          <p className="hidden px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#82908a] lg:block">Grow</p>
          <div className="flex shrink-0 gap-1 lg:block lg:space-y-1">
            {growNav.map((item) => (
              <NavButton key={item.id} item={item} active={item.id === activeView} alertCount={alertCount} onViewChange={onViewChange} />
            ))}
          </div>
        </nav>
        <div className="mt-auto hidden border-t border-[#d5ddd9] p-3 lg:block">
          <Link href="/" className="flex items-center justify-between rounded-lg border border-[#bcc8c2] bg-white px-3 py-2.5 text-xs font-semibold text-[#283832] shadow-[0_1px_2px_rgba(20,35,29,0.05)] transition hover:border-[#8fa39a] hover:bg-[#f7faf8]">
            Open shopper site
            <PortalIcon name="external" className="h-3.5 w-3.5 text-[#687770]" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function Overview({ data, ownerName, onViewChange }: { data: FounderData; ownerName?: string; onViewChange: (view: FounderView) => void }) {
  return (
    <div className="space-y-5">
      <DailyBriefing data={data} ownerName={ownerName} onViewChange={onViewChange} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]">
        <ActionCentre alerts={data.alerts} onViewChange={onViewChange} limit={4} />
        <OperationsSummary data={data} onViewChange={onViewChange} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Average order" value={formatAed(data.metrics.average_order_value)} detail={`Last ${data.range_days} days`} icon="analytics" />
        <MetricCard label="New shoppers" value={number(data.metrics.new_shoppers)} detail="Joined today" icon="reviews" />
        <MetricCard label="Open orders" value={number(data.metrics.open_orders)} detail="Across active boutiques" tone={data.metrics.open_orders ? "attention" : "default"} icon="orders" />
        <MetricCard label="New boutiques" value={number(data.metrics.new_stores)} detail="Joined today" icon="store" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]">
        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Sales over time" detail={`Gross order value · last ${data.range_days} days`} action={<TextLink onClick={() => onViewChange("finance")}>Open finance</TextLink>} />
          <RevenueChart days={data.daily_sales} />
        </Panel>
        <StoreHealth stores={data.stores} onViewChange={onViewChange} />
      </div>
      <Panel>
        <div className="p-5 sm:p-6">
          <SectionTitle title="Latest orders" detail="Recent marketplace activity." action={<TextLink onClick={() => onViewChange("operations")}>View all</TextLink>} />
        </div>
        <OrderTable orders={data.recent_orders.slice(0, 6)} compact />
      </Panel>
    </div>
  );
}

function OrderTable({ orders, compact = false }: { orders: FounderData["recent_orders"]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left">
        <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
          <tr>
            {["Order", "Boutique", "Shopper", "Status", "Value", "Placed"].map((heading) => (
              <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef2f0]">
          {orders.map((order) => (
            <tr key={order.id} className="transition hover:bg-[#f9fbfa]">
              <td className="px-5 py-3.5 text-sm font-semibold text-[#17231f]">{order.order_number}</td>
              <td className="px-5 py-3.5 text-sm text-[#52615b]">{order.store_name}</td>
              <td className="px-5 py-3.5 text-sm text-[#52615b]">{order.shopper_name}</td>
              <td className="px-5 py-3.5">
                <StatusPill status={order.status} />
              </td>
              <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(order.total_aed)}</td>
              <td className="px-5 py-3.5 text-xs text-[#687770]">{compact ? dateTime(order.placed_at) : `${dateTime(order.placed_at)} · ${order.delivery_area}`}</td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#687770]">
                No orders in this period yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const deliveryStatusText: Record<DeliveryJobStatus, string> = {
  unassigned: "Waiting for rider",
  assigned: "Awaiting acceptance",
  accepted: "Heading to pickup",
  at_pickup: "At the store",
  collected: "Out for delivery",
  delivered: "Delivered",
  failed: "Needs attention",
  cancelled: "Cancelled",
};

function DeliveryStatusPill({ status }: { status: DeliveryJobStatus }) {
  const styles: Record<DeliveryJobStatus, string> = {
    unassigned: "bg-[#fff1dc] text-[#9c5b05] ring-[#f2d4a2]",
    assigned: "bg-[#e6f0ff] text-[#215d9f] ring-[#c5dcf7]",
    accepted: "bg-[#eee9ff] text-[#5f4ca2] ring-[#d9ceff]",
    at_pickup: "bg-[#eef1ff] text-[#465a9a] ring-[#d0d8f5]",
    collected: "bg-[#e2f6f1] text-[#17675b] ring-[#bde8dd]",
    delivered: "bg-[#e5f5eb] text-[#277044] ring-[#c9e7d4]",
    failed: "bg-[#f8e8e9] text-[#a3444c] ring-[#efd0d3]",
    cancelled: "bg-[#edf0ef] text-[#66736e] ring-[#dce3df]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status]}`}>{deliveryStatusText[status]}</span>;
}

function DeliveryView({ data, onRefresh }: { data: FounderDeliveryData; onRefresh: () => void }) {
  const [partnerName, setPartnerName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [partnerActionError, setPartnerActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"partner" | "invite" | null>(null);
  const [managingPartnerId, setManagingPartnerId] = useState<string | null>(null);

  async function createPartner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting("partner");
    setFormError(null);
    setCreateMessage(null);
    const response = await fetch("/api/delivery/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: partnerName, supportEmail }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; partner?: { id: string } } | null;
    if (!response.ok || !payload?.partner) setFormError(payload?.error ?? "Unable to create delivery partner.");
    else {
      setPartnerName("");
      setSupportEmail("");
      setPartnerId(payload.partner.id);
      setCreateMessage("Partner added. They can request a sign-in link with this email.");
      onRefresh();
    }
    setSubmitting(null);
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetPartnerId = partnerId || data.partners[0]?.id;
    if (!targetPartnerId) return;
    setSubmitting("invite");
    setFormError(null);
    setInviteUrl(null);
    setInviteMessage(null);
    const response = await fetch(`/api/delivery/partners/${targetPartnerId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: "driver" }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; inviteUrl?: string; emailSent?: boolean } | null;
    if (!payload?.inviteUrl) setFormError(payload?.error ?? "Unable to add rider.");
    else {
      setInviteEmail("");
      setInviteUrl(payload.inviteUrl);
      setInviteMessage(
        payload.emailSent === false
          ? payload.error ?? "Rider added, but the welcome email could not be sent."
          : "Welcome email sent. The rider can use the secure link to join Morni.",
      );
    }
    setSubmitting(null);
  }

  async function updatePartner(
    targetPartnerId: string,
    patch: { isActive?: boolean; autoDispatchEnabled?: boolean },
  ) {
    setManagingPartnerId(targetPartnerId);
    setPartnerActionError(null);
    setManageMessage(null);
    const response = await fetch(`/api/delivery/partners/${targetPartnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setPartnerActionError(payload?.error ?? "Unable to update this delivery partner.");
    } else {
      setManageMessage(
        patch.isActive === false
          ? "Partner deactivated. Waiting jobs were released for reassignment."
          : patch.autoDispatchEnabled === false
            ? "Auto-dispatch turned off for this partner."
            : "Partner settings updated.",
      );
      onRefresh();
    }
    setManagingPartnerId(null);
  }

  async function deletePartner(partner: FounderDeliveryData["partners"][number]) {
    if (
      !window.confirm(
        `Delete ${partner.name}? This removes their dispatchers, riders, and invites. Active deliveries must be finished first.`,
      )
    ) {
      return;
    }
    setManagingPartnerId(partner.id);
    setPartnerActionError(null);
    setManageMessage(null);
    const response = await fetch(`/api/delivery/partners/${partner.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setPartnerActionError(payload?.error ?? "Unable to delete this delivery partner.");
    } else {
      if (partnerId === partner.id) setPartnerId("");
      setManageMessage(`${partner.name} was deleted.`);
      onRefresh();
    }
    setManagingPartnerId(null);
  }

  async function copyInvite() {
    if (inviteUrl) await navigator.clipboard.writeText(inviteUrl);
  }

  const selectedPartner = partnerId || data.partners[0]?.id || "";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active jobs" value={number(data.metrics.active_jobs)} detail="Assigned or moving" icon="package" />
        <MetricCard label="Needs a rider" value={number(data.metrics.waiting_jobs)} detail="Awaiting dispatch" tone={data.metrics.waiting_jobs ? "attention" : "default"} icon="clock" />
        <MetricCard label="Exceptions" value={number(data.metrics.exceptions)} detail="Failed or overdue" tone={data.metrics.exceptions ? "attention" : "default"} icon="warning" />
        <MetricCard label="Riders available" value={number(data.metrics.available_drivers)} detail="Ready for pickup" icon="location" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <Panel>
          <div className="p-5 sm:p-6">
            <SectionTitle title="Delivery control tower" detail="Ready orders, partner assignments, and rider status." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
                <tr>
                  {["Order", "Route", "Partner & rider", "Status", "Attempts"].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f0]">
                {data.jobs.map((job) => (
                  <tr key={job.id} className="align-top transition hover:bg-[#f9fbfa]">
                    <td className="px-5 py-4">
                      <span className="block text-sm font-semibold text-[#17231f]">{job.order_number}</span>
                      <span className="mt-1 block text-xs text-[#687770]">Ready {dateTime(job.ready_at)}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#52615b]">
                      <span className="block font-medium">{job.store_name}</span>
                      <span className="mt-1 block text-xs text-[#687770]">
                        {job.pickup_area} to {job.delivery_area}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#52615b]">
                      <span className="block">{job.partner_name ?? "Not assigned"}</span>
                      <span className="mt-1 block text-xs text-[#687770]">{job.driver_name ?? "No rider yet"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <DeliveryStatusPill status={job.status} />
                      {job.failure_reason ? <span className="mt-1.5 block max-w-44 text-xs leading-5 text-[#a3444c]">{job.failure_reason}</span> : null}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{number(job.attempts)}</td>
                  </tr>
                ))}
                {data.jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center text-sm text-[#687770]">
                      Ready-for-pickup orders will appear here automatically.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Delivery partners" detail="Pause dispatch, resume coverage, or remove a company." />
          <div className="mt-5 space-y-3">
            {data.partners.map((partner) => {
              const busy = managingPartnerId === partner.id;
              const dispatching = partner.is_active && partner.auto_dispatch_enabled;
              return (
                <div key={partner.id} className="rounded-lg border border-[#d5ddd9] bg-[#f7faf8] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#17231f]">{partner.name}</span>
                      <span className="mt-1 block text-xs text-[#687770]">
                        {number(partner.available_drivers)} of {number(partner.total_drivers)} riders available
                      </span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dispatching ? "bg-[#e5f5eb] text-[#277044]" : "bg-[#f8e8e9] text-[#a3444c]"}`}>
                      {!partner.is_active ? "Inactive" : partner.auto_dispatch_enabled ? "Dispatching" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-[#5f6c67]">
                    {number(partner.active_jobs)} active job{partner.active_jobs === 1 ? "" : "s"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updatePartner(partner.id, { isActive: !partner.is_active })}
                      className="rounded-md border border-[#c9d4ce] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#21342e] transition hover:border-[#9fb0a8] disabled:opacity-50"
                    >
                      {partner.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !partner.is_active}
                      onClick={() =>
                        void updatePartner(partner.id, {
                          autoDispatchEnabled: !partner.auto_dispatch_enabled,
                        })
                      }
                      className="rounded-md border border-[#c9d4ce] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#21342e] transition hover:border-[#9fb0a8] disabled:opacity-50"
                    >
                      {partner.auto_dispatch_enabled ? "Pause dispatch" : "Resume dispatch"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deletePartner(partner)}
                      className="rounded-md border border-[#efd0d3] bg-[#fff7f8] px-2.5 py-1.5 text-[11px] font-semibold text-[#a3444c] transition hover:border-[#e0a9ae] disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
            {data.partners.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#c6d0cb] px-4 py-5 text-sm leading-6 text-[#687770]">Add your first delivery company to start assigning ready orders.</p>
            ) : null}
          </div>
          {partnerActionError ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-[#a3444c]">
              {partnerActionError}
            </p>
          ) : null}
          {manageMessage ? (
            <p role="status" className="mt-3 text-xs leading-5 text-[#277044]">
              {manageMessage}
            </p>
          ) : null}
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Add a delivery company" detail="Partner login email becomes the owner account." />
          <form onSubmit={createPartner} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input required value={partnerName} onChange={(event) => setPartnerName(event.target.value)} placeholder="Delivery company name" className="portal-input" />
            <input required type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="Partner login email" className="portal-input" />
            <button type="submit" disabled={submitting === "partner"} className="portal-button-primary disabled:opacity-50">
              {submitting === "partner" ? "Adding" : "Add partner"}
            </button>
          </form>
          {createMessage ? (
            <p role="status" className="mt-3 text-xs leading-5 text-[#277044]">
              {createMessage}
            </p>
          ) : null}
        </Panel>
        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Add a rider" detail="Enter their email and Morni sends the welcome invite automatically." />
          <form onSubmit={createInvite} className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.partners.length > 1 ? (
              <select required value={selectedPartner} onChange={(event) => setPartnerId(event.target.value)} className="portal-select">
                <option value="" disabled>
                  Select delivery company
                </option>
                {data.partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="rider@email.com" className="portal-input" />
            <button type="submit" disabled={!selectedPartner || submitting === "invite"} className="portal-button-primary disabled:opacity-50">
              {submitting === "invite" ? "Adding rider" : "Add rider & send email"}
            </button>
          </form>
          {formError ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-[#a3444c]">
              {formError}
            </p>
          ) : null}
          {inviteUrl ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#edf3f0] p-3">
              <span className="text-xs leading-5 text-[#3a4a44]">{inviteMessage ?? "Invite ready to share once."}</span>
              <button type="button" onClick={() => void copyInvite()} className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#21342e] shadow-sm">
                Copy join link
              </button>
            </div>
          ) : null}
        </Panel>
      </div>
      <Panel>
        <div className="p-5 sm:p-6">
          <SectionTitle title="Rider availability" detail="Last location helps dispatch prioritise nearby riders." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
              <tr>
                {["Rider", "Partner", "Availability", "Last location"].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f0]">
              {data.drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="px-5 py-4 text-sm font-semibold text-[#17231f]">{driver.display_name}</td>
                  <td className="px-5 py-4 text-sm text-[#52615b]">{driver.partner_name}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${driver.availability === "available" ? "bg-[#e5f5eb] text-[#277044]" : driver.availability === "assigned" ? "bg-[#e6f0ff] text-[#215d9f]" : "bg-[#edf0ef] text-[#66736e]"}`}>
                      {driver.availability}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#52615b]">{dateTime(driver.last_location_at)}</td>
                </tr>
              ))}
              {data.drivers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center text-sm text-[#687770]">
                    Riders appear after partners accept invitations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function StoresView({ stores }: { stores: FounderData["stores"] }) {
  return (
    <Panel>
      <div className="p-5 sm:p-6">
        <SectionTitle title="Boutique network" detail="Catalogue gaps, stock risk, and commercial activity." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left">
          <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
            <tr>
              {["Boutique", "Location", "Status", "Live pieces", "Low stock", "Orders", "Sales"].map((heading) => (
                <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f0]">
            {stores.map((store) => (
              <tr key={store.id} className="transition hover:bg-[#f9fbfa]">
                <td className="px-5 py-4">
                  <span className="block text-sm font-semibold text-[#17231f]">{store.name}</span>
                  <span className="mt-1 block text-xs text-[#687770]">Joined {dateTime(store.created_at)}</span>
                </td>
                <td className="px-5 py-4 text-sm text-[#52615b]">{store.emirate.replace("_", " ")}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${store.is_active ? "bg-[#e5f5eb] text-[#277044] ring-[#c9e7d4]" : "bg-[#f8e8e9] text-[#a3444c] ring-[#efd0d3]"}`}>
                    {store.is_active ? "Live" : "Paused"}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{number(store.live_products)}</td>
                <td className={`px-5 py-4 text-sm font-semibold tabular-nums ${store.low_stock_products ? "text-[#9c5b05]" : "text-[#52615b]"}`}>{number(store.low_stock_products)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{number(store.period_orders)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(store.period_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CustomersView({ customers }: { customers: FounderData["customers"] }) {
  return (
    <Panel>
      <div className="p-5 sm:p-6">
        <SectionTitle title="Customer value" detail="Highest-value shopper relationships and recent activity." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
            <tr>
              {["Customer", "Joined", "Orders", "Lifetime value", "Last order"].map((heading) => (
                <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f0]">
            {customers.map((customer) => (
              <tr key={customer.id} className="transition hover:bg-[#f9fbfa]">
                <td className="px-5 py-4 text-sm font-semibold text-[#17231f]">{customer.full_name}</td>
                <td className="px-5 py-4 text-sm text-[#52615b]">{dateTime(customer.created_at)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{number(customer.orders)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(customer.revenue)}</td>
                <td className="px-5 py-4 text-sm text-[#52615b]">{dateTime(customer.last_order_at)}</td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#687770]">
                  Customer relationships will appear as shoppers order.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CatalogueView({ products }: { products: FounderData["top_products"] }) {
  return (
    <Panel>
      <div className="p-5 sm:p-6">
        <SectionTitle title="Product performance" detail="Top sellers with inventory signals that may need follow-up." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
            <tr>
              {["Product", "Boutique", "Units", "Sales", "Stock"].map((heading) => (
                <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f0]">
            {products.map((product, index) => (
              <tr key={`${product.id}-${index}`} className="transition hover:bg-[#f9fbfa]">
                <td className="px-5 py-4">
                  <span className="mr-3 inline-grid h-6 w-6 place-items-center rounded-md bg-[#edf3f0] text-[10px] font-bold text-[#315f54]">{index + 1}</span>
                  <span className="text-sm font-semibold text-[#17231f]">{product.title}</span>
                </td>
                <td className="px-5 py-4 text-sm text-[#52615b]">{product.store_name}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{number(product.units)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(product.revenue)}</td>
                <td className={`px-5 py-4 text-sm font-semibold tabular-nums ${product.stock !== null && product.stock <= 5 ? "text-[#9c5b05]" : "text-[#52615b]"}`}>
                  {product.stock === null ? "—" : number(product.stock)}
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#687770]">
                  Product performance will appear once orders are placed.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function FinanceView({ data }: { data: FounderData }) {
  const financeRows = [
    { label: "Product sales", value: data.finance.product_sales, detail: "Merchandise before fees" },
    { label: "Delivery fees", value: data.finance.delivery_fees, detail: "Free above AED 199" },
    { label: "Service fees", value: data.finance.service_fees, detail: "Marketplace service revenue" },
    { label: "Small order fees", value: data.finance.small_order_fees, detail: "Orders below AED 99" },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <Panel className="founder-finance-panel p-5 sm:p-6">
        <SectionTitle title="Sales composition" detail={`Non-cancelled orders · last ${data.range_days} days`} />
        <div className="mt-6 space-y-2">
          {financeRows.map((row) => (
            <div key={row.label} className="founder-finance-row flex items-center justify-between gap-4 rounded-lg border border-[#d5ddd9] bg-[#f7faf8] p-3.5">
              <div>
                <p className="text-sm font-semibold text-[#17231f]">{row.label}</p>
                <p className="mt-1 text-xs text-[#687770]">{row.detail}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(row.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[#e2e7e4] pt-5">
          <span className="text-sm font-semibold text-[#3a4a44]">Gross sales</span>
          <span className="text-2xl font-semibold tracking-[-0.04em] text-[#17231f]">{formatAed(data.finance.gross_sales)}</span>
        </div>
      </Panel>
      <Panel className="founder-finance-panel p-5 sm:p-6">
        <SectionTitle title="Payment readiness" detail="Confirmed vs pending payment state." />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <MetricCard label="Paid" value={number(data.finance.paid_orders)} detail="Verified" icon="check" />
          <MetricCard label="Pending" value={number(data.finance.pending_orders)} detail="Awaiting" tone={data.finance.pending_orders ? "attention" : "default"} icon="clock" />
        </div>
        <p className="mt-5 rounded-lg bg-[#edf3f0] px-3.5 py-3 text-xs leading-5 text-[#5f6c67]">Settlement and boutique payout reporting will appear once provider settlement data is connected.</p>
      </Panel>
    </div>
  );
}

function WorkspaceContent({ data, deliveryData, activeView, ownerName, onViewChange, onRefresh }: { data: FounderData; deliveryData: FounderDeliveryData; activeView: FounderView; ownerName?: string; onViewChange: (view: FounderView) => void; onRefresh: () => void }) {
  if (activeView === "operations") return <Panel><OrderTable orders={data.recent_orders} /></Panel>;
  if (activeView === "delivery") return <DeliveryView data={deliveryData} onRefresh={onRefresh} />;
  if (activeView === "stores") return <StoresView stores={data.stores} />;
  if (activeView === "customers") return <CustomersView customers={data.customers} />;
  if (activeView === "catalogue") return <CatalogueView products={data.top_products} />;
  if (activeView === "finance") return <FinanceView data={data} />;
  if (activeView === "alerts") return <ActionCentre alerts={data.alerts} onViewChange={onViewChange} />;
  return <Overview data={data} ownerName={ownerName} onViewChange={onViewChange} />;
}

export function FounderWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<FounderData | null>(null);
  const [deliveryData, setDeliveryData] = useState<FounderDeliveryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);
  const [activeView, setActiveView] = useState<FounderView>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = auth?.profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void Promise.all([createClient().rpc("founder_workspace_data", { p_range_days: range }), createClient().rpc("founder_delivery_workspace_data")]).then(([workspaceResponse, deliveryResponse]) => {
      if (!active) return;
      if (workspaceResponse.error || deliveryResponse.error) {
        setError(workspaceResponse.error?.message ?? deliveryResponse.error?.message ?? "Unable to load Founder data.");
        setData(null);
        setDeliveryData(null);
      } else {
        setData(workspaceResponse.data as unknown as FounderData);
        setDeliveryData(deliveryResponse.data as unknown as FounderDeliveryData);
        setError(null);
      }
      setLoadingData(false);
    });
    return () => {
      active = false;
    };
  }, [isAdmin, range, refreshKey]);

  function changeRange(days: 7 | 30) {
    if (days !== range) {
      setLoadingData(true);
      setError(null);
      setRange(days);
    }
  }

  function refreshData() {
    setLoadingData(true);
    setError(null);
    setRefreshKey((value) => value + 1);
  }

  const viewHeading = useMemo(
    () =>
      (
        ({
          overview: ["Today at Morni", "Daily marketplace briefing and priority actions."],
          operations: ["Orders", "Live order queue across every boutique."],
          delivery: ["Delivery", "Jobs, partners, riders, and exceptions."],
          stores: ["Stores", "Commercial and catalogue health across the network."],
          customers: ["Customers", "Shopper relationships growing Morni."],
          catalogue: ["Catalogue", "Demand and inventory signals."],
          finance: ["Finance", "Sales, fees, and payment readiness."],
          alerts: ["Action centre", "Exceptions that deserve attention first."],
        }) satisfies Record<FounderView, [string, string]>
      )[activeView],
    [activeView],
  );

  if (authLoading) return <FounderLoading />;
  if (!auth) return <FounderAccess title="Sign in to open Founder" description="Use the Morni administrator account to access the company workspace." action="Sign in" href="/auth?next=/founder" />;
  if (!isAdmin) return <FounderAccess title="Founder access is restricted" description="This workspace is available only to Morni administrator accounts. Seller accounts continue to use the Seller Portal." action="Open Seller Portal" href="/portal" />;

  return (
    <div className="founder-workspace flex min-h-screen flex-col lg:flex-row">
      <FounderSidebar activeView={activeView} onViewChange={setActiveView} alertCount={data?.alerts.length ?? 0} />
      <div className="min-w-0 flex-1">
        <header className="founder-header sticky top-0 z-30 border-b border-[#c6d0cb] bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-9">
            <div className="mr-auto lg:hidden">
              <p className="text-sm font-bold tracking-[-0.02em] text-[#17231f]">Morni Founder</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-[#c6d0cb] bg-[#f7faf8] p-0.5" role="group" aria-label="Date range">
                {([7, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => changeRange(days)}
                    aria-pressed={range === days}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${range === days ? "bg-[#21342e] text-white shadow-sm" : "text-[#5f6c67] hover:text-[#17231f]"}`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={refreshData}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#c6d0cb] bg-white text-[#5f6c67] transition hover:border-[#aebdb6] hover:text-[#2f6f66]"
                aria-label="Refresh founder data"
              >
                <PortalIcon name="refresh" className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
              </button>
              <span className="hidden rounded-lg border border-[#c6d0cb] bg-white px-3 py-1.5 text-xs font-semibold text-[#3a4a44] sm:inline">{auth.firstName}</span>
            </div>
          </div>
        </header>

        <main className="founder-main mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-9 lg:py-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="portal-eyebrow">Founder workspace</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#17231f] sm:text-[2.15rem]">{viewHeading[0]}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#596963]">{viewHeading[1]}</p>
            </div>
            {data ? <p className="text-xs text-[#7b8882]">Updated {dateTime(data.generated_at)} · Dubai</p> : null}
          </div>

          {!data && !error ? <FounderLoading /> : null}
          {error ? <FounderError error={error} onRetry={refreshData} /> : null}
          {data && deliveryData ? (
            <div key={activeView}>
              <WorkspaceContent data={data} deliveryData={deliveryData} activeView={activeView} ownerName={auth.firstName} onViewChange={setActiveView} onRefresh={refreshData} />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function FounderLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className={`animate-pulse rounded-xl border border-[#c6d0cb] bg-white ${index > 3 ? "h-52" : "h-28"}`} />
      ))}
    </div>
  );
}

function FounderAccess({ title, description, action, href }: { title: string; description: string; action: string; href: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="portal-card max-w-md p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#edf3f0] text-[#3c685c]">
          <PortalIcon name="overview" className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-[#17231f]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#596963]">{description}</p>
        <Link href={href} className="portal-button-primary mt-6">
          {action}
          <PortalIcon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function FounderError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const migrationMissing = /founder_workspace_data|function/i.test(error);
  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8e8e9] text-[#a3444c]">
          <PortalIcon name="warning" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[#17231f]">{migrationMissing ? "Founder data is not connected yet" : "Founder data could not be loaded"}</h2>
          <p className="mt-1 text-sm leading-6 text-[#596963]">{migrationMissing ? "Apply the Founder Workspace Supabase migration to enable the analytics endpoint, then refresh." : error}</p>
        </div>
        <button type="button" onClick={onRetry} className="portal-button-secondary">
          Try again
        </button>
      </div>
    </Panel>
  );
}
