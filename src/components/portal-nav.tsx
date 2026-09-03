"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";
import { useNewOrderCount } from "@/lib/use-new-order-count";

const primaryLinks: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/portal", label: "Overview", icon: "overview" },
  { href: "/portal/orders", label: "Orders", icon: "orders" },
  { href: "/portal/products", label: "Products", icon: "products" },
  { href: "/portal/promotions", label: "Promotions", icon: "promotions" },
];

const manageLinks: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/portal/reviews", label: "Reviews", icon: "reviews" },
  { href: "/portal/analytics", label: "Analytics", icon: "analytics" },
  { href: "/portal/team", label: "Team access", icon: "team" },
  { href: "/portal/settings", label: "Store settings", icon: "settings" },
];

function NavGroup({
  title,
  links,
  pathname,
  newOrderCount = 0,
}: {
  title?: string;
  links: { href: string; label: string; icon: PortalIconName }[];
  pathname: string;
  newOrderCount?: number;
}) {
  return (
    <div className="space-y-1">
      {title ? (
        <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#82908a]">
          {title}
        </p>
      ) : null}
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/portal" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-[#bfd0c8] bg-[#e3eee9] text-[#1f594f] shadow-[0_1px_2px_rgba(20,35,29,0.05)]"
                : "border-transparent text-[#52615b] hover:border-[#d2dad6] hover:bg-white hover:text-[#1f302a]"
            }`}
          >
            <PortalIcon name={link.icon} className="h-[18px] w-[18px]" />
            <span>{link.label}</span>
            {link.href === "/portal/orders" && newOrderCount > 0 ? (
              <span
                className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#d66b4a] px-1 text-[10px] font-bold text-white"
                aria-label={`${newOrderCount} new order${newOrderCount === 1 ? "" : "s"}`}
              >
                {newOrderCount > 99 ? "99+" : newOrderCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { store } = useOwnerStore();
  const newOrderCount = useNewOrderCount(store?.id, "sidebar");

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth");
  }

  const storefrontHref =
    store && isOnboardingComplete(store) && store.is_active
      ? `/stores/${store.slug}`
      : "/sell/setup";

  return (
    <aside className="z-40 hidden border-r border-[#c6d0cb] bg-[#f8faf9] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[15.5rem] lg:shrink-0 lg:flex-col">
      <div className="border-b border-[#d5ddd9] px-5 py-5">
        <Link href="/portal" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#21342e] font-display text-xl text-white shadow-sm">
            M
          </span>
          <span>
            <span className="block text-base font-bold tracking-[-0.03em] text-[#17231f]">
              Morni Portal
            </span>
            <span className="mt-0.5 block text-[11px] text-[#687770]">Seller workspace</span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavGroup links={primaryLinks} pathname={pathname} newOrderCount={newOrderCount} />
        <NavGroup title="Manage" links={manageLinks} pathname={pathname} />
      </nav>
      <div className="border-t border-[#d5ddd9] p-3">
        <Link
          href={storefrontHref}
          className="flex items-center gap-3 rounded-lg border border-[#bcc8c2] bg-white p-3 shadow-[0_1px_2px_rgba(20,35,29,0.05)] transition hover:border-[#8fa39a] hover:bg-[#f7faf8]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8efec] text-[#315f54]">
            <PortalIcon name="store" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[#283832]">
              {store?.name ?? "Your storefront"}
            </span>
            <span className="mt-0.5 block text-[11px] text-[#687770]">
              {store?.is_active ? "View shopper page" : "Complete store setup"}
            </span>
          </span>
          <PortalIcon name="external" className="h-3.5 w-3.5 text-[#687770]" />
        </Link>
        <div className="mt-2 flex gap-1">
          <Link
            href="/"
            className="flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold text-[#5b6a64] hover:bg-[#f1f5f2]"
          >
            Browse Morni
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#5b6a64] hover:bg-[#f1f5f2]"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
