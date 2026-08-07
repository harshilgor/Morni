"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { EMIRATES } from "@/lib/format";
import { UAE_AREAS, useLocation } from "@/lib/location";
import { useAuthUser } from "@/lib/use-auth-user";
import { createClient } from "@/lib/supabase/client";
import type { UaeEmirate } from "@/lib/types";
import { SearchTypeahead } from "@/components/search-typeahead";
import { SavedAddressPicker } from "@/components/saved-address-picker";

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
  const [draftEmirate, setDraftEmirate] = useState<UaeEmirate>(emirate);
  const [draftArea, setDraftArea] = useState(area);
  const panelRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setLocationOpen(false);
      }
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (pathname?.startsWith("/portal")) {
    return null;
  }

  function toggleLocationPanel() {
    const nextOpen = !locationOpen;
    if (nextOpen) {
      setDraftEmirate(emirate);
      setDraftArea(area);
    }
    setLocationOpen(nextOpen);
  }

  function changeDraftEmirate(nextEmirate: UaeEmirate) {
    setDraftEmirate(nextEmirate);
    setDraftArea((current) => {
      const suggestions = UAE_AREAS[nextEmirate] ?? [];
      if (suggestions.includes(current) || current.trim()) return current;
      return suggestions[0] ?? "";
    });
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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  const areas = UAE_AREAS[draftEmirate] ?? [];
  const firstName = auth?.firstName;
  const isStoreOwner = auth?.hasStore ?? false;

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-5">
          <Link
            href="/"
            className="shrink-0 font-display text-2xl tracking-tight text-white sm:text-[1.7rem]"
          >
            Morni
          </Link>

          <div className="relative shrink-0" ref={panelRef}>
            <button
              type="button"
              onClick={toggleLocationPanel}
              className="flex max-w-[10.5rem] items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-left transition hover:border-white/35 hover:bg-white/5 sm:max-w-[13rem]"
              aria-expanded={locationOpen}
              aria-haspopup="dialog"
            >
              <PinIcon className="h-5 w-5 shrink-0 text-white/90" />
              <span className="min-w-0 leading-tight">
                <span className="block text-[11px] text-white/65">
                  {firstName ? `Deliver to ${firstName}` : "Deliver to"}
                </span>
                <span className="block truncate text-sm font-semibold">{locationLabel}</span>
              </span>
            </button>

            {locationOpen ? (
              <div className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[calc(100vh-5rem)] w-[min(92vw,22rem)] overflow-y-auto rounded-xl border border-line bg-surface p-4 text-ink shadow-[0_20px_50px_-20px_rgba(28,20,24,0.55)]">
                <SavedAddressPicker
                  userId={auth?.user.id}
                  defaultLabel={auth?.firstName ?? "Home"}
                  currentEmirate={emirate}
                  currentArea={area}
                  onSelect={(address) => applyLocation(address.emirate, address.area)}
                />
                <p className="font-display text-lg">Choose delivery location</p>
                <p className="mt-1 text-xs text-muted">
                  Pick your emirate and type any area — not limited to the suggestions.
                </p>

                <label className="mt-4 block space-y-1.5 text-sm">
                  <span className="text-muted">Emirate</span>
                  <select
                    className="w-full rounded-lg border border-line bg-background px-3 py-2"
                    value={draftEmirate}
                    onChange={(e) =>
                      changeDraftEmirate(e.target.value as UaeEmirate)
                    }
                  >
                    {EMIRATES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block space-y-1.5 text-sm">
                  <span className="text-muted">Area / neighborhood</span>
                  <input
                    list="morni-delivery-areas"
                    className="w-full rounded-lg border border-line bg-background px-3 py-2"
                    value={draftArea}
                    onChange={(e) => setDraftArea(e.target.value)}
                    placeholder="Type your exact area"
                  />
                  <datalist id="morni-delivery-areas">
                    {areas.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>

                <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                  {areas.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDraftArea(item)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-background ${
                        draftArea === item
                          ? "bg-background font-medium text-accent-deep"
                          : "text-ink"
                      }`}
                    >
                      {item}
                      {draftArea === item ? (
                        <span className="text-xs text-accent-deep">Selected</span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!draftArea.trim()}
                  onClick={() => applyLocation(draftEmirate, draftArea.trim())}
                  className="mt-3 w-full rounded-full bg-ink py-2.5 text-sm text-white disabled:opacity-50"
                >
                  Deliver to {draftArea.trim() || "…"}
                </button>
              </div>
            ) : null}
          </div>

          <SearchTypeahead
            placeholder={
              firstName
                ? `Search Morni, ${firstName}`
                : "Search stores and products"
            }
          />

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
                        href="/cart"
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
            href="/wishlist"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-white transition hover:border-white/35 hover:bg-white/5"
            aria-label="View wishlist"
            title="Wishlist"
          >
            <HeartIcon className="h-6 w-6" />
          </Link>

          <Link
            href="/cart"
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

      <div className="border-b border-line/60 bg-[#2a1f24] text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-3 py-2 text-sm sm:gap-4 sm:px-5">
          <Link href="/" className="shrink-0 font-medium text-white/90 hover:text-white">
            All stores
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
            className="shrink-0 font-medium text-white/90 hover:text-white"
          >
            Categories
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
          <span className="ml-auto hidden shrink-0 text-xs text-white/60 sm:inline">
            {firstName
              ? `Welcome back, ${firstName} · Delivery within 1 hour`
              : "Delivery within 1 hour"}
          </span>
        </div>
      </div>
    </header>
  );
}
