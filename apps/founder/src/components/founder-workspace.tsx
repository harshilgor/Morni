"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { formatAed, orderStatusLabel } from "@/lib/format";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import type { OrderStatus } from "@/lib/types";

type FounderOrderProduct = {
  id: string;
  title: string;
  quantity: number;
  image_url: string | null;
};

type FounderView = "overview" | "demand" | "operations" | "delivery" | "stores" | "customers" | "catalogue" | "finance" | "settlements" | "refunds" | "alerts";
type FounderDiscoveryData = {
  generated_at: string;
  range_days: number;
  has_data: boolean;
  funnel: {
    product_views: number;
    listing_impressions: number;
    listing_clicks: number;
    cart_adds: number;
    checkout_starts: number;
    checkout_address_complete: number;
    checkout_slot_selected: number;
    checkout_place_order: number;
    payment_start: number;
    payment_fail: number;
    payment_success: number;
  };
  search: {
    searches: number;
    zero_results: number;
    result_clicks: number;
    top_queries: Array<{ query: string; count: number }>;
    zero_result_queries: Array<{ query: string; count: number }>;
  };
  friction: {
    add_to_cart_blocked: number;
    blocked_reasons: Array<{ reason: string; count: number }>;
    auth_fails: number;
    auth_logins: number;
    auth_signups: number;
  };
  surfaces: {
    home_views: number;
    category_views: number;
    collection_views: number;
    store_views: number;
    top_categories: Array<{ category: string; count: number }>;
  };
  acquisition: {
    sessions: number;
    top_sources: Array<{ source: string; count: number }>;
  };
};
type FounderTone = "urgent" | "warning" | "default";
type DeliveryJobStatus = "unassigned" | "assigned" | "accepted" | "at_pickup" | "collected" | "delivered" | "failed" | "cancelled";

type FounderProductSignal = {
  id: string;
  title: string;
  store_name: string;
  wishlist_count?: number;
  unpaid_units?: number;
  paid_units?: number;
  views?: number;
  cart_adds?: number;
};

type FounderDeliveryData = {
  generated_at: string;
  metrics: { active_jobs: number; waiting_jobs: number; exceptions: number; available_drivers: number };
  partners: Array<{ id: string; name: string; is_active: boolean; auto_dispatch_enabled: boolean; active_jobs: number; available_drivers: number; total_drivers: number }>;
  drivers: Array<{ id: string; display_name: string; partner_name: string; availability: "offline" | "available" | "assigned" | "paused"; is_active: boolean; last_location_at: string | null; last_lat: number | null; last_lng: number | null }>;
  jobs: Array<{ id: string; order_number: string; status: DeliveryJobStatus; store_name: string; pickup_area: string; delivery_area: string; partner_name: string | null; driver_name: string | null; attempts: number; ready_at: string; failure_reason: string | null; store_lat: number | null; store_lng: number | null; delivery_street: string; delivery_building: string | null; delivery_apartment: string | null; delivery_emirate: string | null }>;
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
    total_shoppers?: number;
    buyers?: number;
    period_orders?: number;
    period_revenue?: number;
    prior_period_orders?: number;
    prior_period_revenue?: number;
    unpaid_checkouts?: number;
    unpaid_checkout_value?: number;
    wishlist_users?: number;
    wishlist_items?: number;
    wishlist_adds_period?: number;
  };
  daily_sales: Array<{ day: string; label: string; revenue: number; orders: number; shoppers: number }>;
  status_breakdown: Partial<Record<OrderStatus, number>>;
  recent_orders: Array<{ id: string; order_number: string; status: OrderStatus; total_aed: number; placed_at: string; store_name: string; shopper_name: string; customer_phone: string | null; delivery_area: string; products?: FounderOrderProduct[] }>;
  stores: Array<{ id: string; name: string; slug: string; emirate: string; is_active: boolean; created_at: string; live_products: number; low_stock_products: number; period_orders: number; period_revenue: number; today_orders: number; today_revenue: number }>;
  top_products: Array<{ id: string; title: string; store_name: string; units: number; revenue: number; stock: number | null }>;
  customers: Array<{ id: string; full_name: string; phone: string | null; created_at: string; orders: number; revenue: number; last_order_at: string | null }>;
  finance: { gross_sales: number; product_sales: number; delivery_fees: number; service_fees: number; small_order_fees: number; paid_orders: number; pending_orders: number };
  alerts: Array<{ tone: FounderTone; title: string; detail: string; href: string }>;
  demand?: {
    funnel: { wishlist_users: number; checkout_started: number; paid_orders: number };
    top_wishlisted: FounderProductSignal[];
    intent_without_purchase: FounderProductSignal[];
    product_funnel: FounderProductSignal[];
  };
  intent?: {
    tracking_live: boolean;
    has_data: boolean;
    product_views_period: number;
    cart_adds_period: number;
    active_users_period: number;
    users_with_cart_snapshot: number;
    products_in_carts: number;
    cart_subtotal_aed: number;
    top_viewed: FounderProductSignal[];
    top_carted: FounderProductSignal[];
  };
};

const insightNav: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "demand", label: "Demand", icon: "sparkle" },
  { id: "customers", label: "Customers", icon: "reviews" },
  { id: "catalogue", label: "Products", icon: "products" },
];

const operateNav: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "operations", label: "Orders", icon: "orders" },
  { id: "delivery", label: "Delivery", icon: "location" },
  { id: "alerts", label: "Action centre", icon: "bell" },
];

const growNav: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "stores", label: "Stores", icon: "store" },
  { id: "finance", label: "Finance", icon: "analytics" },
  { id: "settlements", label: "Settlements", icon: "analytics" },
  { id: "refunds", label: "Refunds", icon: "refresh" },
];

const statusOrder: OrderStatus[] = ["placed", "accepted", "picking", "out_for_delivery", "delivered"];

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("en-AE").format(Number(value ?? 0));
}

function percentDelta(current: number, previous: number) {
  if (!previous && !current) return { label: "vs prior", direction: "neutral" as const, value: "—" };
  if (!previous) return { label: "vs prior", direction: "up" as const, value: "New" };
  const change = ((current - previous) / previous) * 100;
  return {
    label: "vs prior",
    direction: change > 0.5 ? ("up" as const) : change < -0.5 ? ("down" as const) : ("neutral" as const),
    value: `${change > 0 ? "+" : ""}${change.toFixed(0)}%`,
  };
}

function abandonmentRate(unpaid: number, paid: number) {
  const total = unpaid + paid;
  if (!total) return null;
  return Math.round((1000 * unpaid) / total) / 10;
}

