"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PortalIcon } from "@/components/portal-icons";
import {
  PortalEmpty,
  PortalMetric,
  PortalPageHeader,
  PortalSectionHeading,
  StatusBadge,
} from "@/components/portal-ui";
import { createClient, createRealtimeChannelName } from "@/lib/supabase/client";
import { formatAed } from "@/lib/format";
import { getOnboardingChecklist } from "@/lib/onboarding";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";
import type { Order, OrderItem, Product, ProductReview, Store } from "@/lib/types";
import { InventoryNotifications } from "@/components/inventory-notifications";
import { ReturnRequestsPanel } from "@/components/return-requests-panel";

// Dashboard thumbnails are user-uploaded Supabase media URLs.
/* eslint-disable @next/next/no-img-element */

type OrderWithItems = Order & { order_items?: OrderItem[] | null };
type WishRow = { product_id: string; count: number; title: string };

const ACTIVE_STATUSES = new Set(["placed", "accepted", "picking", "out_for_delivery"]);
type DashboardTrend = { value: string; direction: "up" | "down" | "neutral"; label: string } | null;

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Date(value).toLocaleDateString("en-AE", { day: "numeric", month: "short" });
}

export default function PortalOverviewPage() {
  const { store, loading, error, refresh } = useOwnerStore();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [wishlistRows, setWishlistRows] = useState<WishRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const productIdsRef = useRef<Set<string>>(new Set());

  const loadDashboard = useCallback(async (storeId: string) => {
    const supabase = createClient();
    const [ordersResult, productsResult, reviewsResult, wishlistResult] = await Promise.all([
      supabase.from("orders").select("*, order_items(*)").eq("store_id", storeId).order("placed_at", { ascending: false }),
      supabase.from("products").select("*").eq("store_id", storeId),
      supabase.from("product_reviews").select("*").eq("store_id", storeId).order("created_at", { ascending: false }),
      supabase.from("wishlist_items").select("product_id, products!inner(store_id, title)").eq("products.store_id", storeId),
    ]);

    setOrders((ordersResult.data as OrderWithItems[]) ?? []);
    setProducts((productsResult.data as Product[]) ?? []);
    setReviews((reviewsResult.data as ProductReview[]) ?? []);

    const counts = ((wishlistResult.data ?? []) as { product_id: string; products: { title: string }[] }[]).reduce<Record<string, WishRow>>((acc, row) => {
      const item = acc[row.product_id] ?? { product_id: row.product_id, count: 0, title: row.products?.[0]?.title ?? "Product" };
      item.count += 1;
      acc[row.product_id] = item;
      return acc;
    }, {});
    setWishlistRows(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 4));
  }, []);

  useEffect(() => {
    if (!store) return;
    let active = true;
    const load = () => {
      if (active) void loadDashboard(store.id);
    };
    if (typeof queueMicrotask === "function") queueMicrotask(load);
    else window.setTimeout(load, 0);

    const supabase = createClient();
    const channel = supabase
      .channel(createRealtimeChannelName("portal-overview", store.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `store_id=eq.${store.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_reviews", filter: `store_id=eq.${store.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist_items" }, (payload) => {
        const row = (payload.new as { product_id?: string })?.product_id ? payload.new as { product_id: string } : payload.old as { product_id?: string };
        if (row.product_id && productIdsRef.current.has(row.product_id)) load();
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadDashboard, store]);

  useEffect(() => {
    productIdsRef.current = new Set(products.map((product) => product.id));
  }, [products]);

  const insights = useMemo(() => {
    const activeOrders = orders.filter((order) => order.status !== "cancelled");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousDay = new Date(today);
    previousDay.setDate(previousDay.getDate() - 1);
    const todayOrders = activeOrders.filter((order) => new Date(order.placed_at) >= today);
    const weekOrders = activeOrders.filter((order) => new Date(order.placed_at) >= weekStart);
    const previousWeekOrders = activeOrders.filter((order) => {
      const placedAt = new Date(order.placed_at);
      return placedAt >= previousWeekStart && placedAt < weekStart;
    });
    const previousDayOrders = activeOrders.filter((order) => {
      const placedAt = new Date(order.placed_at);
      return placedAt >= previousDay && placedAt < today;
    });
    const productSales = new Map<string, { productId: string | null; title: string; units: number; revenue: number }>();

    for (const order of activeOrders) {
      for (const item of order.order_items ?? []) {
        const key = item.product_id ?? item.title;
        const row = productSales.get(key) ?? { productId: item.product_id ?? null, title: item.title, units: 0, revenue: 0 };
        row.units += item.quantity;
        row.revenue += Number(item.line_total_aed);
        productSales.set(key, row);
      }
    }

    const salesDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const revenue = weekOrders
        .filter((order) => dayKey(new Date(order.placed_at)) === dayKey(date))
        .reduce((sum, order) => sum + Number(order.total_aed), 0);
      return { label: date.toLocaleDateString("en-AE", { weekday: "short" }), revenue };
    });

    return {
      activeOrders: orders.filter((order) => ACTIVE_STATUSES.has(order.status)),
      newOrders: orders.filter((order) => order.status === "placed"),
      lowStock: products.filter((product) => product.stock <= 5 || Object.values(product.size_stock ?? {}).some((quantity) => quantity <= 5)),
      unreplied: reviews.filter((review) => !review.owner_reply?.trim()),
      todayRevenue: todayOrders.reduce((sum, order) => sum + Number(order.total_aed), 0),
      weekRevenue: weekOrders.reduce((sum, order) => sum + Number(order.total_aed), 0),
      averageOrder: activeOrders.length ? activeOrders.reduce((sum, order) => sum + Number(order.total_aed), 0) / activeOrders.length : 0,
      previousDayRevenue: previousDayOrders.reduce((sum, order) => sum + Number(order.total_aed), 0),
      previousWeekRevenue: previousWeekOrders.reduce((sum, order) => sum + Number(order.total_aed), 0),
      topProducts: Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 4).map((product) => ({
        ...product,
        imageUrl: products.find((candidate) => candidate.id === product.productId)?.image_urls?.[0] ?? null,
      })),
      salesDays,
      maxRevenue: Math.max(...salesDays.map((day) => day.revenue), 1),
    };
  }, [orders, products, reviews]);

  const checklist = useMemo(() => getOnboardingChecklist(store, products), [products, store]);
  const setupComplete = isOnboardingComplete(store);

  async function handleRefresh() {
    if (!store) return;
    setRefreshing(true);
    await Promise.all([loadDashboard(store.id), refresh()]);
    setRefreshing(false);
  }

  if (error === "unauthenticated") {
    return <PortalEmpty icon="store" title="Sign in to open your seller workspace" description="Use the owner account linked to your Morni store." action={{ label: "Sign in", href: "/auth?next=/portal" }} />;
  }
  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white/65" />)}</div>;
  }
  if (!store) {
    return <PortalEmpty icon="store" title="Set up your first store" description="Add your details, then use this workspace to run your catalog and orders." action={{ label: "Start store setup", href: "/sell/setup" }} />;
  }

  return (
    <div className="space-y-7">
      <ReturnRequestsPanel storeId={store.id} />
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="portal-eyebrow">Store overview</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.04em] text-[#1d2925]">Overview</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={handleRefresh} disabled={refreshing} aria-label="Refresh dashboard" className="portal-button-secondary h-10 w-10 justify-center p-0 disabled:opacity-55">
              <PortalIcon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <Link href={setupComplete && store.is_active ? `/stores/${store.slug}` : "/portal/settings"} className="portal-button-primary h-10 px-3 text-xs">
              {setupComplete && store.is_active ? "Store" : "Setup"}<PortalIcon name="external" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <MobileOverview
          store={store}
          setupComplete={setupComplete}
          checklist={checklist}
          insights={insights}
          products={products}
          reviews={reviews}
          orders={orders}
          wishlistRows={wishlistRows}
        />
      </div>

      <div className="hidden space-y-7 lg:block">
        <PortalPageHeader
          eyebrow="Store overview"
          title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${store.name}`}
          description="Start with the work that keeps your shoppers happy and your store growing."
        >
          <button type="button" onClick={handleRefresh} disabled={refreshing} className="portal-button-secondary disabled:opacity-55"><PortalIcon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing" : "Refresh"}</button>
          <Link href={setupComplete && store.is_active ? `/stores/${store.slug}` : "/portal/settings"} className="portal-button-primary">{setupComplete && store.is_active ? "View storefront" : "Finish setup"}<PortalIcon name="external" className="h-3.5 w-3.5" /></Link>
      </PortalPageHeader>

      {!setupComplete || !store.is_active ? <LaunchCard storeActive={store.is_active} complete={setupComplete} checklist={checklist} /> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardReveal delay={0}><PortalMetric label="Sales today" value={formatAed(insights.todayRevenue)} detail="No prior-day comparison yet" trend={percentageTrend(insights.todayRevenue, insights.previousDayRevenue, "vs yesterday")} sparkline={insights.salesDays.slice(-3).map((day) => day.revenue)} icon="analytics" /></DashboardReveal>
          <DashboardReveal delay={0.04}><PortalMetric label="Sales, 7 days" value={formatAed(insights.weekRevenue)} detail="No prior-week comparison yet" trend={percentageTrend(insights.weekRevenue, insights.previousWeekRevenue, "vs previous week")} sparkline={insights.salesDays.map((day) => day.revenue)} icon="orders" /></DashboardReveal>
          <DashboardReveal delay={0.08}><PortalMetric label="Orders to fulfil" value={String(insights.activeOrders.length)} detail={insights.newOrders.length ? `${insights.newOrders.length} new order${insights.newOrders.length === 1 ? "" : "s"} awaiting review` : "Your order queue is up to date"} icon="package" tone={insights.newOrders.length ? "urgent" : "default"} /></DashboardReveal>
          <DashboardReveal delay={0.12}><PortalMetric label="Catalogue health" value={`${products.length} products`} detail={insights.lowStock.length ? `${insights.lowStock.length} low stock · ${products.filter((product) => !product.is_available).length} hidden` : `${products.filter((product) => product.is_available).length} ready to sell`} icon="products" tone={insights.lowStock.length ? "urgent" : "success"} /></DashboardReveal>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.9fr)]">
          <DashboardReveal delay={0.16}><SalesChart days={insights.salesDays} maxRevenue={insights.maxRevenue} weekRevenue={insights.weekRevenue} trend={percentageTrend(insights.weekRevenue, insights.previousWeekRevenue, "vs previous week")} /></DashboardReveal>
          <div className="space-y-5">
            <DashboardReveal delay={0.2}><section className="portal-card p-5">
              <div className="flex items-end justify-between gap-4 border-b border-[#e8eeeb] pb-4">
                <div><p className="portal-eyebrow">Action centre</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1d2925]">Keep your store moving</h2></div>
                <Link href="/portal/orders" className="portal-text-link">Open orders<PortalIcon name="arrow" className="h-3.5 w-3.5" /></Link>
              </div>
              <div className="mt-1 divide-y divide-[#edf1ef]">
                <PriorityRow icon="orders" title={`${insights.newOrders.length} new order${insights.newOrders.length === 1 ? "" : "s"}`} description={insights.newOrders.length ? "Ready to accept and prepare" : "No new orders right now"} href="/portal/orders" urgent={Boolean(insights.newOrders.length)} />
                <PriorityRow icon="package" title={`${insights.activeOrders.length} in fulfilment`} description={insights.activeOrders.length ? "Keep these orders moving" : "Nothing is being prepared"} href="/portal/orders" />
                <PriorityRow icon="warning" title={`${insights.lowStock.length} low-stock item${insights.lowStock.length === 1 ? "" : "s"}`} description={insights.lowStock.length ? "Update stock before they sell out" : "Inventory is looking healthy"} href="/portal/products" urgent={Boolean(insights.lowStock.length)} />
                <PriorityRow icon="reviews" title={`${insights.unreplied.length} review${insights.unreplied.length === 1 ? "" : "s"} to reply to`} description={insights.unreplied.length ? "Build confidence with a prompt reply" : "All reviews are answered"} href="/portal/reviews" />
              </div>
            </section></DashboardReveal>
            <DashboardReveal delay={0.24}><StoreHealth store={store} complete={setupComplete} checklistComplete={checklist.filter((item) => item.done).length} reviews={reviews.length} productCount={products.length} lowStockCount={insights.lowStock.length} /></DashboardReveal>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.9fr)]">
          <DashboardReveal delay={0.28}><OrdersToFulfil orders={orders} /></DashboardReveal>
          <DashboardReveal delay={0.32}><ProductDemand products={insights.topProducts} wishlistRows={wishlistRows} /></DashboardReveal>
        </section>

        <DashboardReveal delay={0.36}><InventoryNotifications storeId={store.id} /></DashboardReveal>
      </div>
    </div>
  );
}

function MobileOverview({
  store,
  setupComplete,
  checklist,
  insights,
  products,
  reviews,
  orders,
  wishlistRows,
}: {
  store: Store;
  setupComplete: boolean;
  checklist: ReturnType<typeof getOnboardingChecklist>;
  insights: {
    activeOrders: OrderWithItems[];
    newOrders: OrderWithItems[];
    lowStock: Product[];
    unreplied: ProductReview[];
    todayRevenue: number;
    weekRevenue: number;
    averageOrder: number;
    topProducts: { title: string; units: number; revenue: number; imageUrl: string | null }[];
    salesDays: { label: string; revenue: number }[];
    maxRevenue: number;
  };
  products: Product[];
  reviews: ProductReview[];
  orders: OrderWithItems[];
  wishlistRows: WishRow[];
}) {
  const attentionCount = insights.newOrders.length + insights.lowStock.length + insights.unreplied.length;
  const checklistComplete = checklist.filter((item) => item.done).length;

  return (
    <div className="space-y-4">
      {!setupComplete || !store.is_active ? <MobileLaunchCard storeActive={store.is_active} complete={setupComplete} /> : null}

      <section className="overflow-hidden rounded-2xl bg-[#21342e] text-white shadow-[0_18px_40px_-28px_rgba(33,52,46,0.75)]">
        <div className="flex items-start justify-between gap-3 px-4 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fc4b8]">Today at a glance</p>
            <h2 className="mt-1 truncate text-xl font-bold tracking-[-0.03em]">{store.name}</h2>
            <p className="mt-1 text-xs text-[#c5d8d1]">{insights.activeOrders.length ? `${insights.activeOrders.length} order${insights.activeOrders.length === 1 ? "" : "s"} moving through fulfilment` : "Your order queue is clear"}</p>
          </div>
          <StatusBadge status={store.is_active ? "live" : "paused"} />
        </div>
        <div className="grid grid-cols-2 border-t border-white/10">
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9fc4b8]">Sales today</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatAed(insights.todayRevenue)}</p>
          </div>
          <div className="border-l border-white/10 px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9fc4b8]">Active orders</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{insights.activeOrders.length}</p>
          </div>
        </div>
      </section>

      <section className="portal-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="portal-eyebrow">Priority queue</p>
            <h2 className="mt-1 text-base font-semibold text-[#1d2925]">What needs attention</h2>
          </div>
          {attentionCount ? <span className="rounded-full bg-[#fff1dc] px-2 py-1 text-[10px] font-bold text-[#9c5b05]">{attentionCount} to review</span> : null}
        </div>
        <div className="mt-3 divide-y divide-[#edf1ef]">
          <MobilePriorityRow icon="orders" title={`${insights.newOrders.length} new order${insights.newOrders.length === 1 ? "" : "s"}`} detail={insights.newOrders.length ? "Ready to accept and prepare" : "No new orders right now"} href="/portal/orders" urgent={Boolean(insights.newOrders.length)} />
          <MobilePriorityRow icon="package" title={`${insights.activeOrders.length} in fulfilment`} detail={insights.activeOrders.length ? "Keep these orders moving" : "Nothing is being prepared"} href="/portal/orders" />
          <MobilePriorityRow icon="warning" title={`${insights.lowStock.length} low-stock item${insights.lowStock.length === 1 ? "" : "s"}`} detail={insights.lowStock.length ? "Update stock before they sell out" : "Inventory is looking healthy"} href="/portal/products" urgent={Boolean(insights.lowStock.length)} />
          <MobilePriorityRow icon="reviews" title={`${insights.unreplied.length} review${insights.unreplied.length === 1 ? "" : "s"} to reply to`} detail={insights.unreplied.length ? "Build confidence with a prompt reply" : "All reviews are answered"} href="/portal/reviews" />
        </div>
      </section>

      <OrdersToFulfil orders={orders} limit={3} />

      <details className="portal-mobile-disclosure">
        <summary className="portal-card flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span><span className="portal-eyebrow block">Performance</span><span className="mt-1 block text-base font-semibold text-[#1d2925]">Sales and catalogue health</span></span>
          <PortalIcon name="chevronDown" className="h-4 w-4 shrink-0 text-[#687770]" />
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MobileMetric label="Sales, 7 days" value={formatAed(insights.weekRevenue)} />
          <MobileMetric label="Average order" value={formatAed(insights.averageOrder)} />
          <MobileMetric label="Products" value={String(products.length)} />
          <MobileMetric label="Hidden items" value={String(products.filter((product) => !product.is_available).length)} />
        </div>
        <div className="mt-3"><SalesChart days={insights.salesDays} maxRevenue={insights.maxRevenue} weekRevenue={insights.weekRevenue} trend={null} /></div>
      </details>

      <details className="portal-mobile-disclosure">
        <summary className="portal-card flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span><span className="portal-eyebrow block">Store health</span><span className="mt-1 block text-base font-semibold text-[#1d2925]">Storefront essentials</span></span>
          <PortalIcon name="chevronDown" className="h-4 w-4 shrink-0 text-[#687770]" />
        </summary>
        <div className="portal-card mt-3 space-y-3 p-4">
          <HealthRow label="Storefront" value={store.is_active ? "Live" : "Paused"} status={store.is_active ? "live" : "paused"} />
          <HealthRow label="Setup" value={setupComplete ? "Complete" : `${checklistComplete}/4 complete`} status={setupComplete ? "live" : "draft"} />
          <HealthRow label="Store hours" value={store.opens_at && store.closes_at ? `${store.opens_at.slice(0, 5)} - ${store.closes_at.slice(0, 5)}` : "Not set"} status={store.opens_at && store.closes_at ? "live" : "draft"} />
          <HealthRow label="Customer reviews" value={reviews.length ? `${reviews.length} received` : "No reviews yet"} status={reviews.length ? "live" : "draft"} />
        </div>
      </details>

      <details className="portal-mobile-disclosure">
        <summary className="portal-card flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span><span className="portal-eyebrow block">Product demand</span><span className="mt-1 block text-base font-semibold text-[#1d2925]">What shoppers want</span></span>
          <PortalIcon name="chevronDown" className="h-4 w-4 shrink-0 text-[#687770]" />
        </summary>
        <div className="mt-3"><ProductDemand products={insights.topProducts} wishlistRows={wishlistRows} /></div>
      </details>
    </div>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return <div className="portal-card p-3"><p className="portal-eyebrow">{label}</p><p className="mt-1 text-lg font-bold tabular-nums text-[#17231f]">{value}</p></div>;
}

function MobilePriorityRow({ icon, title, detail, href, urgent = false }: { icon: "orders" | "package" | "warning" | "reviews"; title: string; detail: string; href: string; urgent?: boolean }) {
  return <Link href={href} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${urgent ? "bg-[#ffead7] text-[#a6542e]" : "bg-[#e8efec] text-[#315f54]"}`}><PortalIcon name={icon} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#263530]">{title}</span><span className="mt-0.5 block truncate text-xs text-[#7b8882]">{detail}</span></span><PortalIcon name="arrow" className="h-4 w-4 shrink-0 text-[#9aa8a2]" /></Link>;
}

