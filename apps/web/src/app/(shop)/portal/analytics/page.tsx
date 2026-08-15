"use client";

import { useEffect, useMemo, useState } from "react";
import { PortalEmpty, PortalMetric, PortalPageHeader, PortalSectionHeading } from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { formatAed } from "@/lib/format";
import { useOwnerStore } from "@/lib/use-owner-store";
import type { Order, OrderItem, Product } from "@/lib/types";

type OrderWithItems = Order & { order_items?: OrderItem[] | null };

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function PortalAnalyticsPage() {
  const { store, loading, error } = useOwnerStore();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    void Promise.all([
      supabase.from("orders").select("*, order_items(*)").eq("store_id", store.id).order("placed_at", { ascending: false }),
      supabase.from("products").select("*").eq("store_id", store.id),
    ]).then(([ordersResult, productsResult]) => {
      setOrders((ordersResult.data as OrderWithItems[]) ?? []);
      setProducts((productsResult.data as Product[]) ?? []);
    });
  }, [store]);

  const report = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (range - 1));
    const periodOrders = orders.filter((order) => order.status !== "cancelled" && new Date(order.placed_at) >= start);
    const allCompleted = orders.filter((order) => order.status !== "cancelled");
    const salesByDay = Array.from({ length: range }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const matching = periodOrders.filter((order) => dayKey(new Date(order.placed_at)) === dayKey(date));
      return {
        key: dayKey(date),
        label: range === 7 ? date.toLocaleDateString("en-AE", { weekday: "short" }) : date.toLocaleDateString("en-AE", { day: "numeric", month: "short" }),
        revenue: matching.reduce((sum, order) => sum + Number(order.total_aed), 0),
        orders: matching.length,
      };
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const productSales = new Map<string, { id: string; title: string; units: number; revenue: number }>();
    for (const order of periodOrders) {
      for (const item of order.order_items ?? []) {
        const key = item.product_id ?? item.title;
        const row = productSales.get(key) ?? { id: key, title: productsById.get(item.product_id ?? "")?.title ?? item.title, units: 0, revenue: 0 };
        row.units += item.quantity;
        row.revenue += Number(item.line_total_aed);
        productSales.set(key, row);
      }
    }
    const maxRevenue = Math.max(...salesByDay.map((day) => day.revenue), 1);
    const totalRevenue = periodOrders.reduce((sum, order) => sum + Number(order.total_aed), 0);
    const unitsSold = Array.from(productSales.values()).reduce((sum, product) => sum + product.units, 0);
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: periodOrders.filter((order) => new Date(order.placed_at).getHours() === hour).length })).filter((slot) => slot.count > 0).sort((a, b) => b.count - a.count).slice(0, 4);
    return {
      totalRevenue,
      orderCount: periodOrders.length,
      averageOrder: periodOrders.length ? totalRevenue / periodOrders.length : 0,
      unitsSold,
      salesByDay,
      maxRevenue,
      topProducts: Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
      hourly,
      delivered: allCompleted.filter((order) => order.status === "delivered").length,
      lowStock: products.filter((product) => product.stock <= 5).length,
    };
  }, [orders, products, range]);

  if (error === "unauthenticated") return <PortalEmpty icon="analytics" title="Sign in to see store analytics" description="Use the owner account linked to your Morni store." action={{ label: "Sign in", href: "/auth?next=/portal/analytics" }} />;
  if (loading) return <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/65" />)}</div>;
  if (!store) return <PortalEmpty icon="store" title="Set up a store to see analytics" description="Sales, product demand, and fulfilment trends become available as you receive orders." action={{ label: "Start store setup", href: "/sell/setup" }} />;

  return <div className="space-y-6">
    <PortalPageHeader eyebrow="Performance" title="Sales analytics" description="An accurate view of order revenue and product demand, calculated from your order items.">
      <div className="flex rounded-lg border border-[#dce5e0] bg-white p-1">{([7, 30] as const).map((value) => <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${range === value ? "bg-[#21342e] text-white" : "text-[#66736e] hover:text-[#2f6f66]"}`}>Last {value} days</button>)}</div>
    </PortalPageHeader>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PortalMetric label="Gross sales" value={formatAed(report.totalRevenue)} detail={`Last ${range} days · excludes cancelled`} icon="analytics" /><PortalMetric label="Orders" value={String(report.orderCount)} detail={`${report.delivered} delivered all time`} icon="orders" /><PortalMetric label="Average order" value={formatAed(report.averageOrder)} detail="Across active orders" icon="sparkle" /><PortalMetric label="Items sold" value={String(report.unitsSold)} detail={`${report.lowStock} low-stock catalog items`} icon="products" tone={report.lowStock ? "urgent" : "default"} /></div>
    <section className="portal-card p-5"><PortalSectionHeading title={`Daily sales · last ${range} days`} description="Gross order value for each day." /><div className="mt-8 flex h-56 items-end gap-1.5 overflow-hidden sm:gap-2">{report.salesByDay.map((day) => <div key={day.key} className="group flex min-w-0 flex-1 flex-col items-center gap-2"><span className="h-5 whitespace-nowrap text-[10px] font-semibold text-[#466058] opacity-0 transition group-hover:opacity-100">{day.revenue ? formatAed(day.revenue) : ""}</span><div className="relative flex h-40 w-full items-end rounded-t-md bg-[#edf3f0]"><div className="w-full rounded-t-md bg-[#5b9183] transition-all" style={{ height: `${Math.max(day.revenue ? (day.revenue / report.maxRevenue) * 100 : 2, 2)}%` }} /></div><span className={`w-full truncate text-center text-[10px] font-semibold text-[#7b8882] ${range === 30 ? "hidden sm:block" : ""}`}>{day.label}</span></div>)}</div><div className="mt-4 flex items-center justify-between border-t border-[#edf1ef] pt-3 text-xs text-[#7b8882]"><span>Hover a bar to see sales value.</span><span>{report.orderCount} non-cancelled orders in this period</span></div></section>
    <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]"><div className="portal-card overflow-hidden"><div className="p-5"><PortalSectionHeading title="Top products" description="Ranked by actual order-item sales in the selected period." /></div>{report.topProducts.length ? <div className="overflow-x-auto"><table className="portal-table w-full min-w-[530px]"><thead className="bg-[#fbfdfc]"><tr><th className="px-5 py-3">Product</th><th className="px-4 py-3 text-right">Units sold</th><th className="px-5 py-3 text-right">Product sales</th></tr></thead><tbody>{report.topProducts.map((product, index) => <tr key={product.id}><td className="px-5 py-4"><span className="mr-3 inline-grid h-6 w-6 place-items-center rounded-md bg-[#edf3f0] text-[10px] font-bold text-[#3c685c]">{index + 1}</span><span className="text-sm font-semibold text-[#34423d]">{product.title}</span></td><td className="px-4 py-4 text-right text-sm text-[#5b6a64]">{product.units}</td><td className="px-5 py-4 text-right text-sm font-semibold text-[#263530]">{formatAed(product.revenue)}</td></tr>)}</tbody></table></div> : <div className="px-5 pb-5"><PortalEmpty icon="products" title="No product sales yet" description="Product demand will appear as soon as shoppers complete orders." /></div>}</div>
      <div className="portal-card p-5"><PortalSectionHeading title="When shoppers order" description="The busiest order hours in this period." />{report.hourly.length ? <ol className="mt-5 space-y-4">{report.hourly.map((slot, index) => <li key={slot.hour} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf3f0] text-xs font-bold text-[#3c685c]">{index + 1}</span><span className="flex-1 text-sm font-medium text-[#34423d]">{String(slot.hour).padStart(2, "0")}:00 – {String((slot.hour + 1) % 24).padStart(2, "0")}:00</span><span className="text-xs font-semibold text-[#66736e]">{slot.count} order{slot.count === 1 ? "" : "s"}</span></li>)}</ol> : <p className="mt-5 text-sm leading-6 text-[#7b8882]">Your peak ordering periods will appear here once you receive orders.</p>}</div></section>
  </div>;
}
