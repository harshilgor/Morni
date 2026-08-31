"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalIcon } from "@/components/portal-icons";
import { StatusBadge } from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";
import type { Product, ProductReview } from "@/lib/types";

type Activity = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "urgent" | "default";
};

export function PortalHeader() {
  const router = useRouter();
  const { store, stores, selectStore } = useOwnerStore();
  const [activityOpen, setActivityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    void Promise.all([
      supabase.from("orders").select("id, status").eq("store_id", store.id),
      supabase.from("products").select("id, stock, size_stock").eq("store_id", store.id),
      supabase
        .from("product_reviews")
        .select("id, owner_reply")
        .eq("store_id", store.id),
    ]).then(([ordersResult, productsResult, reviewsResult]) => {
      const orders = (ordersResult.data ?? []) as { id: string; status: string }[];
      const products = (productsResult.data ?? []) as Pick<Product, "id" | "stock" | "size_stock">[];
      const reviews = (reviewsResult.data ?? []) as Pick<ProductReview, "id" | "owner_reply">[];
      const next: Activity[] = [];
      const newOrders = orders.filter((order) => order.status === "placed").length;
      const lowStock = products.filter((product) => product.stock <= 5 || Object.values(product.size_stock ?? {}).some((quantity) => quantity <= 5)).length;
      const unanswered = reviews.filter((review) => !review.owner_reply?.trim()).length;
      if (newOrders) {
        next.push({
          id: "new-orders",
          title: `${newOrders} new order${newOrders === 1 ? "" : "s"}`,
          detail: "Ready for your acceptance",
          href: "/portal/orders",
          tone: "urgent",
        });
      }
      if (lowStock) {
        next.push({
          id: "low-stock",
          title: `${lowStock} low-stock item${lowStock === 1 ? "" : "s"}`,
          detail: "Keep your best sellers available",
          href: "/portal/products",
          tone: "urgent",
        });
      }
      if (unanswered) {
        next.push({
          id: "reviews",
          title: `${unanswered} review${unanswered === 1 ? "" : "s"} awaiting a reply`,
          detail: "A quick response builds shopper trust",
          href: "/portal/reviews",
          tone: "default",
        });
      }
      if (!isOnboardingComplete(store) || !store.is_active) {
        next.push({
          id: "store",
          title: "Store needs attention",
          detail: !isOnboardingComplete(store)
            ? "Complete setup to go live"
            : "Your store is currently paused",
          href: "/portal/settings",
          tone: "urgent",
        });
      }
      setActivities(next);
    });
  }, [store]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = search.trim();
    window.location.assign(`/portal/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth");
  }

  const liveStatus =
    store && isOnboardingComplete(store) && store.is_active
      ? "live"
      : store?.is_active
        ? "draft"
        : "paused";
  const storefrontHref =
    store && isOnboardingComplete(store) && store.is_active
      ? `/stores/${store.slug}`
      : "/sell/setup";

  return (
    <header className="sticky top-0 z-30 border-b border-[#c6d0cb] bg-white/95 shadow-[0_1px_2px_rgba(20,35,29,0.04)] backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-9">
        <Link
          href="/portal"
          className="mr-auto flex min-w-0 items-center gap-2 text-sm font-semibold text-[#1d2925] lg:hidden"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#21342e] font-display text-lg text-white">
            M
          </span>
          <span className="truncate">Morni Portal</span>
        </Link>
        {stores.length ? (
          <label className="hidden items-center gap-2 text-xs text-[#66736e] lg:flex">
            Store
            <select
              value={store?.id ?? ""}
              onChange={(event) => selectStore(event.target.value)}
              className="portal-select max-w-48 py-2 font-semibold text-[#263530]"
            >
              {stores.map((ownerStore) => (
                <option key={ownerStore.id} value={ownerStore.id}>
                  {ownerStore.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <form onSubmit={submitSearch} className="hidden max-w-md flex-1 lg:block">
          <label className="relative block">
            <PortalIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8882]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="portal-input w-full pl-9"
              placeholder="Search your catalog"
              aria-label="Search your catalog"
            />
          </label>
        </form>
        {store ? (
          <div className="hidden items-center gap-2 lg:flex">
            <StatusBadge status={liveStatus} />
            <span className="text-xs text-[#66736e]">
              {store.is_active ? "Storefront" : "Store status"}
            </span>
          </div>
        ) : null}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setActivityOpen((value) => !value);
            }}
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#aebdb6] bg-white text-[#3e514a] shadow-[0_1px_1px_rgba(20,35,29,0.04)] transition hover:border-[#82998f] hover:text-[#2f6f66]"
            aria-label="Open activity centre"
            aria-expanded={activityOpen}
          >
            <PortalIcon name="bell" />
            {activities.length ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d66b4a] px-1 text-[9px] font-bold text-white">
                {activities.length}
              </span>
            ) : null}
          </button>
          {activityOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#b9c6c0] bg-white p-3 shadow-[0_18px_45px_-22px_rgba(27,48,39,0.35)]">
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-sm font-semibold text-[#1d2925]">Store activity</p>
                <span className="text-xs text-[#7b8882]">
                  {activities.length ? "Needs attention" : "All caught up"}
                </span>
              </div>
              {activities.length ? (
                <ul className="space-y-1">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <Link
                        href={activity.href}
                        onClick={() => setActivityOpen(false)}
                        className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-[#f5f8f6]"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full ${
                            activity.tone === "urgent" ? "bg-[#d66b4a]" : "bg-[#79a79b]"
                          }`}
                        />
                        <span>
                          <span className="block text-sm font-medium text-[#263530]">
                            {activity.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-[#7b8882]">
                            {activity.detail}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-2 py-7 text-center text-sm text-[#66736e]">
                  No urgent actions right now.
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="relative lg:hidden">
          <button
            type="button"
            onClick={() => {
              setActivityOpen(false);
              setMenuOpen((open) => !open);
            }}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#aebdb6] bg-white text-[#3e514a]"
            aria-label="Open account menu"
            aria-expanded={menuOpen}
          >
            <PortalIcon name="more" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-56 overflow-hidden rounded-xl border border-[#b9c6c0] bg-white py-1 shadow-[0_18px_45px_-22px_rgba(27,48,39,0.35)]">
              {stores.length > 1 ? (
                <div className="border-b border-[#e2e7e4] px-3 py-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7b8882]">
                    Store
                    <select
                      value={store?.id ?? ""}
                      onChange={(event) => selectStore(event.target.value)}
                      className="portal-select mt-1 w-full py-2 font-semibold text-[#263530]"
                    >
                      {stores.map((ownerStore) => (
                        <option key={ownerStore.id} value={ownerStore.id}>
                          {ownerStore.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <Link
                href={storefrontHref}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#40534d] hover:bg-[#f5f8f6]"
              >
                <PortalIcon name="store" className="h-4 w-4" />
                {store?.is_active ? "View storefront" : "Store setup"}
              </Link>
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#40534d] hover:bg-[#f5f8f6]"
              >
                Browse Morni
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#40534d] hover:bg-[#f5f8f6]"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
        <Link
          href="/portal/products?new=1"
          className="portal-button-primary h-9 px-2.5 sm:px-3"
          aria-label="Add product"
        >
          <PortalIcon name="plus" className="h-4 w-4" />
          <span className="hidden sm:inline">Add product</span>
        </Link>
      </div>
    </header>
  );
}
