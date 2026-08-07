"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";
import { getOnboardingChecklist } from "@/lib/onboarding";
import { formatAed, orderStatusLabel } from "@/lib/format";
import type { Order, Product, ProductReview } from "@/lib/types";

export default function PortalOrdersPage() {
  const { store, loading, error, refresh, resumeStep } = useOwnerStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistRows, setWishlistRows] = useState<
    { product_id: string; count: number; title: string }[]
  >([]);
  const [reviewSummary, setReviewSummary] = useState({
    avgRating: 0,
    total: 0,
    recent: [] as ProductReview[],
  });
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    (async () => {
      const [ordersRes, productsRes, wishRes, reviewsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("store_id", store.id)
          .order("placed_at", { ascending: false }),
        supabase.from("products").select("*").eq("store_id", store.id),
        supabase
          .from("wishlist_items")
          .select("product_id, products!inner(store_id, title)")
          .eq("products.store_id", store.id),
        supabase
          .from("product_reviews")
          .select("*")
          .eq("store_id", store.id)
          .order("created_at", { ascending: false }),
      ]);

      const nextOrders = (ordersRes.data as Order[]) ?? [];
      const nextProducts = (productsRes.data as Product[]) ?? [];
      const nextReviews = (reviewsRes.data as ProductReview[]) ?? [];
      setOrders(nextOrders);
      setProducts(nextProducts);
      setReviewSummary({
        avgRating:
          nextReviews.length > 0
            ? Number(
                (
                  nextReviews.reduce((sum, review) => sum + review.rating, 0) /
                  nextReviews.length
                ).toFixed(1),
              )
            : 0,
        total: nextReviews.length,
        recent: nextReviews.slice(0, 5),
      });

      const likes = ((wishRes.data as {
        product_id: string;
        products: { store_id: string; title: string }[];
      }[]) ?? []).reduce(
        (acc, row) => {
          const key = row.product_id;
          const title = row.products?.[0]?.title ?? "Unknown product";
          if (!acc[key]) {
            acc[key] = { product_id: key, count: 0, title };
          }
          acc[key].count += 1;
          return acc;
        },
        {} as Record<string, { product_id: string; count: number; title: string }>,
      );
      setWishlistRows(
        Object.values(likes)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      );

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);
      setTodayRevenue(
        nextOrders
          .filter((o) => new Date(o.placed_at) >= startOfToday)
          .reduce((sum, o) => sum + Number(o.total_aed), 0),
      );
      setWeekRevenue(
        nextOrders
          .filter((o) => new Date(o.placed_at) >= startOfWeek)
          .reduce((sum, o) => sum + Number(o.total_aed), 0),
      );
    })();
  }, [store]);

  const checklist = useMemo(
    () => getOnboardingChecklist(store, products),
    [store, products],
  );
  const incomplete = Boolean(store && !isOnboardingComplete(store));

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

  if (loading) return <p className="text-muted">Loading dashboard…</p>;

  if (!store) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="font-display text-3xl text-ink">Finish store setup</h1>
        <p className="text-sm text-muted">
          You don’t have a store linked yet. Continue the seller onboarding to create
          one, then come back to manage orders here.
        </p>
        <Link
          href="/sell/setup"
          className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-white"
        >
          Continue setup
        </Link>
        <Link href="/sell" className="ml-3 text-sm text-accent-deep underline">
          About selling on Morni
        </Link>
      </div>
    );
  }

  const pending = orders.filter((o) =>
    ["placed", "accepted", "picking", "out_for_delivery"].includes(o.status),
  ).length;
  const lowStock = products.filter((p) => p.stock <= 5).length;
  const unavailable = products.filter((p) => !p.is_available).length;

  const recent = orders.slice(0, 6);
  const setupHref = `/sell/setup`;

  return (
    <div className="space-y-8">
      {incomplete ? (
        <section className="rounded-[1.5rem] border border-accent/30 bg-[#fff0f4] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">
                Setup in progress · step {resumeStep} of 4
              </p>
              <h2 className="mt-1 font-display text-2xl text-ink">
                Your store is still hidden
              </h2>
              <p className="mt-2 text-sm text-muted">
                Finish branding and add one complete product before shoppers can find
                {store.name}.
              </p>
            </div>
            <Link
              href={setupHref}
              className="rounded-full bg-ink px-5 py-2.5 text-sm text-white"
            >
              Continue setup
            </Link>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    item.done ? "bg-[#e8f5ef] text-mint" : "bg-sand text-muted"
                  }`}
                >
                  {item.done ? "✓" : "·"}
                </span>
                <span className={item.done ? "text-muted line-through" : "text-ink"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Welcome back, {store.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {incomplete || !store.is_active ? (
            <Link
              href={setupHref}
              className="rounded-full bg-ink px-4 py-2 text-sm text-white transition hover:bg-accent-deep"
            >
              Preview setup
            </Link>
          ) : (
            <Link
              href={`/stores/${store.slug}`}
              className="rounded-full bg-ink px-4 py-2 text-sm text-white transition hover:bg-accent-deep"
            >
              View my store page
            </Link>
          )}
          <Link
            href="/"
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink transition hover:bg-white"
          >
            Browse as shopper
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending orders" value={String(pending)} />
        <StatCard label="Today revenue" value={formatAed(todayRevenue)} />
        <StatCard label="7-day revenue" value={formatAed(weekRevenue)} />
        <StatCard label="Low stock items" value={String(lowStock)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Recent orders</h2>
            <Link href="/portal/orders" className="text-xs text-accent-deep underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">No recent orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{order.order_number}</p>
                    <p className="text-xs text-muted">
                      {orderStatusLabel(order.status)} · {order.delivery_area}
                    </p>
                  </div>
                  <p className="text-sm text-ink">{formatAed(order.total_aed)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl text-ink">Catalog health</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">Total products</span>
              <span>{products.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Hidden products</span>
              <span>{unavailable}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Low stock (≤5)</span>
              <span>{lowStock}</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => refresh()}
            className="mt-4 rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Refresh dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl text-ink">Most wishlisted</h2>
          {wishlistRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No wishlist data yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {wishlistRows.map((row) => (
                <li
                  key={row.product_id}
                  className="flex items-center justify-between rounded-xl border border-line/70 px-3 py-2"
                >
                  <p className="text-sm text-ink">{row.title}</p>
                  <p className="text-xs text-muted">{row.count} hearts</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Recent reviews</h2>
            <Link href="/portal/reviews" className="text-xs text-accent-deep underline">
              View all
            </Link>
          </div>
          {reviewSummary.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No reviews yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reviewSummary.recent.map((review) => (
                <li
                  key={review.id}
                  className="rounded-xl border border-line/70 px-3 py-2"
                >
                  <p className="text-sm font-medium text-ink">
                    {review.rating} ★ · {review.shopper_name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {review.body ?? "No written comment"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
