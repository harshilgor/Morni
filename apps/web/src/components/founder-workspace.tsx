"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { formatAed, orderStatusLabel } from "@/lib/format";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import type { OrderStatus } from "@/lib/types";

type FounderView =
  | "overview"
  | "operations"
  | "stores"
  | "customers"
  | "catalogue"
  | "finance"
  | "alerts";

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
  alerts: Array<{ tone: "urgent" | "warning" | "default"; title: string; detail: string; href: string }>;
};

const navItems: Array<{ id: FounderView; label: string; icon: PortalIconName }> = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "operations", label: "Operations", icon: "orders" },
  { id: "stores", label: "Stores", icon: "store" },
  { id: "customers", label: "Customers", icon: "reviews" },
  { id: "catalogue", label: "Catalogue", icon: "products" },
  { id: "finance", label: "Finance", icon: "analytics" },
  { id: "alerts", label: "Alerts", icon: "warning" },
];

const statusOrder: OrderStatus[] = [
  "placed",
  "accepted",
  "picking",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("en-AE").format(Number(value ?? 0));
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusStyle(status: OrderStatus) {
  const styles: Record<OrderStatus, string> = {
    placed: "bg-amber-400/10 text-amber-300 ring-amber-300/20",
    accepted: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
    picking: "bg-violet-400/10 text-violet-300 ring-violet-300/20",
    out_for_delivery: "bg-teal-400/10 text-teal-300 ring-teal-300/20",
    delivered: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
    cancelled: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
  };
  return styles[status];
}

function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusStyle(status)}`}>{orderStatusLabel(status)}</span>;
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: PortalIconName;
  tone?: "default" | "good" | "warning";
}) {
  const toneClasses = {
    default: "border-white/8 bg-[#151b19]",
    good: "border-emerald-300/14 bg-[linear-gradient(135deg,rgba(16,185,129,0.11),rgba(21,27,25,0.92))]",
    warning: "border-amber-300/14 bg-[linear-gradient(135deg,rgba(245,158,11,0.11),rgba(21,27,25,0.92))]",
  };
  return (
    <section className={`rounded-xl border p-4 shadow-[0_12px_30px_-26px_rgba(0,0,0,0.9)] ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#84908a]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-[#f4f7f5] tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-5 text-[#89958f]">{detail}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/[0.035] text-[#a8cdbf]"><PortalIcon name={icon} className="h-4 w-4" /></span>
      </div>
    </section>
  );
}