function MobileLaunchCard({ storeActive, complete }: { storeActive: boolean; complete: boolean }) {
  return <Link href="/portal/settings" className="flex items-center justify-between gap-3 rounded-2xl border border-[#bad7cd] bg-[#edf7f3] px-4 py-3.5"><span className="min-w-0"><span className="portal-eyebrow block text-[#438276]">Store launch</span><span className="mt-1 block truncate text-sm font-semibold text-[#1d2925]">{complete ? "Your store is paused" : "Finish your store setup"}</span></span><span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#2f6f66]">{complete && !storeActive ? "Turn on" : "Continue"}<PortalIcon name="arrow" className="h-3.5 w-3.5" /></span></Link>;
}

function LaunchCard({ storeActive, complete, checklist }: { storeActive: boolean; complete: boolean; checklist: ReturnType<typeof getOnboardingChecklist> }) {
  return <section className="rounded-2xl border border-[#d9ae9e] bg-[#f7e2d8] p-4 shadow-[0_12px_30px_-24px_rgba(127,65,45,0.55)] sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="portal-eyebrow text-[#9a5d4a]">Store launch</p><h2 className="mt-1 text-lg font-semibold text-[#1d2925]">{complete ? "Your storefront is paused" : "Your storefront is not live yet"}</h2><p className="mt-1 text-sm leading-6 text-[#6f5148]">{complete ? "Turn your store on whenever you are ready to receive new orders." : "Complete the remaining essentials so shoppers can discover your store."}</p></div><Link href="/portal/settings" className="portal-button-primary">{storeActive ? "Manage visibility" : "Complete setup"}<PortalIcon name="arrow" className="h-3.5 w-3.5" /></Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{checklist.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-[#40534d]"><span className={`grid h-5 w-5 place-items-center rounded-full ${item.done ? "bg-[#d7eee3] text-[#277044]" : "bg-[#f4e8cf] text-[#9c6a17]"}`}><PortalIcon name={item.done ? "check" : "clock"} className="h-3 w-3" /></span>{item.label}</div>)}</div></section>;
}

function AttentionCard({ icon, title, description, href, urgent = false }: { icon: "orders" | "package" | "warning" | "reviews"; title: string; description: string; href: string; urgent?: boolean }) {
  return <Link href={href} className={`portal-card portal-card-interactive group p-4 ${urgent ? "border-[#e4bda9] bg-[#fff9f4]" : ""}`}><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${urgent ? "bg-[#ffead7] text-[#a6542e]" : "bg-[#e8efec] text-[#315f54]"}`}><PortalIcon name={icon} /></span><PortalIcon name="arrow" className="h-4 w-4 text-[#7c8d86] transition group-hover:translate-x-0.5 group-hover:text-[#2f6f66]" /></div><p className="mt-4 text-sm font-bold text-[#1f302a]">{title}</p><p className="mt-1 text-xs leading-5 text-[#687770]">{description}</p></Link>;
}

function percentageTrend(current: number, previous: number, label: string): DashboardTrend {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0.05 ? "up" : change < -0.05 ? "down" : "neutral";
  return { value: `${Math.abs(change).toFixed(Math.abs(change) >= 10 ? 0 : 1)}%`, direction, label };
}

function PriorityRow({ icon, title, description, href, urgent = false }: { icon: "orders" | "package" | "warning" | "reviews"; title: string; description: string; href: string; urgent?: boolean }) {
  return <Link href={href} className="group flex items-center gap-3 py-3.5 transition first:pt-3 last:pb-1"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${urgent ? "bg-[#ffead7] text-[#a6542e]" : "bg-[#edf3f0] text-[#3c685c]"}`}><PortalIcon name={icon} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#263530]">{title}</span><span className="mt-0.5 block text-xs text-[#7b8882]">{description}</span></span><PortalIcon name="arrow" className="h-4 w-4 shrink-0 text-[#9aa8a2] transition group-hover:translate-x-1 group-hover:text-[#2f6f66]" /></Link>;
}

function DashboardReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

function SalesChart({ days, maxRevenue, weekRevenue, trend }: { days: { label: string; revenue: number }[]; maxRevenue: number; weekRevenue: number; trend: DashboardTrend }) {
  const reduceMotion = useReducedMotion();
  const gradientId = useId();
  const chartWidth = 620;
  const chartHeight = 188;
  const baseline = 156;
  const left = 16;
  const right = chartWidth - 16;
  const points = days.map((day, index) => {
    const x = days.length === 1 ? chartWidth / 2 : left + (index / (days.length - 1)) * (right - left);
    const y = baseline - (Math.max(day.revenue, 0) / maxRevenue) * 118;
    return { ...day, x, y };
  });
  const linePath = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const areaPath = points.length ? `${linePath} L ${points.at(-1)?.x ?? right} ${baseline} L ${points[0]?.x ?? left} ${baseline} Z` : "";

  return <section className="portal-card overflow-hidden p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="portal-eyebrow">Performance</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#17231f]">Sales performance</h2><p className="mt-1 text-xs leading-5 text-[#687770]">Gross order value, excluding cancelled orders.</p></div>
      <div className="text-right"><p className="text-lg font-bold tabular-nums tracking-[-0.035em] text-[#17231f]">{formatAed(weekRevenue)}</p>{trend ? <p className={`mt-1 text-[11px] font-semibold ${trend.direction === "up" ? "text-[#237a57]" : trend.direction === "down" ? "text-[#b14d42]" : "text-[#687770]"}`}>{trend.direction === "up" ? "↗" : trend.direction === "down" ? "↘" : "—"} {trend.value} <span className="font-medium text-[#687770]">{trend.label}</span></p> : <p className="mt-1 text-[11px] text-[#687770]">Last 7 days</p>}</div>
    </div>
    {weekRevenue > 0 ? <><div className="mt-6 overflow-hidden rounded-xl border border-[#edf1ef] bg-[linear-gradient(180deg,#fbfdfc_0%,#f4f8f6_100%)] px-2 pt-3"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-52 w-full" role="img" aria-label="Sales trend over the last seven days">{[38, 78, 118, 156].map((y) => <line key={y} x1={left} x2={right} y1={y} y2={y} stroke="#dce8e2" strokeDasharray="3 5" />)}<motion.path d={areaPath} fill={`url(#${gradientId})`} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} /><motion.path d={linePath} fill="none" stroke="#2f7869" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />{points.map((point, index) => <g key={point.label}><circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3.5} fill="#fff" stroke="#2f7869" strokeWidth="2.5" /><text x={point.x} y={176} textAnchor="middle" className="fill-[#70817a] text-[11px] font-semibold">{point.label}</text><title>{`${point.label}: ${formatAed(point.revenue)}`}</title></g>)}<defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8fc9b8" stopOpacity="0.48" /><stop offset="100%" stopColor="#8fc9b8" stopOpacity="0.03" /></linearGradient></defs></svg></div><div className="mt-3 grid grid-cols-7 gap-1">{days.map((day) => <div key={day.label} className="min-w-0 text-center text-[10px] font-semibold tabular-nums text-[#60756c]">{day.revenue ? formatAed(day.revenue) : "—"}</div>)}</div></> : <div className="mt-5 grid min-h-52 place-items-center rounded-xl border border-dashed border-[#d8e4de] bg-[#f8fbf9] px-6 text-center"><span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f1ec] text-[#3c685c] mx-auto"><PortalIcon name="analytics" className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold text-[#263530]">No sales recorded yet</p><p className="mt-1 text-xs leading-5 text-[#687770]">Your live sales trend will appear as soon as shoppers complete orders.</p></span></div>}
    <Link href="/portal/analytics" className="portal-text-link mt-4">Open analytics<PortalIcon name="arrow" className="h-3.5 w-3.5" /></Link>
  </section>;
}

function StoreHealth({ store, complete, checklistComplete, reviews, productCount, lowStockCount }: { store: { is_active: boolean; opens_at: string | null; closes_at: string | null }; complete: boolean; checklistComplete: number; reviews: number; productCount: number; lowStockCount: number }) {
  return <div className="portal-card p-5"><PortalSectionHeading title="Store health" description="Live checks from your storefront and catalogue." action={{ label: "Store settings", href: "/portal/settings" }} /><div className="mt-5 space-y-3"><HealthRow label="Storefront" value={store.is_active ? "Live" : "Paused"} status={store.is_active ? "live" : "paused"} /><HealthRow label="Setup" value={complete ? "Complete" : `${checklistComplete}/4 complete`} status={complete ? "live" : "draft"} /><HealthRow label="Store hours" value={store.opens_at && store.closes_at ? `${store.opens_at.slice(0, 5)} - ${store.closes_at.slice(0, 5)}` : "Not set"} status={store.opens_at && store.closes_at ? "live" : "draft"} /><HealthRow label="Catalogue" value={`${productCount} listed · ${lowStockCount} low stock`} status={lowStockCount ? "draft" : "live"} /><HealthRow label="Customer reviews" value={reviews ? `${reviews} received` : "No reviews yet"} status={reviews ? "live" : "draft"} /></div></div>;
}

function HealthRow({ label, value, status }: { label: string; value: string; status: "live" | "paused" | "draft" }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#edf1ef] pb-3 last:border-0 last:pb-0"><span><span className="block text-sm font-medium text-[#34423d]">{label}</span><span className="mt-0.5 block text-xs text-[#7b8882]">{value}</span></span><StatusBadge status={status} /></div>;
}

function OrdersToFulfil({ orders, limit = 5 }: { orders: OrderWithItems[]; limit?: number }) {
  return <div className="portal-card overflow-hidden"><div className="p-5"><PortalSectionHeading title="Orders to fulfil" description="Your latest orders, sorted by when they arrived." action={{ label: "View all orders", href: "/portal/orders" }} /></div>{orders.length ? <div className="divide-y divide-[#edf1ef]">{orders.slice(0, limit).map((order) => { const imageUrl = order.order_items?.[0]?.image_url; return <Link key={order.id} href="/portal/orders" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#f8faf9]"><div className="flex min-w-0 items-center gap-3"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#f0f5f2]">{imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[#4d766b]"><PortalIcon name="package" className="h-4 w-4" /></span>}</div><span><span className="block text-sm font-semibold text-[#263530]">{order.order_number}</span><span className="mt-0.5 block text-xs text-[#7b8882]">{order.delivery_area} - {relativeTime(order.placed_at)}</span></span></div><div className="flex items-center gap-3"><StatusBadge status={order.status} /><span className="text-sm font-semibold text-[#263530]">{formatAed(order.total_aed)}</span></div></Link>; })}</div> : <div className="px-5 pb-5"><PortalEmpty icon="orders" title="Your order queue is clear" description="New shopper orders will appear here the moment they are placed." /></div>}</div>;
}

function ProductDemand({ products, wishlistRows }: { products: { title: string; units: number; revenue: number; imageUrl: string | null }[]; wishlistRows: WishRow[] }) {
  return <div className="portal-card p-5"><PortalSectionHeading title="Product demand" description="What shoppers are buying and saving." action={{ label: "Manage products", href: "/portal/products" }} />{products.length || wishlistRows.length ? <div className="mt-4 space-y-3">{products.map((product, index) => <div key={product.title} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf3f0] text-xs font-bold text-[#3c685c]">{index + 1}</span><div className="h-11 w-9 shrink-0 overflow-hidden rounded-lg bg-[#edf3f0]">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#34423d]">{product.title}</span><span className="block text-xs text-[#7b8882]">{product.units} sold</span></span><span className="text-sm font-semibold text-[#263530]">{formatAed(product.revenue)}</span></div>)}{wishlistRows.length ? <div className="border-t border-[#edf1ef] pt-3"><p className="portal-eyebrow">Most saved</p>{wishlistRows.slice(0, 2).map((product) => <p key={product.product_id} className="mt-2 truncate text-xs text-[#5c6d66]"><span className="font-semibold text-[#34423d]">{product.title}</span> - {product.count} shopper save{product.count === 1 ? "" : "s"}</p>)}</div> : null}</div> : <p className="mt-5 text-sm leading-6 text-[#7b8882]">Once shoppers place orders or save items, you will see their favourites here.</p>}</div>;
}
