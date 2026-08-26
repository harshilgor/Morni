"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";
import { useNewOrderCount } from "@/lib/use-new-order-count";

const primaryTabs: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/portal", label: "Overview", icon: "overview" },
  { href: "/portal/orders", label: "Orders", icon: "orders" },
  { href: "/portal/products", label: "Products", icon: "products" },
];

const moreLinks: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/portal/promotions", label: "Promotions", icon: "promotions" },
  { href: "/portal/reviews", label: "Reviews", icon: "reviews" },
  { href: "/portal/analytics", label: "Analytics", icon: "analytics" },
  { href: "/portal/settings", label: "Store settings", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/portal" && pathname.startsWith(`${href}/`));
}

export function PortalBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { store } = useOwnerStore();
  const newOrderCount = useNewOrderCount(store?.id);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => setMoreOpen(false));
  }, [pathname]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth");
  }

  const storefrontHref =
    store && isOnboardingComplete(store) && store.is_active
      ? `/stores/${store.slug}`
      : "/sell/setup";
  const moreActive = moreLinks.some((link) => isActive(pathname, link.href));

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#17231f]/35"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] mx-3 overflow-hidden rounded-2xl border border-[#c6d0cb] bg-white shadow-[0_24px_60px_-28px_rgba(20,35,29,0.45)]"
            role="dialog"
            aria-label="More portal pages"
          >
            <div className="border-b border-[#e2e7e4] px-4 py-3">
              <p className="text-sm font-semibold text-[#1d2925]">More</p>
              <p className="mt-0.5 text-xs text-[#7b8882]">Manage your store tools</p>
            </div>
            <nav className="p-2">
              {moreLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                      active ? "bg-[#e3eee9] text-[#1f594f]" : "text-[#40534d] hover:bg-[#f5f8f6]"
                    }`}
                  >
                    <PortalIcon name={link.icon} className="h-[18px] w-[18px]" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="space-y-1 border-t border-[#e2e7e4] p-2">
              <Link
                href={storefrontHref}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#40534d] hover:bg-[#f5f8f6]"
              >
                <PortalIcon name="store" className="h-[18px] w-[18px]" />
                {store?.is_active ? "View storefront" : "Complete store setup"}
                <PortalIcon name="external" className="ml-auto h-3.5 w-3.5 text-[#7b8882]" />
              </Link>
              <Link
                href="/"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#40534d] hover:bg-[#f5f8f6]"
              >
                Browse Morni
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#40534d] hover:bg-[#f5f8f6]"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#c6d0cb] bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Portal primary"
      >
        <div className="grid h-[4.25rem] grid-cols-4">
          {primaryTabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide ${
                  active ? "text-[#1f594f]" : "text-[#7b8882]"
                }`}
              >
                <span
                  className={`relative grid h-9 w-9 place-items-center rounded-xl ${
                    active ? "bg-[#e3eee9]" : "bg-transparent"
                  }`}
                >
                  <PortalIcon name={tab.icon} className="h-5 w-5" />
                  {tab.href === "/portal/orders" && newOrderCount > 0 ? (
                    <span className="absolute ml-7 mt-[-1.35rem] grid h-4 min-w-4 place-items-center rounded-full bg-[#d66b4a] px-1 text-[9px] font-bold text-white">
                      {newOrderCount > 99 ? "99+" : newOrderCount}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide ${
              moreOpen || moreActive ? "text-[#1f594f]" : "text-[#7b8882]"
            }`}
            aria-expanded={moreOpen}
            aria-label="More portal pages"
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl ${
                moreOpen || moreActive ? "bg-[#e3eee9]" : "bg-transparent"
              }`}
            >
              <PortalIcon name="more" className="h-5 w-5" />
            </span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}
