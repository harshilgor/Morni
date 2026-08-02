"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

export function SiteHeader() {
  const pathname = usePathname();
  const count = useCart((s) => s.count());

  if (pathname?.startsWith("/portal")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-[#fff7f4]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-2xl tracking-tight text-ink">
          Morni
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/" className="transition hover:text-ink">
            Stores
          </Link>
          <Link href="/orders" className="transition hover:text-ink">
            Orders
          </Link>
          <Link href="/auth" className="transition hover:text-ink">
            Account
          </Link>
          <Link
            href="/cart"
            className="rounded-full bg-ink px-4 py-2 text-sm text-white transition hover:bg-accent-deep"
          >
            Bag{count > 0 ? ` · ${count}` : ""}
          </Link>
        </nav>
      </div>
    </header>
  );
}
