"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useLocation } from "@/lib/location";
import { useAuthUser } from "@/lib/use-auth-user";
import { createClient } from "@/lib/supabase/client";
import type { UaeEmirate } from "@/lib/types";
import { SearchTypeahead } from "@/components/search-typeahead";
import { SavedAddressPicker } from "@/components/saved-address-picker";
import { OCCASIONS } from "@/lib/occasions";

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5h2l1.2 9.2a2 2 0 0 0 2 1.8h8.5a2 2 0 0 0 2-1.7L20 8H7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.5 20c.8-3.7 3.5-5.7 7.5-5.7s6.7 2 7.5 5.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20.5s-7.5-4.7-9.5-9C.9 8.1 2.7 5.2 5.8 4.8c2.1-.3 4.1.7 5.2 2.3 1.1-1.6 3.1-2.6 5.2-2.3 3.1.4 4.9 3.3 3.3 6.7-2 4.3-9.5 9-9.5 9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CATEGORY_MENU_GROUPS = [
  {
    title: "Featured styles",
    links: [["Lehengas", "/categories/lehengas"], ["Shararas", "/categories/shararas"], ["Salwar kameez", "/categories/salwar-kameez"], ["Kurtis", "/categories/kurtis"]],
  },
  {
    title: "Shop the occasion",
    links: [["Party wear", "/categories/party-wear"], ["Indo-western", "/categories/indo-western"], ["Dresses", "/categories/dresses"], ["Evening edit", "/categories/evening"]],
  },
  {
    title: "Complete the look",
    links: [["Bags", "/categories/bags"], ["Shoes", "/categories/shoes"], ["Jewelry", "/categories/jewelry"], ["Accessories", "/categories/accessories"]],
  },
] as const;

