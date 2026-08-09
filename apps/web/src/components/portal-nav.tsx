"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";

const links = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/products", label: "Products" },
  { href: "/portal/promotions", label: "Promotions" },
  { href: "/portal/reviews", label: "Reviews" },
  { href: "/portal/analytics", label: "Analytics" },
  { href: "/portal/settings", label: "Settings" },
];

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { store, stores, loading, selectStore } = useOwnerStore();

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
        {stores.length > 0 ? (
          <label className="mt-4 block text-xs font-medium text-muted">
            Active store
            <select
              value={store?.id ?? ""}
              onChange={(event) => selectStore(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-background px-2.5 py-2 text-sm font-medium text-ink outline-none focus:border-accent"
              aria-label="Active store"
            >
              {stores.map((ownerStore) => (
                <option key={ownerStore.id} value={ownerStore.id}>
                  {ownerStore.name}
                </option>
              ))}
            </select>
          </label>
        ) : !loading ? (
          <p className="mt-2 text-sm text-muted">No stores yet</p>
        ) : null}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 lg:flex-col lg:overflow-visible">
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

        <div className="my-2 hidden h-px w-full bg-line lg:block" />

        <p className="hidden px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80 lg:block">
          Shopper view
        </p>
        <Link
          href="/"
          className="rounded-xl px-3 py-2 text-sm text-accent-deep hover:bg-background"
        >
          Browse Morni
        </Link>
        <Link
          href="/sell/setup?new=1"
          className="rounded-xl px-3 py-2 text-sm text-accent-deep hover:bg-background"
        >
          Add a new store
        </Link>
        {store ? (
          isOnboardingComplete(store) && store.is_active ? (
            <Link
              href={`/stores/${store.slug}`}
              className="rounded-xl px-3 py-2 text-sm text-accent-deep hover:bg-background"
            >
              View my store page
            </Link>
          ) : (
            <Link
              href="/sell/setup"
              className="rounded-xl px-3 py-2 text-sm text-accent-deep hover:bg-background"
            >
              Continue setup
            </Link>
          )
        ) : null}

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