type SettlementStore = { store_id: string; store_name: string; commission_rate: number; order_count: number; gross_sales: number; commission: number; net_payout: number; paid_amount: number };
type SettlementData = { period_start: string; period_end: string; default_commission_rate: number; stores: SettlementStore[]; history: Array<{ id: string; store_name: string; period_start: string; period_end: string; order_count: number; net_payout: number; payment_method: string; payment_reference: string | null; paid_at: string }> };
type FounderRefund = { refund_id: string; return_request_id: string; order_number: string; store_name: string; shopper_name: string; shopper_phone: string | null; amount_aed: number; method: string; status: "pending_processor" | "processed" | "failed"; reason: string; created_at: string; processed_at: string | null; processor_reference: string | null; processor_note: string | null };

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
  const chartDays = days.length ? days : [{ day: "empty", label: "No data", revenue: 0, orders: 0, shoppers: 0 }];
  const maximumRevenue = Math.max(...chartDays.map((day) => Number(day.revenue)), 1);
  const width = 720;
  const height = 230;
  const padding = { top: 18, right: 12, bottom: 32, left: 12 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const points = chartDays.map((day, index) => ({
    x: padding.left + (chartDays.length === 1 ? innerWidth / 2 : (index / (chartDays.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (Number(day.revenue) / maximumRevenue) * innerHeight,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${points.at(-1)?.x.toFixed(2)},${(padding.top + innerHeight).toFixed(2)} L${points[0]?.x.toFixed(2)},${(padding.top + innerHeight).toFixed(2)} Z`;
  const gridLines = [0, 0.33, 0.66, 1];
  return (
    <div className="mt-5 rounded-xl border border-[#d9e4df] bg-[#f9fcfb] p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">
        <span>Revenue trend</span>
        <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[#2f6f66]"><span className="h-1.5 w-1.5 rounded-full bg-[#3278ff] shadow-[0_0_8px_#3278ff]" /> Gross sales</span>
      </div>
      <div className="relative h-56 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label="Revenue trend chart">
          <defs>
            <linearGradient id="founder-revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3278ff" stopOpacity="0.27" />
              <stop offset="100%" stopColor="#3278ff" stopOpacity="0.015" />
            </linearGradient>
            <filter id="founder-revenue-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {gridLines.map((ratio) => {
            const y = padding.top + innerHeight - ratio * innerHeight;
            return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dce7e2" strokeDasharray="4 5" />;
          })}
          <path d={areaPath} fill="url(#founder-revenue-fill)" />
          <path d={linePath} fill="none" stroke="#3278ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" filter="url(#founder-revenue-glow)" />
          {points.map((point, index) => (
            <g key={chartDays[index].day} className="group">
              <circle cx={point.x} cy={point.y} r="13" fill="transparent" />
              <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#3278ff" strokeWidth="2" className="opacity-0 transition-opacity group-hover:opacity-100" />
              <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
                <rect x={Math.max(2, point.x - 38)} y={Math.max(0, point.y - 34)} width="76" height="22" rx="6" fill="#16253c" />
                <text x={point.x} y={Math.max(15, point.y - 19)} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{formatAed(chartDays[index].revenue)}</text>
              </g>
            </g>
          ))}
          {chartDays.map((day, index) => index % Math.max(1, Math.ceil(chartDays.length / 7)) === 0 ? (
            <text key={`label-${day.day}`} x={points[index].x} y={height - 8} textAnchor="middle" fill="#82908a" fontSize="10" fontWeight="600">{day.label}</text>
          ) : null)}
        </svg>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-[#e4ece8] px-1 pt-3 text-xs text-[#687770]">
        <span>{chartDays[0]?.label}</span>
        <span>{chartDays.at(-1)?.label}</span>
      </div>
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
          <p className="hidden px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#82908a] lg:block">Insight</p>
          <div className="flex shrink-0 gap-1 lg:block lg:space-y-1">
            {insightNav.map((item) => (
              <NavButton key={item.id} item={item} active={item.id === activeView} alertCount={alertCount} onViewChange={onViewChange} />
            ))}
          </div>
          <p className="hidden px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#82908a] lg:block">Operate</p>
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
  const periodOrders = data.metrics.period_orders ?? data.finance.paid_orders;
  const periodRevenue = data.metrics.period_revenue ?? data.finance.gross_sales;
  const priorOrders = data.metrics.prior_period_orders ?? 0;
  const priorRevenue = data.metrics.prior_period_revenue ?? 0;
  const unpaid = data.metrics.unpaid_checkouts ?? data.finance.pending_orders;
  const abandon = abandonmentRate(unpaid, periodOrders);
  const revenueDelta = percentDelta(periodRevenue, priorRevenue);
  const orderDelta = percentDelta(periodOrders, priorOrders);
  const wishlistUsers = data.metrics.wishlist_users ?? data.demand?.funnel.wishlist_users ?? 0;
  const topWishlisted = data.demand?.top_wishlisted ?? [];

  return (
    <div className="space-y-5">
      <DailyBriefing data={data} ownerName={ownerName} onViewChange={onViewChange} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Paid GMV"
          value={formatAed(periodRevenue)}
          detail={`${revenueDelta.value} ${revenueDelta.label} · last ${data.range_days}d`}
          icon="analytics"
        />
        <MetricCard
          label="Paid orders"
          value={number(periodOrders)}
          detail={`${orderDelta.value} ${orderDelta.label}`}
          icon="orders"
        />
        <MetricCard
          label="Average order"
          value={formatAed(data.metrics.average_order_value)}
          detail="Paid checkouts only"
          icon="sparkle"
        />
        <MetricCard
          label="Buyers"
          value={number(data.metrics.buyers ?? 0)}
          detail={`${number(data.metrics.total_shoppers ?? 0)} shoppers total`}
          icon="reviews"
        />
        <MetricCard
          label="Checkout abandonment"
          value={abandon == null ? "—" : `${abandon}%`}
          detail={`${number(unpaid)} unpaid drafts · ${formatAed(data.metrics.unpaid_checkout_value ?? 0)}`}
          tone={abandon && abandon >= 40 ? "attention" : "default"}
          icon="warning"
        />
        <MetricCard
          label="Wishlist users"
          value={number(wishlistUsers)}
          detail={`${number(data.metrics.wishlist_adds_period ?? 0)} adds in range`}
          icon="products"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)]">
        <Panel className="p-5 sm:p-6">
          <SectionTitle
            title="Revenue & orders"
            detail={`Paid GMV · last ${data.range_days} days · Dubai time`}
            action={<TextLink onClick={() => onViewChange("finance")}>Open finance</TextLink>}
          />
          {periodOrders || data.daily_sales.some((day) => Number(day.revenue) > 0) ? (
            <RevenueChart days={data.daily_sales} />
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-[#d5ddd9] bg-[#f8faf9] px-4 py-10 text-center">
              <p className="text-sm font-semibold text-[#17231f]">No paid orders in this range</p>
              <p className="mt-1 text-sm text-[#687770]">Trends appear once card payments complete successfully.</p>
            </div>
          )}
        </Panel>
        <Panel className="p-5 sm:p-6">
          <SectionTitle
            title="Demand snapshot"
            detail="Wishlist interest and unpaid checkouts."
            action={<TextLink onClick={() => onViewChange("demand")}>Open demand</TextLink>}
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Wishlist", value: number(data.demand?.funnel.wishlist_users ?? wishlistUsers) },
              { label: "Checkout started", value: number(data.demand?.funnel.checkout_started ?? unpaid) },
              { label: "Paid", value: number(data.demand?.funnel.paid_orders ?? periodOrders) },
            ].map((step) => (
              <div key={step.label} className="rounded-lg border border-[#e2e7e4] bg-[#f7faf8] px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">{step.label}</p>
                <p className="mt-1.5 text-lg font-bold tabular-nums tracking-[-0.03em] text-[#17231f]">{step.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 divide-y divide-[#eef2f0]">
            {topWishlisted.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#31443d]">{product.title}</span>
                  <span className="block truncate text-xs text-[#7b8882]">{product.store_name}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[#3c685c]">{number(product.wishlist_count)} saved</span>
              </div>
            ))}
            {!topWishlisted.length ? (
              <p className="py-6 text-center text-sm text-[#687770]">No wishlist demand yet.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.9fr)]">
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
            <ActionCentre alerts={data.alerts} onViewChange={onViewChange} limit={4} />
            <OperationsSummary data={data} onViewChange={onViewChange} />
          </div>
          <Panel>
            <div className="p-5 sm:p-6">
              <SectionTitle title="Latest paid orders" detail="Operational queue — unpaid drafts are excluded." action={<TextLink onClick={() => onViewChange("operations")}>View all</TextLink>} />
            </div>
            {data.recent_orders.length ? (
              <OrderTable orders={data.recent_orders.slice(0, 6)} compact />
            ) : (
              <div className="px-5 pb-8 text-center text-sm text-[#687770]">No paid orders yet.</div>
            )}
          </Panel>
        </div>
        <div className="space-y-5">
          <StoreHealth stores={data.stores} onViewChange={onViewChange} />
          <IntentTrackingCard intent={data.intent} onViewChange={onViewChange} />
        </div>
      </div>
    </div>
  );
}

function IntentTrackingCard({
  intent,
  onViewChange,
}: {
  intent: FounderData["intent"];
  onViewChange: (view: FounderView) => void;
}) {
  const hasData = Boolean(intent?.has_data);
  return (
    <Panel className="p-5 sm:p-6">
      <SectionTitle
        title="Browse & cart intent"
        detail={hasData ? "Live product views and cart snapshots." : "Tracking is live — waiting for storefront events."}
        action={<TextLink onClick={() => onViewChange("demand")}>Details</TextLink>}
      />
      {hasData ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Views</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#17231f]">{number(intent?.product_views_period)}</p>
          </div>
          <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Cart adds</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#17231f]">{number(intent?.cart_adds_period)}</p>
          </div>
          <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Active carts</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#17231f]">{number(intent?.users_with_cart_snapshot)}</p>
          </div>
          <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">In carts</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#17231f]">{number(intent?.products_in_carts)}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[#d5ddd9] bg-[#f8faf9] px-4 py-6 text-center">
          <p className="text-sm font-semibold text-[#17231f]">Instrumented, awaiting data</p>
          <p className="mt-1 text-xs leading-5 text-[#687770]">
            Product views and cart snapshots appear here as shoppers browse and add to bag. Numbers are never fabricated.
          </p>
        </div>
      )}
    </Panel>
  );
}

function DemandView({ data, discovery }: { data: FounderData; discovery: FounderDiscoveryData | null }) {
  const funnel = data.demand?.funnel ?? {
    wishlist_users: data.metrics.wishlist_users ?? 0,
    checkout_started: data.metrics.unpaid_checkouts ?? 0,
    paid_orders: data.metrics.period_orders ?? data.finance.paid_orders,
  };
  const productFunnel = data.demand?.product_funnel ?? [];
  const intentWithoutPurchase = data.demand?.intent_without_purchase ?? [];
  const intent = data.intent;
  const hasIntent = Boolean(intent?.has_data || discovery?.has_data);
  const eventFunnel = discovery?.funnel;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Wishlist users" value={number(funnel.wishlist_users)} detail={`${number(data.metrics.wishlist_items ?? 0)} saved items`} icon="products" />
        <MetricCard label="Checkout started" value={number(funnel.checkout_started)} detail={`${formatAed(data.metrics.unpaid_checkout_value ?? 0)} unpaid`} tone={funnel.checkout_started ? "attention" : "default"} icon="orders" />
        <MetricCard label="Paid orders" value={number(funnel.paid_orders)} detail={`Last ${data.range_days} days`} icon="analytics" />
      </div>

      {eventFunnel ? (
        <Panel className="p-5 sm:p-6">
          <SectionTitle
            title="UI conversion funnel"
            detail={discovery?.has_data ? "From marketplace events in this range." : "Tracking is live — waiting for browse/checkout events."}
          />
          {discovery?.has_data ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Views", value: eventFunnel.product_views },
                { label: "Cart adds", value: eventFunnel.cart_adds },
                { label: "Checkout", value: eventFunnel.checkout_starts },
                { label: "Place order", value: eventFunnel.checkout_place_order },
                { label: "Paid", value: eventFunnel.payment_success },
              ].map((step) => (
                <div key={step.label} className="rounded-lg border border-[#e2e7e4] bg-[#f7faf8] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">{step.label}</p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-[#17231f]">{number(step.value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#d5ddd9] bg-[#f8faf9] px-4 py-6 text-center text-sm text-[#687770]">
              Funnel steps appear once shoppers browse and check out with tracking enabled.
            </div>
          )}
          {discovery?.has_data ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-[#e2e7e4]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Address complete</p>
                <p className="mt-1 text-base font-bold tabular-nums">{number(eventFunnel.checkout_address_complete)}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-[#e2e7e4]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Slot selected</p>
                <p className="mt-1 text-base font-bold tabular-nums">{number(eventFunnel.checkout_slot_selected)}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-[#e2e7e4]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Payment fail</p>
                <p className="mt-1 text-base font-bold tabular-nums text-[#9c5b05]">{number(eventFunnel.payment_fail)}</p>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Panel className="p-5 sm:p-6">
        <SectionTitle
          title="Proven conversion funnel"
          detail="Wishlist demand → checkout draft (unpaid) → paid order. Pre-checkout cart leave is not counted here."
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {[
            { label: "Wishlisted", value: funnel.wishlist_users, note: "Users with ≥1 save" },
            { label: "Checkout started", value: funnel.checkout_started, note: "Unpaid placed orders" },
            { label: "Paid", value: funnel.paid_orders, note: "Successful card payment" },
          ].map((step, index) => (
            <div key={step.label} className="relative flex-1 rounded-xl border border-[#e2e7e4] bg-white p-4">
              {index < 2 ? (
                <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-[#9aa8a2] sm:block" aria-hidden>
                  →
                </span>
              ) : null}
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">{step.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.04em] text-[#17231f]">{number(step.value)}</p>
              <p className="mt-1 text-xs text-[#687770]">{step.note}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Search demand" detail="What shoppers type — including zero-result queries." />
          {discovery?.has_data && (discovery.search.top_queries.length || discovery.search.zero_result_queries.length) ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#82908a]">Top queries</p>
                <div className="mt-2 divide-y divide-[#eef2f0]">
                  {discovery.search.top_queries.map((row) => (
                    <div key={row.query} className="flex justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-[#31443d]">“{row.query}”</span>
                      <span className="tabular-nums text-[#687770]">{number(row.count)}</span>
                    </div>
                  ))}
                  {!discovery.search.top_queries.length ? <p className="py-3 text-sm text-[#687770]">No searches yet.</p> : null}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#82908a]">Zero results</p>
                <div className="mt-2 divide-y divide-[#eef2f0]">
                  {discovery.search.zero_result_queries.map((row) => (
                    <div key={row.query} className="flex justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-[#31443d]">“{row.query}”</span>
                      <span className="tabular-nums text-[#9c5b05]">{number(row.count)}</span>
                    </div>
                  ))}
                  {!discovery.search.zero_result_queries.length ? <p className="py-3 text-sm text-[#687770]">No zero-result searches.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#d5ddd9] bg-[#f8faf9] px-4 py-8 text-center text-sm text-[#687770]">
              Search queries appear here once shoppers use storefront search.
            </div>
          )}
          {discovery?.has_data ? (
            <p className="mt-3 text-xs text-[#687770]">
              {number(discovery.search.searches)} searches · {number(discovery.search.zero_results)} zero-result · {number(discovery.search.result_clicks)} result clicks
            </p>
          ) : null}
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Friction" detail="Blocked add-to-cart and auth barriers." />
          {discovery?.has_data && (discovery.friction.add_to_cart_blocked || discovery.friction.auth_fails) ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">ATC blocked</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{number(discovery.friction.add_to_cart_blocked)}</p>
                </div>
                <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Auth fails</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{number(discovery.friction.auth_fails)}</p>
                </div>
                <div className="rounded-lg bg-[#f7faf8] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Logins</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{number(discovery.friction.auth_logins)}</p>
                </div>
              </div>
              <div className="divide-y divide-[#eef2f0]">
                {discovery.friction.blocked_reasons.map((row) => (
                  <div key={row.reason} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="font-medium text-[#31443d]">{row.reason.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-[#687770]">{number(row.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#d5ddd9] bg-[#f8faf9] px-4 py-8 text-center text-sm text-[#687770]">
              Friction signals appear when shoppers hit size/stock/auth blockers.
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="overflow-hidden">
          <div className="p-5 sm:p-6">
            <SectionTitle title="Product intent funnel" detail="Wishlist vs unpaid checkout lines vs paid units." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
                <tr>
                  {["Product", "Wishlist", "Unpaid", "Paid"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f0]">
                {productFunnel.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#17231f]">{row.title}</p>
                      <p className="text-xs text-[#687770]">{row.store_name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[#31443d]">{number(row.wishlist_count)}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[#9c5b05]">{number(row.unpaid_units)}</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-[#277044]">{number(row.paid_units)}</td>
                  </tr>
                ))}
                {!productFunnel.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-[#687770]">
                      No wishlist product demand yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="p-5 sm:p-6">
            <SectionTitle title="Interest without purchase" detail="Wishlisted in period data, zero paid units." />
          </div>
          <div className="divide-y divide-[#eef2f0]">
            {intentWithoutPurchase.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#17231f]">{row.title}</span>
                  <span className="block truncate text-xs text-[#687770]">{row.store_name}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#9c5b05]">{number(row.wishlist_count)} saves</span>
              </div>
            ))}
            {!intentWithoutPurchase.length ? (
              <p className="px-5 py-10 text-center text-sm text-[#687770]">No unmatched wishlist demand right now.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className="p-5 sm:p-6">
        <SectionTitle
          title="Browse and cart tracking"
          detail={hasIntent ? "Populated from marketplace_events and cart_snapshots." : "Pipeline is live. Panels stay empty until real events arrive."}
        />
        {hasIntent ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#82908a]">Most viewed</p>
              <div className="mt-3 divide-y divide-[#eef2f0]">
                {(intent?.top_viewed ?? []).map((row) => (
                  <div key={row.id} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-medium text-[#31443d]">{row.title}</span>
                    <span className="tabular-nums text-[#687770]">{number(row.views)}</span>
                  </div>
                ))}
                {!(intent?.top_viewed ?? []).length ? <p className="py-4 text-sm text-[#687770]">No views in this range.</p> : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#82908a]">Most added to cart</p>
              <div className="mt-3 divide-y divide-[#eef2f0]">
                {(intent?.top_carted ?? []).map((row) => (
                  <div key={row.id} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-medium text-[#31443d]">{row.title}</span>
                    <span className="tabular-nums text-[#687770]">{number(row.cart_adds)}</span>
                  </div>
                ))}
                {!(intent?.top_carted ?? []).length ? <p className="py-4 text-sm text-[#687770]">No cart adds in this range.</p> : null}
              </div>
            </div>
            {discovery?.has_data ? (
              <div className="rounded-xl border border-[#e2e7e4] bg-[#f7faf8] p-4 lg:col-span-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Listing impressions</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{number(discovery.funnel.listing_impressions)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Listing clicks</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{number(discovery.funnel.listing_clicks)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Sessions</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{number(discovery.acquisition.sessions)}</p>
                  </div>
                </div>
                {discovery.acquisition.top_sources.length ? (
                  <div className="mt-4 divide-y divide-[#e2e7e4]">
                    {discovery.acquisition.top_sources.map((row) => (
                      <div key={row.source} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-[#31443d]">{row.source}</span>
                        <span className="tabular-nums text-[#687770]">{number(row.count)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-xl border border-[#e2e7e4] bg-[#f7faf8] p-4 lg:col-span-2">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Active users</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{number(intent?.active_users_period)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Users with carts</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{number(intent?.users_with_cart_snapshot)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Items in carts</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{number(intent?.products_in_carts)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#82908a]">Cart value</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{formatAed(intent?.cart_subtotal_aed ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[#d5ddd9] bg-[#f8faf9] px-4 py-10 text-center">
            <p className="text-sm font-semibold text-[#17231f]">Tracking live — no browse/cart events yet</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#687770]">
              Views, cart adds, search, and checkout-step events will fill this section as shoppers use the storefront. Until then, use wishlist and unpaid checkout metrics above — those are already real.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

const STACK_ROTATIONS = ["-rotate-6", "rotate-3", "-rotate-2"];

function OrderProductImageStack({ products, onPreview }: { products: FounderOrderProduct[]; onPreview: (product: FounderOrderProduct) => void }) {
  const visible = products.slice(0, 3);
  if (!visible.length) {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#dce5e0] bg-[#edf3f0] text-[#5b9183]">
        <PortalIcon name="products" className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span role="img" className="relative h-11 w-[3.4rem] shrink-0" aria-label={`${products.length} product${products.length === 1 ? "" : "s"} in this order`}>
      {visible.map((product, index) => {
        const offset = (visible.length - 1 - index) * 7;
        const thumb = product.image_url ? (
          <Image src={product.image_url} alt={product.title} width={44} height={44} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[#5b9183]">
            <PortalIcon name="products" className="h-4 w-4" />
          </span>
        );
        return product.image_url ? (
          <button
            key={product.id}
            type="button"
            onClick={() => onPreview(product)}
            aria-label={`View larger image of ${product.title}`}
            className={`absolute inset-y-0 block h-11 w-11 overflow-hidden rounded-lg border-2 border-white bg-[#edf3f0] shadow-[0_2px_7px_rgba(28,48,40,0.16)] ${STACK_ROTATIONS[index]}`}
            style={{ left: `${offset}px` }}
          >
            {thumb}
          </button>
        ) : (
          <span key={product.id} className={`absolute inset-y-0 block h-11 w-11 overflow-hidden rounded-lg border-2 border-white bg-[#edf3f0] shadow-[0_2px_7px_rgba(28,48,40,0.16)] ${STACK_ROTATIONS[index]}`} style={{ left: `${offset}px` }}>
            {thumb}
          </span>
        );
      })}
    </span>
  );
}

function OrderProductList({ products, onPreview }: { products: FounderOrderProduct[]; onPreview: (product: FounderOrderProduct) => void }) {
  if (!products.length) {
    return <p className="mt-1 text-xs text-[#7b8882]">Product details unavailable</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {products.map((product) => (
        <li key={product.id} className="flex min-w-0 items-center gap-2">
          {product.image_url ? (
            <button
              type="button"
              onClick={() => onPreview(product)}
              aria-label={`View larger image of ${product.title}`}
              className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-[#dce5e0] bg-[#edf3f0] transition hover:border-[#5b9183] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3c8272]"
            >
              <Image src={product.image_url} alt={product.title} width={36} height={36} className="h-full w-full object-cover" />
            </button>
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#dce5e0] bg-[#edf3f0] text-[#5b9183]">
              <PortalIcon name="products" className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="min-w-0 truncate text-xs text-[#7b8882]" title={`${product.quantity}× ${product.title}`}>
            {product.quantity}× {product.title}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProductImageDialog({ product, onClose }: { product: FounderOrderProduct; onClose: () => void }) {
  if (!product.image_url) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#132c2a]/65 p-4" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Larger image of ${product.title}`}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-3 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 rounded-full bg-[#17231f]/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#17231f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Close
        </button>
        <Image src={product.image_url} alt={product.title} width={1200} height={1200} sizes="(max-width: 768px) 90vw, 672px" className="max-h-[82vh] w-full rounded-xl object-contain" />
        <p className="mt-3 px-1 text-sm font-semibold text-[#17231f]">
          {product.quantity}× {product.title}
        </p>
      </div>
    </div>
  );
}

function OrderTable({ orders, compact = false }: { orders: FounderData["recent_orders"]; compact?: boolean }) {
  const [preview, setPreview] = useState<FounderOrderProduct | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="border-y border-[#e2e7e4] bg-[#f7faf8]">
          <tr>
            {["Order", "Boutique", "Shopper", "Phone", "Status", "Value", "Placed"].map((heading) => (
              <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef2f0]">
          {orders.map((order) => {
            const products = order.products ?? [];
            const productSummary = products.map((product) => `${product.quantity}× ${product.title}`).join(" · ");
            return (
              <tr key={order.id} className="transition hover:bg-[#f9fbfa]">
                <td className="px-5 py-3.5 text-sm font-semibold text-[#17231f]">{order.order_number}</td>
                <td className="px-5 py-3.5 text-sm text-[#52615b]">
                  {compact ? (
                    <div className="flex min-w-0 items-start gap-3">
                      <OrderProductImageStack products={products} onPreview={setPreview} />
                      <div className="min-w-0">
                        <p>{order.store_name}</p>
                        <p className="mt-1 max-w-[260px] truncate text-xs text-[#7b8882]" title={productSummary}>
                          {productSummary || "Product details unavailable"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p>{order.store_name}</p>
                      <OrderProductList products={products} onPreview={setPreview} />
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm text-[#52615b]">{order.shopper_name}</td>
                <td className="px-5 py-3.5 text-sm text-[#52615b]">
                  {order.customer_phone ? (
                    <a href={`tel:${order.customer_phone}`} className="font-semibold text-[#245448] underline-offset-2 hover:underline">
                      {order.customer_phone}
                    </a>
                  ) : (
                    <span className="text-[#9aa9a2]">No phone</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <StatusPill status={order.status} />
                </td>
                <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(order.total_aed)}</td>
                <td className="px-5 py-3.5 text-xs text-[#687770]">{compact ? dateTime(order.placed_at) : `${dateTime(order.placed_at)} · ${order.delivery_area}`}</td>
              </tr>
            );
          })}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-sm text-[#687770]">
                No orders in this period yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {preview?.image_url ? <ProductImageDialog product={preview} onClose={() => setPreview(null)} /> : null}
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

function LiveDeliveryMap({ data }: { data: FounderDeliveryData }) {
  const [customerPins, setCustomerPins] = useState<Array<{ id: string; lat: number; lng: number; label: string }>>([]);
  const moving = data.jobs.filter((job) => ["assigned", "accepted", "at_pickup", "collected"].includes(job.status));
  useEffect(() => {
    let active = true;
    void Promise.all(moving.map(async (job) => {
      const address = [job.delivery_street, job.delivery_building, job.delivery_apartment, job.delivery_area, job.delivery_emirate, "UAE"].filter(Boolean).join(", ");
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const payload = response.ok ? await response.json() as { results?: Array<{ lat: number; lng: number }> } : null;
      const result = payload?.results?.[0];
      return result && Number.isFinite(result.lat) && Number.isFinite(result.lng) ? { id: job.id, lat: result.lat, lng: result.lng, label: job.order_number } : null;
    })).then((pins) => { if (active) setCustomerPins(pins.filter((pin): pin is { id: string; lat: number; lng: number; label: string } => pin !== null)); }).catch(() => { if (active) setCustomerPins([]); });
    return () => { active = false; };
  }, [data.jobs]);
  const points = [
    ...data.drivers.filter((driver) => driver.last_lat != null && driver.last_lng != null).map((driver) => ({ id: `driver-${driver.id}`, lat: driver.last_lat!, lng: driver.last_lng!, label: driver.display_name, type: "driver" as const })),
    ...data.jobs.filter((job) => job.store_lat != null && job.store_lng != null).map((job) => ({ id: `store-${job.id}`, lat: job.store_lat!, lng: job.store_lng!, label: job.store_name, type: "store" as const })),
    ...customerPins.map((pin) => ({ ...pin, id: `customer-${pin.id}`, type: "customer" as const })),
  ];
  const bounds = points.length ? {
    north: Math.max(...points.map((point) => point.lat)) + 0.012,
    south: Math.min(...points.map((point) => point.lat)) - 0.012,
    east: Math.max(...points.map((point) => point.lng)) + 0.015,
    west: Math.min(...points.map((point) => point.lng)) - 0.015,
  } : null;
  const position = (lat: number, lng: number) => bounds ? { left: `${Math.min(92, Math.max(8, ((lng - bounds.west) / (bounds.east - bounds.west)) * 100))}%`, top: `${Math.min(88, Math.max(12, ((bounds.north - lat) / (bounds.north - bounds.south)) * 100))}%` } : {};

  return <Panel className="overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6"><SectionTitle title="Live delivery map" detail="Drivers, pickup points, and orders currently moving through the network." /><div className="flex gap-2 text-[11px] font-semibold"><span className="rounded-full bg-[#e5f5eb] px-2.5 py-1 text-[#277044]">{data.drivers.filter((driver) => driver.last_location_at).length} live riders</span><span className="rounded-full bg-[#fff1dc] px-2.5 py-1 text-[#9c5b05]">{data.metrics.waiting_jobs} waiting</span></div></div>
    <div className="relative h-[27rem] overflow-hidden border-y border-[#dbe5df] bg-[#eaf2ee] sm:h-[34rem]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.54) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.54) 1px,transparent 1px),radial-gradient(circle at 74% 20%,#d6e9df,transparent 36%)", backgroundSize: "42px 42px,42px 42px,auto" }}>
      <div className="absolute inset-x-[8%] top-[22%] h-1 rotate-[-13deg] rounded-full bg-white/75 shadow-sm" /><div className="absolute inset-x-[16%] top-[62%] h-1 rotate-[18deg] rounded-full bg-white/75 shadow-sm" /><div className="absolute left-[48%] top-[8%] h-[84%] w-1 rotate-[25deg] rounded-full bg-white/65" />
      {bounds ? points.map((point) => <div key={point.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={position(point.lat, point.lng)}><span className={`grid h-9 w-9 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg ${point.type === "driver" ? "bg-[#276d61]" : point.type === "store" ? "bg-[#f08a32]" : "bg-[#356bb3]"}`}><PortalIcon name={point.type === "store" ? "store" : "location"} className="h-4 w-4" /></span><span className="mt-1 block max-w-28 truncate rounded bg-white/90 px-1.5 py-1 text-center text-[10px] font-bold text-[#27433a] shadow-sm">{point.label}</span></div>) : <div className="grid h-full place-items-center px-6 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#276d61] shadow-sm"><PortalIcon name="location" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#21342e]">Waiting for live location sharing</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#687770]">Driver and store pins appear as soon as their coordinates are available.</p></div></div>}
      <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6a7d75]">Map key</p><div className="mt-2 flex gap-3 text-[11px] font-semibold text-[#405a50]"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#276d61]" />Rider</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#f08a32]" />Pickup</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#356bb3]" />Customer</span></div></div>
    </div>
    <div className="grid divide-y divide-[#e4ece8] sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">Moving now</p><p className="mt-1 text-lg font-bold text-[#17231f]">{moving.length} orders</p></div><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">Pickup locations</p><p className="mt-1 text-lg font-bold text-[#17231f]">{new Set(moving.map((job) => job.store_name)).size} stores</p></div><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">Customer destinations</p><p className="mt-1 text-sm font-semibold text-[#17231f]">Shown inside each active order</p></div></div>
  </Panel>;
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
      <LiveDeliveryMap data={data} />
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
                <div key={partner.id} className="rounded-xl border border-[#d5ddd9] bg-[#f7faf8] p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#17231f]">{partner.name}</span>
                      <span className="mt-1 block text-xs text-[#687770]">
                        {number(partner.available_drivers)} of {number(partner.total_drivers)} riders available
                      </span>
                    </span>
                    <span className={`justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold sm:justify-self-end ${dispatching ? "bg-[#e5f5eb] text-[#277044]" : "bg-[#f8e8e9] text-[#a3444c]"}`}>
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
              {["Customer", "Phone", "Joined", "Orders", "Lifetime value", "Last order"].map((heading) => (
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
                <td className="px-5 py-4 text-sm text-[#52615b]">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="font-semibold text-[#245448] underline-offset-2 hover:underline">
                      {customer.phone}
                    </a>
                  ) : (
                    <span className="text-[#9aa9a2]">No phone</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-[#52615b]">{dateTime(customer.created_at)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{number(customer.orders)}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#17231f]">{formatAed(customer.revenue)}</td>
                <td className="px-5 py-4 text-sm text-[#52615b]">{dateTime(customer.last_order_at)}</td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#687770]">
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
    { label: "Small order fees", value: data.finance.small_order_fees, detail: "No longer charged on new orders" },
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

function SettlementsView() {
  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const load = async () => { setLoading(true); const { data, error } = await createClient().rpc("founder_settlement_data", { p_range_days: 7 }); if (error) setMessage(error.message); else setSettlement(data as SettlementData); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const outstanding = settlement?.stores.reduce((sum, store) => sum + Math.max(0, Number(store.net_payout) - Number(store.paid_amount)), 0) ?? 0;
  async function markPaid(store: SettlementStore) {
    setBusyId(store.store_id); setMessage(null);
    const { error } = await createClient().rpc("record_merchant_payout", { p_store_id: store.store_id, p_period_start: settlement?.period_start, p_period_end: settlement?.period_end, p_payment_method: "bank_transfer", p_payment_reference: window.prompt("Payment reference (optional):") ?? "", p_note: null });
    if (error) setMessage(error.message); else { setMessage(`${store.store_name} payout recorded.`); await load(); }
    setBusyId(null);
  }
  async function saveCommission(store: SettlementStore) {
    const value = Number(rateDrafts[store.store_id] ?? (Number(store.commission_rate) * 100));
    if (!Number.isFinite(value) || value < 0 || value > 100) { setMessage("Commission must be between 0% and 100%."); return; }
    setBusyId(store.store_id); setMessage(null);
    const { error } = await createClient().rpc("founder_set_store_commission", { p_store_id: store.store_id, p_commission_rate: value / 100 });
    if (error) setMessage(error.message); else { setMessage(`${store.store_name} commission updated.`); await load(); }
    setBusyId(null);
  }
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Ready to pay" value={formatAed(outstanding)} detail="Delivered orders · last 7 days" tone={outstanding ? "attention" : "default"} icon="analytics" /><MetricCard label="Stores" value={number(settlement?.stores.length)} detail="With settlement activity" icon="store" /><MetricCard label="Default commission" value={`${Math.round((settlement?.default_commission_rate ?? 0.18) * 100)}%`} detail="New stores start here" icon="analytics" /></div>
    <Panel className="p-5 sm:p-6"><SectionTitle title="Store settlements" detail="Set each store's commission, then review delivered-order balances and payments." /><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="border-y border-[#e2e7e4] bg-[#f7faf8]"><tr>{["Store", "Commission rate", "Orders", "Gross sales", "Commission", "Net payout", "Action"].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#eef2f0]">{loading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#687770]">Loading settlements…</td></tr> : settlement?.stores.map((store) => { const due = Math.max(0, Number(store.net_payout) - Number(store.paid_amount)); return <tr key={store.store_id}><td className="px-4 py-4 text-sm font-semibold text-[#17231f]">{store.store_name}</td><td className="px-4 py-4"><div className="flex items-center gap-2"><input aria-label={`${store.store_name} commission rate`} type="number" min="0" max="100" step="0.1" value={rateDrafts[store.store_id] ?? Number(store.commission_rate) * 100} onChange={(event) => setRateDrafts((drafts) => ({ ...drafts, [store.store_id]: event.target.value }))} className="w-20 rounded-lg border border-[#d5ddd9] px-2 py-1.5 text-sm" /><span className="text-sm text-[#52615b]">%</span><button type="button" onClick={() => void saveCommission(store)} disabled={busyId === store.store_id} className="rounded-lg border border-[#b8c7bf] px-2.5 py-1.5 text-xs font-semibold text-[#21342e] disabled:opacity-50">Save</button></div></td><td className="px-4 py-4 text-sm text-[#52615b]">{number(store.order_count)}</td><td className="px-4 py-4 text-sm tabular-nums text-[#52615b]">{formatAed(store.gross_sales)}</td><td className="px-4 py-4 text-sm tabular-nums text-[#52615b]">{formatAed(store.commission)}</td><td className="px-4 py-4 text-sm font-bold tabular-nums text-[#17231f]">{formatAed(due)}</td><td className="px-4 py-4">{due > 0 ? <button type="button" onClick={() => void markPaid(store)} disabled={busyId === store.store_id} className="rounded-lg bg-[#21342e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === store.store_id ? "Saving…" : "Mark paid"}</button> : <span className="text-xs font-semibold text-[#277044]">Paid</span>}</td></tr>; })}{!loading && !settlement?.stores.length ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#687770]">No delivered orders are ready for settlement.</td></tr> : null}</tbody></table></div>{message ? <p role="status" className="mt-4 rounded-lg bg-[#fff1dc] px-3 py-2.5 text-sm text-[#805313]">{message}</p> : null}</Panel>
    <Panel className="p-5 sm:p-6"><SectionTitle title="Payout history" detail="Recorded settlement payments and their audit trail." /><div className="mt-4 divide-y divide-[#eef2f0]">{settlement?.history.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold text-[#17231f]">{entry.store_name}</p><p className="mt-1 text-xs text-[#687770]">{dateTime(entry.paid_at)} · {entry.payment_reference || "No reference added"}</p></div><span className="font-bold tabular-nums text-[#277044]">{formatAed(entry.net_payout)}</span></div>)}{!settlement?.history.length ? <p className="py-8 text-center text-sm text-[#687770]">No payouts recorded yet.</p> : null}</div></Panel>
  </div>;
}

function RefundsView() {
  const [refunds, setRefunds] = useState<FounderRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    const { data, error } = await createClient().rpc("founder_refund_data");
    if (error) setMessage(error.message); else setRefunds((data as FounderRefund[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  async function markSent(refund: FounderRefund) {
    const reference = window.prompt(`External payment reference for ${formatAed(refund.amount_aed)} to ${refund.shopper_name}:`)?.trim() ?? "";
    if (!reference) return;
    setBusyId(refund.refund_id); setMessage(null);
    const { error } = await createClient().rpc("founder_mark_refund_sent", { p_return_request_id: refund.return_request_id, p_processor_reference: reference, p_note: null });
    if (error) setMessage(error.message); else { setMessage(`${refund.order_number} refund recorded as sent.`); await load(); }
    setBusyId(null);
  }
  const pending = refunds.filter((refund) => refund.status === "pending_processor");
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Refunds to send" value={number(pending.length)} detail="After owner confirms receipt" tone={pending.length ? "attention" : "default"} icon="refresh" /><MetricCard label="Amount outstanding" value={formatAed(pending.reduce((sum, refund) => sum + Number(refund.amount_aed), 0))} detail="Manual external payments" tone={pending.length ? "attention" : "default"} icon="analytics" /><MetricCard label="Recent refunds" value={number(refunds.length)} detail="Pending and completed records" icon="orders" /></div>
    <Panel className="p-5 sm:p-6"><SectionTitle title="Refund queue" detail="Send the external payment, then record the reference here. Morni does not move money automatically." /><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-y border-[#e2e7e4] bg-[#f7faf8]"><tr>{["Order", "Shopper", "Boutique", "Amount", "Method", "Requested", "Status", "Action"].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b8882]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#eef2f0]">{loading ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#687770]">Loading refunds…</td></tr> : refunds.map((refund) => <tr key={refund.refund_id}><td className="px-4 py-4 text-sm font-semibold text-[#17231f]">{refund.order_number}<span className="mt-1 block text-xs font-normal text-[#687770]">{refund.reason}</span></td><td className="px-4 py-4 text-sm text-[#52615b]">{refund.shopper_name}<span className="mt-1 block text-xs text-[#687770]">{refund.shopper_phone || "No phone"}</span></td><td className="px-4 py-4 text-sm text-[#52615b]">{refund.store_name}</td><td className="px-4 py-4 text-sm font-bold tabular-nums text-[#17231f]">{formatAed(refund.amount_aed)}</td><td className="px-4 py-4 text-xs font-semibold text-[#52615b]">{refund.method === "original_payment_method" ? "Original payment" : "Manual wallet credit"}</td><td className="px-4 py-4 text-xs text-[#687770]">{dateTime(refund.created_at)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${refund.status === "processed" ? "bg-[#e5f5eb] text-[#277044]" : "bg-[#fff1dc] text-[#9c5b05]"}`}>{refund.status === "processed" ? "Sent" : "To send"}</span></td><td className="px-4 py-4">{refund.status === "pending_processor" ? <button type="button" onClick={() => void markSent(refund)} disabled={busyId === refund.refund_id} className="rounded-lg bg-[#21342e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === refund.refund_id ? "Saving…" : "Record payment"}</button> : <span className="text-xs text-[#687770]">{refund.processor_reference || "Recorded"}</span>}</td></tr>)}{!loading && !refunds.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#687770]">No refunds are waiting.</td></tr> : null}</tbody></table></div>{message ? <p role="status" className="mt-4 rounded-lg bg-[#fff1dc] px-3 py-2.5 text-sm text-[#805313]">{message}</p> : null}</Panel>
  </div>;
}

function WorkspaceContent({ data, discovery, deliveryData, activeView, ownerName, onViewChange, onRefresh }: { data: FounderData; discovery: FounderDiscoveryData | null; deliveryData: FounderDeliveryData; activeView: FounderView; ownerName?: string; onViewChange: (view: FounderView) => void; onRefresh: () => void }) {
  if (activeView === "demand") return <DemandView data={data} discovery={discovery} />;
  if (activeView === "operations") return <Panel><OrderTable orders={data.recent_orders} /></Panel>;
  if (activeView === "delivery") return <DeliveryView data={deliveryData} onRefresh={onRefresh} />;
  if (activeView === "stores") return <StoresView stores={data.stores} />;
  if (activeView === "customers") return <CustomersView customers={data.customers} />;
  if (activeView === "catalogue") return <CatalogueView products={data.top_products} />;
  if (activeView === "finance") return <FinanceView data={data} />;
  if (activeView === "settlements") return <SettlementsView />;
  if (activeView === "refunds") return <RefundsView />;
  if (activeView === "alerts") return <ActionCentre alerts={data.alerts} onViewChange={onViewChange} />;
  return <Overview data={data} ownerName={ownerName} onViewChange={onViewChange} />;
}

export function FounderWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<FounderData | null>(null);
  const [deliveryData, setDeliveryData] = useState<FounderDeliveryData | null>(null);
  const [discovery, setDiscovery] = useState<FounderDiscoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);
  const [activeView, setActiveView] = useState<FounderView>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = auth?.profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const client = createClient();
    void Promise.all([
      client.rpc("founder_workspace_data", { p_range_days: range }),
      client.rpc("founder_delivery_workspace_data"),
      client.rpc("founder_discovery_metrics", { p_range_days: range }),
    ]).then(async ([workspaceResponse, deliveryResponse, discoveryResponse]) => {
      if (!active) return;
      if (workspaceResponse.error || deliveryResponse.error) {
        setError(workspaceResponse.error?.message ?? deliveryResponse.error?.message ?? "Unable to load Founder data.");
        setData(null);
        setDeliveryData(null);
        setDiscovery(null);
      } else {
        const founderData = workspaceResponse.data as unknown as FounderData;
        const orderIds = founderData.recent_orders.map((order) => order.id);
        const { data: itemRows } = orderIds.length
          ? await client.from("order_items").select("id,order_id,title,quantity,image_url").in("order_id", orderIds)
          : { data: [] };
        const productsByOrder = new Map<string, FounderOrderProduct[]>();
        for (const item of (itemRows ?? []) as Array<FounderOrderProduct & { order_id: string }>) {
          const products = productsByOrder.get(item.order_id) ?? [];
          products.push({ id: item.id, title: item.title, quantity: item.quantity, image_url: item.image_url });
          productsByOrder.set(item.order_id, products);
        }
        setData({ ...founderData, recent_orders: founderData.recent_orders.map((order) => ({ ...order, products: productsByOrder.get(order.id) ?? [] })) });
        setDeliveryData(deliveryResponse.data as unknown as FounderDeliveryData);
        setDiscovery(discoveryResponse.error ? null : (discoveryResponse.data as unknown as FounderDiscoveryData));
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
          overview: ["Marketplace overview", "Paid revenue, demand signals, and priorities across Morni."],
          demand: ["Demand & intent", "Search, funnel, friction, wishlist, and checkout abandonment."],
          operations: ["Orders", "Live paid-order queue across every boutique."],
          delivery: ["Delivery", "Jobs, partners, riders, and exceptions."],
          stores: ["Stores", "Commercial and catalogue health across the network."],
          customers: ["Customers", "Shopper relationships growing Morni."],
          catalogue: ["Products", "Paid demand and inventory signals."],
          finance: ["Finance", "Sales, fees, and payment readiness."],
          settlements: ["Settlements", "Store payouts, balances, and payment history."],
          refunds: ["Refunds", "Manual refund queue for completed returns."],
          alerts: ["Action centre", "Exceptions that deserve attention first."],
        }) satisfies Record<FounderView, [string, string]>
      )[activeView],
    [activeView],
  );

  if (authLoading) return <FounderLoading />;
  if (!auth) return <FounderAccess title="Sign in to open Founder" description="Use the Morni administrator account to access the company workspace." action="Sign in" href="/founder/auth?next=%2Ffounder" />;
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
              <WorkspaceContent data={data} discovery={discovery} deliveryData={deliveryData} activeView={activeView} ownerName={auth.firstName} onViewChange={setActiveView} onRefresh={refreshData} />
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
