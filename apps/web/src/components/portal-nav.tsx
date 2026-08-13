"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PortalIcon, type PortalIconName } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";

const primaryLinks: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/portal", label: "Overview", icon: "overview" },
  { href: "/portal/orders", label: "Orders", icon: "orders" },
  { href: "/portal/products", label: "Products", icon: "products" },
  { href: "/portal/promotions", label: "Promotions", icon: "promotions" },
];

const manageLinks: { href: string; label: string; icon: PortalIconName }[] = [
  { href: "/portal/reviews", label: "Reviews", icon: "reviews" },
  { href: "/portal/analytics", label: "Analytics", icon: "analytics" },
  { href: "/portal/settings", label: "Store settings", icon: "settings" },
];

function NavGroup({
  title,
  links,
  pathname,
}: {
  title?: string;
  links: { href: string; label: string; icon: PortalIconName }[];
  pathname: string;
}) {
  return (
    <div className="flex shrink-0 gap-1 lg:block lg:space-y-1">
      {title ? <p className="hidden px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#82908a] lg:block">{title}</p> : null}
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/portal" && pathname.startsWith(`${link.href}/`));
        return <Link key={link.href} href={link.href} className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#e5f0eb] text-[#235d53]" : "text-[#5b6a64] hover:bg-[#f1f5f2] hover:text-[#263530]"}`}><PortalIcon name={link.icon} className="h-[18px] w-[18px]" /><span>{link.label}</span></Link>;
      })}
    </div>
  );
}

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { store } = useOwnerStore();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth");
  }

  const storefrontHref = store && isOnboardingComplete(store) && store.is_active ? `/stores/${store.slug}` : "/sell/setup";

  return (
    <aside className="z-40 border-b border-[#dce5e0] bg-[#fbfdfc] lg:sticky lg:top-0 lg:h-screen lg:w-[15.5rem] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="hidden border-b border-[#e5ece8] px-5 py-5 lg:block"><Link href="/portal" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#21342e] font-display text-xl text-white">M</span><span><span className="block text-base font-bold tracking-[-0.03em] text-[#1d2925]">Morni Portal</span><span className="mt-0.5 block text-[11px] text-[#7b8882]">Seller workspace</span></span></Link></div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:overflow-visible lg:px-3 lg:py-4">
          <NavGroup links={primaryLinks} pathname={pathname} />
          <NavGroup title="Manage" links={manageLinks} pathname={pathname} />
        </nav>
        <div className="mt-auto hidden border-t border-[#e5ece8] p-3 lg:block">
          <Link href={storefrontHref} className="flex items-center gap-3 rounded-xl border border-[#dce5e0] bg-white p-3 transition hover:border-[#afc2bb] hover:bg-[#f7faf8]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf3f0] text-[#3c685c]"><PortalIcon name="store" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#34423d]">{store?.name ?? "Your storefront"}</span><span className="mt-0.5 block text-[11px] text-[#7b8882]">{store?.is_active ? "View shopper page" : "Complete store setup"}</span></span><PortalIcon name="external" className="h-3.5 w-3.5 text-[#7b8882]" /></Link>
          <div className="mt-2 flex gap-1"><Link href="/" className="flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold text-[#5b6a64] hover:bg-[#f1f5f2]">Browse Morni</Link><button type="button" onClick={signOut} className="flex-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#5b6a64] hover:bg-[#f1f5f2]">Sign out</button></div>
        </div>
      </div>
    </aside>
  );
}