function SectionTitle({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-[#edf3ef]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#84908a]">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/8 bg-[#151b19] p-5 shadow-[0_16px_34px_-28px_rgba(0,0,0,0.9)] ${className}`}>{children}</section>;
}

function RevenueChart({ days }: { days: FounderData["daily_sales"] }) {
  const max = Math.max(...days.map((day) => Number(day.revenue)), 1);
  return (
    <div className="mt-7 flex h-56 items-end gap-2">
      {days.map((day) => {
        const height = Math.max((Number(day.revenue) / max) * 100, 4);
        return (
          <div key={day.day} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="relative flex h-44 w-full items-end rounded-md bg-white/[0.035]">
              <div className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0f1412] px-2 py-1 text-[10px] font-semibold text-[#d6e2dc] shadow-xl group-hover:block">{formatAed(day.revenue)}</div>
              <div className="w-full rounded-md bg-[linear-gradient(180deg,#62b897,#317a68)] transition-[height] duration-500" style={{ height: `${height}%` }} />
            </div>
            <span className="truncate text-[10px] font-semibold text-[#748078]">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FounderSidebar({ activeView, onViewChange, alertCount }: { activeView: FounderView; onViewChange: (view: FounderView) => void; alertCount: number }) {
  return (
    <aside className="border-b border-white/8 bg-[#0c100f] lg:sticky lg:top-0 lg:h-screen lg:w-[15.5rem] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-4 lg:px-5 lg:py-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[linear-gradient(135deg,#5ac09c,#29715e)] font-display text-xl text-white shadow-[0_8px_22px_-12px_rgba(75,197,155,0.75)]">M</span>
          <span><span className="block text-sm font-semibold tracking-[-0.03em] text-[#edf3ef]">Morni Founder</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-[#728078]">Command centre</span></span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:space-y-1 lg:overflow-visible lg:px-3 lg:py-4">
          {navItems.map((item) => {
            const active = item.id === activeView;
            return <button key={item.id} type="button" onClick={() => onViewChange(item.id)} className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${active ? "bg-[#1b2a25] text-[#b9ead6] shadow-[inset_0_0_0_1px_rgba(127,205,172,0.14)]" : "text-[#87938c] hover:bg-white/[0.045] hover:text-[#dce7e1]"}`}><PortalIcon name={item.icon} className="h-[17px] w-[17px]" /><span>{item.label}</span>{item.id === "alerts" && alertCount ? <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-[#d66b4a] px-1.5 py-0.5 text-[10px] font-bold text-white">{alertCount}</span> : null}</button>;
          })}
        </nav>
        <div className="mt-auto hidden border-t border-white/8 p-3 lg:block">
          <Link href="/" className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5 text-xs font-semibold text-[#9eaaa4] transition hover:border-white/15 hover:bg-white/[0.05] hover:text-white">Open shopper site <PortalIcon name="external" className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
    </aside>
  );
}

function Overview({ data, onViewChange }: { data: FounderData; onViewChange: (view: FounderView) => void }) {
  const { metrics } = data;
  const highPerformingStores = data.stores.filter((store) => store.period_orders > 0).slice(0, 4);
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Today’s sales" value={formatAed(metrics.today_revenue)} detail={`${number(metrics.today_orders)} order${metrics.today_orders === 1 ? "" : "s"} placed today`} icon="analytics" tone="good" />
      <MetricCard label="Open orders" value={number(metrics.open_orders)} detail="Across all active boutiques" icon="orders" tone={metrics.open_orders ? "warning" : "default"} />
      <MetricCard label="Active stores" value={number(metrics.active_stores)} detail={`${number(metrics.new_stores)} joined today`} icon="store" />
      <MetricCard label="New shoppers" value={number(metrics.new_shoppers)} detail={`${formatAed(metrics.average_order_value)} average order`} icon="sparkle" />
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.72fr)]">
      <Panel>
        <SectionTitle title="Revenue pulse" detail={`Gross order value · last ${data.range_days} days`} action={<button type="button" onClick={() => onViewChange("finance")} className="text-xs font-semibold text-[#9ed8c0] hover:text-white">View finance →</button>} />
        <RevenueChart days={data.daily_sales} />
      </Panel>
      <Panel>
        <SectionTitle title="Live operations" detail="Orders currently moving through Morni" action={<button type="button" onClick={() => onViewChange("operations")} className="text-xs font-semibold text-[#9ed8c0] hover:text-white">All orders →</button>} />
        <div className="mt-5 space-y-2.5">
          {statusOrder.slice(0, 5).map((status) => <div key={status} className="flex items-center justify-between rounded-lg border border-white/7 bg-white/[0.025] px-3 py-2.5"><span className="flex items-center gap-2.5 text-sm text-[#dbe5df]"><span className={`h-2 w-2 rounded-full ${status === "placed" ? "bg-amber-300" : status === "out_for_delivery" ? "bg-teal-300" : "bg-[#82928a]"}`} />{orderStatusLabel(status)}</span><span className="text-sm font-semibold tabular-nums text-[#f2f6f3]">{number(data.status_breakdown[status])}</span></div>)}
        </div>
        <div className="mt-4 rounded-lg border border-emerald-300/10 bg-emerald-300/[0.055] px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-300/80">Completion health</p><p className="mt-1 text-sm text-[#e0eee7]"><span className="font-semibold">{metrics.delivery_rate}%</span> of active orders have been delivered.</p></div>
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
      <Panel className="overflow-hidden p-0"><div className="p-5"><SectionTitle title="Recent orders" detail="The latest activity across every boutique" action={<button type="button" onClick={() => onViewChange("operations")} className="text-xs font-semibold text-[#9ed8c0] hover:text-white">View queue →</button>} /></div><OrderTable orders={data.recent_orders.slice(0, 6)} compact /></Panel>
      <Panel>
        <SectionTitle title="Store health" detail="Boutiques driving the current period" action={<button type="button" onClick={() => onViewChange("stores")} className="text-xs font-semibold text-[#9ed8c0] hover:text-white">All stores →</button>} />
        <div className="mt-5 space-y-3">{highPerformingStores.length ? highPerformingStores.map((store, index) => <div key={store.id} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.055] text-[10px] font-bold text-[#a9c9bb]">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#e8efeb]">{store.name}</span><span className="mt-0.5 block text-xs text-[#7e8b84]">{number(store.period_orders)} orders · {number(store.live_products)} live pieces</span></span><span className="text-xs font-semibold tabular-nums text-[#d9ebe1]">{formatAed(store.period_revenue)}</span></div>) : <p className="py-8 text-center text-sm text-[#7e8b84]">Store health will appear as orders arrive.</p>}</div>
      </Panel>
    </div>
  </div>;
}

function OrderTable({ orders, compact = false }: { orders: FounderData["recent_orders"]; compact?: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="border-y border-white/7 bg-white/[0.025]"><tr>{["Order", "Boutique", "Shopper", "Status", "Value", "Placed"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#76827b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/6">{orders.map((order) => <tr key={order.id} className="transition hover:bg-white/[0.028]"><td className="px-5 py-3.5 text-sm font-semibold text-[#dfe9e3]">{order.order_number}</td><td className="px-5 py-3.5 text-sm text-[#a9b6af]">{order.store_name}</td><td className="px-5 py-3.5 text-sm text-[#a9b6af]">{order.shopper_name}</td><td className="px-5 py-3.5"><StatusPill status={order.status} /></td><td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#ecf4ef]">{formatAed(order.total_aed)}</td><td className="px-5 py-3.5 text-xs text-[#77847c]">{compact ? dateTime(order.placed_at) : `${dateTime(order.placed_at)} · ${order.delivery_area}`}</td></tr>)}{orders.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#7d8982]">No orders in this period yet.</td></tr> : null}</tbody></table></div>;
}

function StoresView({ stores }: { stores: FounderData["stores"] }) {
  return <Panel className="overflow-hidden p-0"><div className="p-5"><SectionTitle title="Store network" detail="Every boutique and its current operating health." /></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="border-y border-white/7 bg-white/[0.025]"><tr>{["Store", "Location", "Status", "Live catalog", "Low stock", "Orders", "Revenue"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#76827b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/6">{stores.map((store) => <tr key={store.id} className="transition hover:bg-white/[0.028]"><td className="px-5 py-4"><span className="block text-sm font-semibold text-[#e5eee9]">{store.name}</span><span className="mt-1 block text-xs text-[#77847c]">Joined {dateTime(store.created_at)}</span></td><td className="px-5 py-4 text-sm text-[#a9b6af]">{store.emirate.replace("_", " ")}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${store.is_active ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20" : "bg-rose-400/10 text-rose-300 ring-rose-300/20"}`}>{store.is_active ? "Live" : "Paused"}</span></td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#dae5df]">{number(store.live_products)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#e7bc80]">{number(store.low_stock_products)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#dae5df]">{number(store.period_orders)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#edf4f0]">{formatAed(store.period_revenue)}</td></tr>)}</tbody></table></div></Panel>;
}

function CustomersView({ customers }: { customers: FounderData["customers"] }) {
  return <Panel className="overflow-hidden p-0"><div className="p-5"><SectionTitle title="Customer relationships" detail="Top customers by active-order value, with latest order activity." /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-y border-white/7 bg-white/[0.025]"><tr>{["Customer", "Joined", "Orders", "Lifetime value", "Last order"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#76827b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/6">{customers.map((customer) => <tr key={customer.id} className="transition hover:bg-white/[0.028]"><td className="px-5 py-4 text-sm font-semibold text-[#e5eee9]">{customer.full_name}</td><td className="px-5 py-4 text-sm text-[#9ba8a1]">{dateTime(customer.created_at)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#dae5df]">{number(customer.orders)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#edf4f0]">{formatAed(customer.revenue)}</td><td className="px-5 py-4 text-sm text-[#9ba8a1]">{dateTime(customer.last_order_at)}</td></tr>)}{customers.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#7d8982]">Customer relationships will appear as shoppers order.</td></tr> : null}</tbody></table></div></Panel>;
}

function CatalogueView({ products }: { products: FounderData["top_products"] }) {
  return <Panel className="overflow-hidden p-0"><div className="p-5"><SectionTitle title="Product demand" detail="Best-selling pieces in the selected period. Inventory highlights low-stock opportunities." /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-y border-white/7 bg-white/[0.025]"><tr>{["Product", "Boutique", "Units sold", "Sales", "Stock"].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#76827b]">{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/6">{products.map((product, index) => <tr key={`${product.id}-${index}`} className="transition hover:bg-white/[0.028]"><td className="px-5 py-4"><span className="mr-3 inline-grid h-6 w-6 place-items-center rounded-md bg-white/[0.055] text-[10px] font-bold text-[#a8cdbf]">{index + 1}</span><span className="text-sm font-semibold text-[#e5eee9]">{product.title}</span></td><td className="px-5 py-4 text-sm text-[#9ba8a1]">{product.store_name}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#dae5df]">{number(product.units)}</td><td className="px-5 py-4 text-sm font-semibold tabular-nums text-[#edf4f0]">{formatAed(product.revenue)}</td><td className={`px-5 py-4 text-sm font-semibold tabular-nums ${product.stock !== null && product.stock <= 5 ? "text-[#e7bc80]" : "text-[#dae5df]"}`}>{product.stock === null ? "—" : number(product.stock)}</td></tr>)}{products.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-[#7d8982]">Product demand will appear once orders are placed.</td></tr> : null}</tbody></table></div></Panel>;
}

function FinanceView({ data }: { data: FounderData }) {
  const financeRows = [
    { label: "Product sales", value: data.finance.product_sales, detail: "Merchandise value before logistics fees" },
    { label: "Delivery fees", value: data.finance.delivery_fees, detail: "Charged to customers in this period" },
    { label: "Service fees", value: data.finance.service_fees, detail: "Platform service-fee total" },
    { label: "Small order fees", value: data.finance.small_order_fees, detail: "Orders below the AED 99 threshold" },
  ];
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><Panel><SectionTitle title="Revenue composition" detail={`All non-cancelled orders · last ${data.range_days} days`} /><div className="mt-6 space-y-3">{financeRows.map((row) => <div key={row.label} className="flex items-center justify-between gap-4 rounded-lg border border-white/7 bg-white/[0.025] p-3.5"><div><p className="text-sm font-medium text-[#dfe8e2]">{row.label}</p><p className="mt-1 text-xs text-[#7e8b84]">{row.detail}</p></div><p className="text-sm font-semibold tabular-nums text-[#eef5f1]">{formatAed(row.value)}</p></div>)}</div><div className="mt-5 flex items-center justify-between border-t border-white/8 pt-5"><span className="text-sm font-semibold text-[#dae5df]">Gross sales</span><span className="text-xl font-semibold tracking-[-0.04em] text-[#ecf5ef]">{formatAed(data.finance.gross_sales)}</span></div></Panel><Panel><SectionTitle title="Payment readiness" detail="A view of payment status across current orders." /><div className="mt-6 grid grid-cols-2 gap-3"><MetricCard label="Paid" value={number(data.finance.paid_orders)} detail="Verified payments" icon="check" tone="good" /><MetricCard label="Pending" value={number(data.finance.pending_orders)} detail="Awaiting provider" icon="clock" tone="warning" /></div><p className="mt-5 rounded-lg border border-white/7 bg-white/[0.025] px-3 py-3 text-xs leading-5 text-[#829087]">Payout and commission reporting can be added here when Morni’s payment-provider settlement data is connected.</p></Panel></div>;
}

function AlertsView({ alerts, onViewChange }: { alerts: FounderData["alerts"]; onViewChange: (view: FounderView) => void }) {
  const routeToView = (href: string): FounderView => href.includes("orders") ? "operations" : href.includes("catalogue") ? "catalogue" : "stores";
  return <Panel><SectionTitle title="Founder alerts" detail="Operational signals worth your attention right now." /><div className="mt-5 divide-y divide-white/7">{alerts.map((alert, index) => <button type="button" key={`${alert.title}-${index}`} onClick={() => onViewChange(routeToView(alert.href))} className="flex w-full items-start gap-3 px-1 py-4 text-left transition hover:bg-white/[0.025]"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.tone === "urgent" ? "bg-[#e97757]" : alert.tone === "warning" ? "bg-[#e8b764]" : "bg-[#75bda2]"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#e8f0eb]">{alert.title}</span><span className="mt-1 block text-sm leading-6 text-[#89968f]">{alert.detail}</span></span><PortalIcon name="arrow" className="mt-1 h-4 w-4 shrink-0 text-[#728078]" /></button>)}{alerts.length === 0 ? <div className="py-12 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-300"><PortalIcon name="check" /></span><p className="mt-3 text-sm font-semibold text-[#e5eee9]">Everything looks healthy</p><p className="mt-1 text-sm text-[#7f8c85]">No founder actions need attention at the moment.</p></div> : null}</div></Panel>;
}

function WorkspaceContent({ data, activeView, onViewChange }: { data: FounderData; activeView: FounderView; onViewChange: (view: FounderView) => void }) {
  if (activeView === "operations") return <OrderTable orders={data.recent_orders} />;
  if (activeView === "stores") return <StoresView stores={data.stores} />;
  if (activeView === "customers") return <CustomersView customers={data.customers} />;
  if (activeView === "catalogue") return <CatalogueView products={data.top_products} />;
  if (activeView === "finance") return <FinanceView data={data} />;
  if (activeView === "alerts") return <AlertsView alerts={data.alerts} onViewChange={onViewChange} />;
  return <Overview data={data} onViewChange={onViewChange} />;
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
      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else {
        setData(response as unknown as FounderData);
      }
      setLoadingData(false);
    });
    return () => { active = false; };
  }, [isAdmin, range, refreshKey]);

  function changeRange(days: 7 | 30) {
    if (days === range) return;
    setLoadingData(true);
    setError(null);
    setRange(days);
  }

  function refreshData() {
    setLoadingData(true);
    setError(null);
    setRefreshKey((value) => value + 1);
  }

  const viewHeading = useMemo(() => ({
    overview: ["Founder overview", "A calm, live read on how Morni is moving today."],
    operations: ["Operations", "Every recent order across the Morni marketplace."],
    stores: ["Store network", "The health and commercial activity of every boutique."],
    customers: ["Customers", "Relationships and value across the shopper community."],
    catalogue: ["Catalogue", "Demand-led product and inventory visibility."],
    finance: ["Finance", "Gross sales and marketplace fee composition."],
    alerts: ["Alerts", "The items that deserve a founder’s attention."],
  } satisfies Record<FounderView, [string, string]>)[activeView], [activeView]);

  if (authLoading) return <FounderLoading />;
  if (!auth) return <FounderAccess title="Sign in to open Founder" description="Use the Morni administrator account to access the company command centre." action="Sign in" href="/auth?next=/founder" />;
  if (!isAdmin) return <FounderAccess title="Founder access is restricted" description="This workspace is available only to Morni administrator accounts. Seller accounts continue to use the Seller Portal." action="Open Seller Portal" href="/portal" />;

  return <div className="min-h-screen bg-[#0f1412] text-[#f2f6f3]">
    <div className="min-h-screen bg-[radial-gradient(circle_at_78%_-10%,rgba(76,174,140,0.15),transparent_30rem),radial-gradient(circle_at_12%_0%,rgba(89,122,153,0.12),transparent_28rem)]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <FounderSidebar activeView={activeView} onViewChange={setActiveView} alertCount={data?.alerts.length ?? 0} />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0f1412]/90 backdrop-blur-xl">
            <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-9">
              <div className="mr-auto"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7d8b83]">Morni · Internal</p><p className="mt-0.5 text-sm font-semibold text-[#e6efe9]">{viewHeading[0]}</p></div>
              <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] p-1">{([7, 30] as const).map((days) => <button key={days} type="button" onClick={() => changeRange(days)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${range === days ? "bg-[#2f5549] text-[#e8fff4] shadow-sm" : "text-[#8b9891] hover:text-[#d9e5df]"}`}>Last {days}d</button>)}</div>
              <button type="button" onClick={refreshData} className="grid h-8 w-8 place-items-center rounded-lg border border-white/8 bg-white/[0.03] text-[#a8b6af] transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white" aria-label="Refresh founder data"><PortalIcon name="refresh" className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} /></button>
              <span className="hidden rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-[#a8b6af] sm:inline">{auth.firstName}</span>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1550px] px-4 py-7 sm:px-6 lg:px-9 lg:py-9">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#f3f7f4] sm:text-[2.15rem]">{viewHeading[0]}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#87958d]">{viewHeading[1]}</p></div>{data ? <p className="text-xs text-[#718078]">Updated {dateTime(data.generated_at)} · Dubai time</p> : null}</div>
            {!data && !error ? <FounderLoading /> : null}
            {error ? <FounderError error={error} onRetry={refreshData} /> : null}
            {data ? <WorkspaceContent data={data} activeView={activeView} onViewChange={setActiveView} /> : null}
          </main>
        </div>
      </div>
    </div>
  </div>;
}

function FounderLoading() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className={`${index > 3 ? "h-52" : "h-32"} animate-pulse rounded-xl border border-white/7 bg-white/[0.035]`} />)}</div>;
}

function FounderAccess({ title, description, action, href }: { title: string; description: string; action: string; href: string }) {
  return <div className="grid min-h-screen place-items-center bg-[#0f1412] p-6 text-center"><div className="max-w-md rounded-2xl border border-white/9 bg-[#151b19] p-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><PortalIcon name="overview" className="h-5 w-5" /></span><h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#edf4ef]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#87958d]">{description}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#3f806b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4c967e]">{action}<PortalIcon name="arrow" className="h-4 w-4" /></Link></div></div>;
}

function FounderError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const migrationMissing = /founder_workspace_data|function/i.test(error);
  return <Panel><div className="flex flex-wrap items-start gap-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-400/10 text-rose-300"><PortalIcon name="warning" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-[#edf3ef]">{migrationMissing ? "Founder data is not connected yet" : "Founder data could not be loaded"}</h2><p className="mt-1 text-sm leading-6 text-[#8b9891]">{migrationMissing ? "Apply the Founder Workspace Supabase migration to enable the secure analytics endpoint, then refresh this page." : error}</p></div><button type="button" onClick={onRetry} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3dc] hover:bg-white/[0.05]">Try again</button></div></Panel>;
}