const CATEGORY_MENU_FEATURES = [
  { name: "Lehengas", href: "/categories/lehengas", image: "/categories/lehengas.png" },
  { name: "Party wear", href: "/categories/party-wear", image: "/categories/party-wear.jpg" },
  { name: "Kurtis", href: "/categories/kurtis", image: "/categories/kurtis.jpg" },
] as const;
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const count = useCart((s) => s.count());
  const { auth } = useAuthUser();
  const emirate = useLocation((s) => s.emirate);
  const area = useLocation((s) => s.area);
  const setLocation = useLocation((s) => s.setLocation);
  const locationLabel = useLocation((s) => s.label());

  const [locationOpen, setLocationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [occasionsOpen, setOccasionsOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const menuCloseTimer = useRef<number | null>(null);


  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
      if (!categoryMenuRef.current?.contains(e.target as Node)) {
        setCategoriesOpen(false);
        setOccasionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    return () => {
      if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!locationOpen) return;
    const previousOverflow = document.body.style.overflow;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLocationOpen(false);
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [locationOpen]);
  if (pathname?.startsWith("/portal")) {
    return null;
  }

  function toggleLocationPanel() {
    setLocationOpen((current) => !current);
  }

  function applyLocation(nextEmirate: UaeEmirate, nextArea: string) {
    setLocation(nextEmirate, nextArea);
    setLocationOpen(false);
    // On search, keep the URL in sync so results reflect the new emirate.
    // On home we leave scroll position alone — HomeStores reacts to the store.
    if (pathname?.startsWith("/search")) {
      router.push(`/search?emirate=${nextEmirate}`, { scroll: false });
    }
  }

  function openCategories() {
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    setCategoriesOpen(true);
    setOccasionsOpen(false);
  }

  function openOccasions() {
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    setCategoriesOpen(false);
    setOccasionsOpen(true);
  }

  function scheduleMenusClose() {
    if (menuCloseTimer.current) window.clearTimeout(menuCloseTimer.current);
    menuCloseTimer.current = window.setTimeout(() => {
      setCategoriesOpen(false);
      setOccasionsOpen(false);
    }, 120);
  }

  function closeMenus() {
    setCategoriesOpen(false);
    setOccasionsOpen(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  const firstName = auth?.firstName;
  const isStoreOwner = auth?.hasStore ?? false;

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:gap-4 sm:px-5 sm:py-2.5">
          <Link
            href="/"
            className="shrink-0 font-display text-2xl tracking-tight text-white sm:text-[1.7rem]"
          >
            Morni
          </Link>

          <div className="shrink-0">
            <button
              type="button"
              onClick={toggleLocationPanel}
              className="flex max-w-[7.5rem] items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-left transition hover:border-white/35 hover:bg-white/5 sm:max-w-[13rem]"
              aria-expanded={locationOpen}
              aria-haspopup="dialog"
              aria-controls="delivery-location-dialog"
            >
              <PinIcon className="h-5 w-5 shrink-0 text-white/90" />
              <span className="min-w-0 leading-tight">
                <span className="block text-[11px] text-white/65">
                  {firstName ? `Deliver to ${firstName}` : "Deliver to"}
                </span>
                <span className="block truncate text-sm font-semibold">{locationLabel}</span>
              </span>
            </button>
          </div>

          <div className="order-3 w-full sm:order-none sm:flex-1">
            <SearchTypeahead
              placeholder={
                firstName
                  ? `Search Morni, ${firstName}`
                  : "Search stores and products"
              }
            />
          </div>

          <nav className="hidden shrink-0 items-center gap-1 md:flex">
            <div className="relative min-w-[7.5rem]" ref={accountRef}>
              {auth ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((o) => !o)}
                    className="w-full rounded-md border border-transparent px-2 py-1 text-left leading-tight transition hover:border-white/35 hover:bg-white/5"
                  >
                    <span className="block truncate text-[11px] text-white/65">
                      Hello, {firstName}
                    </span>
                    <span className="block text-sm font-semibold">Account & Lists</span>
                  </button>
                  {accountOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-line bg-surface p-3 text-ink shadow-[0_20px_50px_-20px_rgba(28,20,24,0.55)]">
                      <p className="px-2 pb-2 text-sm font-medium">{auth.displayName}</p>
                      <Link
                        href="/orders"
                        className="block rounded-lg px-2 py-2 text-sm hover:bg-background"
                        onClick={() => setAccountOpen(false)}
                      >
                        Your orders
                      </Link>
                      <Link
                        href="/checkout"
                        className="block rounded-lg px-2 py-2 text-sm hover:bg-background"
                        onClick={() => setAccountOpen(false)}
                      >
                        Your cart
                      </Link>
                      <Link
                        href="/wishlist"
                        className="block rounded-lg px-2 py-2 text-sm hover:bg-background"
                        onClick={() => setAccountOpen(false)}
                      >
                        Your wishlist
                      </Link>                      <Link
                        href="/addresses"
                        className="block rounded-lg px-2 py-2 text-sm hover:bg-background"
                        onClick={() => setAccountOpen(false)}
                      >
                        Your addresses
                      </Link>
                      {isStoreOwner ? (
                        <>
                          <Link
                            href="/portal"
                            className="block rounded-lg px-2 py-2 text-sm hover:bg-background"
                            onClick={() => setAccountOpen(false)}
                          >
                            My Store
                          </Link>
                          <p className="px-2 pt-1 text-[10px] uppercase tracking-[0.12em] text-muted">
                            You&apos;re browsing as a shopper
                          </p>
                        </>
                      ) : (
                        <Link
                          href="/sell"
                          className="block rounded-lg px-2 py-2 text-sm hover:bg-background"
                          onClick={() => setAccountOpen(false)}
                        >
                          Sell on Morni
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={signOut}
                        className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-accent-deep hover:bg-background"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <Link
                  href="/auth"
                  className="block w-full rounded-md border border-transparent px-2 py-1 leading-tight transition hover:border-white/35 hover:bg-white/5"
                >
                  <span className="block text-[11px] text-white/65">Hello, sign in</span>
                  <span className="block text-sm font-semibold">Account & Lists</span>
                </Link>
              )}
            </div>
            <Link
              href="/orders"
              className="min-w-[4.75rem] rounded-md border border-transparent px-2 py-1 leading-tight transition hover:border-white/35 hover:bg-white/5"
            >
              <span className="block text-[11px] text-white/65">Returns</span>
              <span className="block text-sm font-semibold">& Orders</span>
            </Link>
          </nav>

          <Link
            href={auth ? "/orders" : "/auth"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-white transition hover:border-white/35 hover:bg-white/5 md:hidden"
            aria-label={auth ? "View account and orders" : "Sign in"}
            title={auth ? "Account" : "Sign in"}
          >
            <AccountIcon className="h-5 w-5" />
          </Link>

          <Link
            href="/wishlist"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-white transition hover:border-white/35 hover:bg-white/5"
            aria-label="View wishlist"
            title="Wishlist"
          >
            <HeartIcon className="h-6 w-6" />
          </Link>

          <Link
            href="/checkout"
            className="relative flex shrink-0 items-end gap-1 rounded-md border border-transparent px-1.5 py-1 transition hover:border-white/35 hover:bg-white/5"
            aria-label={`Cart, ${count} items`}
          >
            <span className="relative">
              <CartIcon className="h-8 w-8" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white">
                {count}
              </span>
            </span>
            <span className="hidden pb-0.5 text-sm font-semibold sm:inline">Cart</span>
          </Link>
        </div>
      </div>

      <div
        className="relative border-b border-line/60 bg-[#2a1f24] text-white"
        ref={categoryMenuRef}
        onMouseLeave={scheduleMenusClose}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            closeMenus();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeMenus();
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-3 py-2 pr-8 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 sm:px-5">
          <Link href="/" className="shrink-0 font-medium text-white/90 hover:text-white">
            Home
          </Link>
          <Link
            href="/for-you"
            className="shrink-0 rounded-full bg-white px-3.5 py-1 text-sm font-medium shadow-sm transition hover:bg-[#fff6f8]"
          >
            <span className="text-accent-deep">For</span>{" "}
            <span className="text-[#5c4a50]">you</span>
          </Link>
          <Link
            href="/categories"
            onMouseEnter={openCategories}
            onFocus={openCategories}
            aria-expanded={categoriesOpen}
            aria-haspopup="menu"
            className={`shrink-0 font-medium transition ${
              categoriesOpen ? "text-white" : "text-white/90 hover:text-white"
            }`}
          >
            Categories
          </Link>
          <Link
            href="/categories"
            onMouseEnter={openOccasions}
            onFocus={openOccasions}
            aria-expanded={occasionsOpen}
            aria-haspopup="menu"
            className={`shrink-0 font-medium transition ${
              occasionsOpen ? "text-white" : "text-white/90 hover:text-white"
            }`}
          >
            Occasions
          </Link>
          <Link href="/stores" className="shrink-0 font-medium text-white/90 hover:text-white">
            Stores
          </Link>
          <Link
            href="/under-99"
            className="shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:border-white/50 hover:bg-white/20"
          >
            Under AED 99
          </Link>
          <Link
            href="/under-149"
            className="shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:border-white/50 hover:bg-white/20"
          >
            Under AED 149
          </Link>
          {isStoreOwner ? (
            <Link href="/portal" className="shrink-0 text-white/85 hover:text-white">
              My Store
            </Link>
          ) : (
            <Link href="/sell" className="shrink-0 text-white/85 hover:text-white">
              Sell on Morni
            </Link>
          )}
          {firstName ? (
            <span className="ml-auto hidden shrink-0 text-xs text-white/60 sm:inline">
              Welcome back, {firstName}
            </span>
          ) : null}
        </div>
        {categoriesOpen ? (
          <div
            className="absolute inset-x-0 top-full z-50 hidden border-b border-line bg-surface text-ink shadow-[0_24px_48px_-30px_rgba(28,20,24,0.7)] md:block"
            onMouseEnter={openCategories}
            role="menu"
            aria-label="Shop by category"
          >
            <div className="mx-auto grid max-w-7xl grid-cols-[repeat(3,minmax(0,1fr))_1.25fr] gap-8 px-5 py-7">
              {CATEGORY_MENU_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">{group.title}</p>
                  <div className="mt-3 space-y-2">
                    {group.links.map(([label, href]) => (
                      <Link key={href} href={href} role="menuitem" onClick={() => setCategoriesOpen(false)} className="block w-fit text-sm text-ink/80 transition hover:text-accent-deep hover:underline">
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-l border-line pl-7">
                <div className="grid grid-cols-3 gap-3">
                  {CATEGORY_MENU_FEATURES.map((feature) => (
                    <Link key={feature.href} href={feature.href} role="menuitem" onClick={() => setCategoriesOpen(false)} className="group">
                      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-sand">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={feature.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      </div>
                      <p className="mt-2 text-center text-xs font-medium text-ink group-hover:text-accent-deep">{feature.name}</p>
                    </Link>
                  ))}
                </div>
                <Link href="/categories" role="menuitem" onClick={() => setCategoriesOpen(false)} className="mt-5 flex items-center justify-center rounded-full border border-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-ink hover:text-white">
                  Explore all categories
                </Link>
              </div>
            </div>
          </div>
        ) : null}
        {occasionsOpen ? (
          <div
            className="absolute inset-x-0 top-full z-50 hidden border-b border-line bg-surface text-ink shadow-[0_24px_48px_-30px_rgba(28,20,24,0.7)] md:block"
            onMouseEnter={openOccasions}
            role="menu"
            aria-label="Shop by occasion"
          >
            <div className="mx-auto max-w-7xl px-5 py-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
                    Curated edits
                  </p>
                  <p className="mt-1 font-display text-2xl text-ink">
                    Shop by occasion
                  </p>
                </div>
                <Link
                  href="/categories"
                  role="menuitem"
                  onClick={closeMenus}
                  className="hidden rounded-full border border-ink px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition hover:bg-ink hover:text-white sm:inline-flex"
                >
                  Explore all edits
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {OCCASIONS.map((occasion) => (
                  <Link
                    key={occasion.title}
                    href={occasion.href}
                    role="menuitem"
                    onClick={closeMenus}
                    className="group min-w-0"
                  >
                    <div className="aspect-[4/5] overflow-hidden rounded-xl bg-sand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={occasion.image}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <p className="mt-2 truncate text-center text-xs font-medium text-ink transition group-hover:text-accent-deep">
                      {occasion.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {locationOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink/55 px-3 py-6 backdrop-blur-[2px] sm:items-center sm:px-5"
          onMouseDown={() => setLocationOpen(false)}
        >
          <div
            id="delivery-location-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-location-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-[0_28px_80px_-28px_rgba(18,12,15,0.8)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p id="delivery-location-title" className="font-display text-2xl text-ink">Delivery location</p>
                <p className="mt-0.5 text-xs text-muted">Choose where you want Morni to deliver.</p>
              </div>
              <button
                type="button"
                onClick={() => setLocationOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-xl text-ink transition hover:bg-background"
                aria-label="Close delivery location"
              >
                ×
              </button>
            </div>
            <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-5 py-5">
              <SavedAddressPicker
                userId={auth?.user.id}
                currentEmirate={emirate}
                currentArea={area}
                onSelect={(address) => applyLocation(address.emirate, address.area)}
                onNavigate={() => setLocationOpen(false)}
              />

            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
