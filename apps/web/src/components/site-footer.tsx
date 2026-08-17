"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthUser } from "@/lib/use-auth-user";
export function SiteFooter() {
  const pathname = usePathname();
  const { auth } = useAuthUser();

  if (pathname?.startsWith("/portal") || pathname?.startsWith("/founder")) {
    return null;
  }

  const accountLinks = auth
    ? [
        { href: "/orders", label: "Your orders" },
        { href: "/wishlist", label: "Your wishlist" },
        { href: "/checkout", label: "Your cart" },
        { href: "/auth", label: "Account" },
      ]
    : [
        { href: "/auth", label: "Sign in" },
        { href: "/orders", label: "Orders" },
        { href: "/wishlist", label: "Wishlist" },
        { href: "/checkout", label: "Cart" },
      ];

  const columns = [
    {
      title: "Shop",
      links: [
        { href: "/", label: "All stores" },
        { href: "/categories/lehengas", label: "Lehengas" },
        { href: "/categories/kurtis", label: "Kurtis" },
        { href: "/categories/party-wear", label: "Party wear" },
      ],
    },
    {
      title: auth ? `Hi, ${auth.firstName}` : "Your account",
      links: accountLinks,
    },
    {
      title: "Partners",
      links: [
        { href: "/sell", label: "Sell on Morni" },
        { href: "/portal", label: "Store portal" },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-[#2a1f24] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:px-5">
        <div>
          <Link href="/" className="font-display text-2xl tracking-tight">
            Morni
          </Link>
          <p className="mt-2 max-w-xs text-sm text-white/65">
            {auth
              ? `Welcome back, ${auth.firstName}. Local UAE retail, delivered within 1 hour.`
              : "Local UAE retail, delivered within 1 hour."}
          </p>
          <p className="mt-3 space-y-1 text-sm text-white/80">
            <a href="tel:043257001" className="block transition hover:text-white">
              04-3257001
            </a>
            <a
              href="mailto:info@rmt.ae"
              className="block transition hover:text-white"
            >
              info@rmt.ae
            </a>
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
              {column.title}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-white/80 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/45 sm:px-5">
          <span>© {new Date().getFullYear()} Morni · Real Magic Trading LLC</span>
          <span>Secure online payments coming soon</span>
        </div>
      </div>
    </footer>
  );
}
