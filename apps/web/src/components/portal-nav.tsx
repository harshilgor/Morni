"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";

const links = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/products", label: "Products" },
  { href: "/portal/promotions", label: "Promotions" },
  { href: "/portal/analytics", label: "Analytics" },
  { href: "/portal/settings", label: "Store" },
];

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { store } = useOwnerStore();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
  }

  return (
    <aside className="border-b border-line bg-surface lg:min-h-screen lg:w-56 lg:border-b-0 lg:border-r">
      <div className="px-5 py-5">
        <Link href="/portal" className="font-display text-2xl text-ink">
          Morni Portal
        </Link>
        <p className="mt-1 text-xs text-muted">Store owner</p>
        {store ? (
          <p className="mt-2 text-sm font-medium text-ink">{store.name}</p>
        ) : null}
      </div>
      <nav className="flex gap-1 px-3 pb-4 lg:flex-col">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/portal" && pathname.startsWith(link.href + "/"));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2 text-sm ${active ? "bg-ink text-white" : "text-muted hover:bg-background"}`}
            >
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-background"
        >
          Sign out
        </button>
      </nav>
    </aside>
  );
}
