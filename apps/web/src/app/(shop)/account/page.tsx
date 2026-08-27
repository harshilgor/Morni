"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { animate } from "animejs";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";

type ProfileForm = {
  full_name: string;
  phone: string;
};

type Stats = {
  orderCount: number;
  wishlistCount: number;
  addressCount: number;
  reviewCount: number;
};

const QUICK_ACTIONS = [
  {
    title: "Orders",
    description: "Track and manage your purchases",
    href: "/orders",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Wishlist",
    description: "Items saved for later",
    href: "/wishlist",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M12 20.5s-7.5-4.7-9.5-9C.9 8.1 2.7 5.2 5.8 4.8c2.1-.3 4.1.7 5.2 2.3 1.1-1.6 3.1-2.6 5.2-2.3 3.1.4 4.9 3.3 3.3 6.7-2 4.3-9.5 9-9.5 9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Addresses",
    description: "Manage delivery addresses",
    href: "/addresses",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: "Reviews",
    description: "Rate products you've purchased",
    href: "/account/reviews",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 2.9 1.1-6.5L2.6 8.8l6.5-.9L12 2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

export default function AccountPage() {
  const router = useRouter();
  const { auth, loading: authLoading } = useAuthUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardsRef.current;
    if (!el || authLoading || !auth) return;
    el.querySelectorAll<HTMLElement>("[data-card]").forEach((card, i) => {
      animate(card, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 500,
        delay: i * 70,
        easing: "easeOutCubic",
      });
    });
  }, [auth, authLoading]);

  // Populate form as soon as auth is ready (no extra fetch)
  useEffect(() => {
    if (authLoading) return;
    if (!auth) {
      router.replace("/auth?next=/account");
      return;
    }
    setForm({
      full_name: auth.profile?.full_name ?? auth.displayName ?? "",
      phone: auth.profile?.phone ?? "",
    });
  }, [auth, authLoading, router]);

  // Load stats in a separate non-blocking effect
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const supabase = createClient();
    const userId = auth.user.id;

    Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("shopper_id", userId),
      supabase.from("wishlist_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("product_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]).then(([orders, wishlist, addresses, reviews]) => {
      if (cancelled) return;
      setStats({
        orderCount: orders.count ?? 0,
        wishlistCount: wishlist.count ?? 0,
        addressCount: addresses.count ?? 0,
        reviewCount: reviews.count ?? 0,
      });
    });

    return () => { cancelled = true; };
  }, [auth]);

  async function handleSave() {
    if (!auth || !form) return;
    if (!/^[-+0-9() ]{7,}$/.test(form.phone.trim())) {
      setProfileError("Add a valid phone number so your store and rider can contact you.");
      setSaved(false);
      return;
    }
    setProfileError(null);
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() })
      .eq("id", auth.user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);

    const { error } = await createClient().auth.signOut();
    if (error) {
      setSigningOut(false);
      setSignOutError("We couldn't sign you out. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (authLoading || !auth) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
        <div className="mt-10 skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  const statMap: Record<string, number> | null = stats
    ? { Orders: stats.orderCount, Wishlist: stats.wishlistCount, Addresses: stats.addressCount, Reviews: stats.reviewCount }
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-ink px-6 py-7 text-white sm:px-8">
        <h1 className="font-display text-3xl">Welcome, {auth.firstName}</h1>
        <p className="mt-1 text-sm text-white/65">
          {auth.user.email}
        </p>
      </div>

      {/* Quick actions */}
      <div ref={cardsRef} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            data-card
            className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-6 text-center opacity-0 transition hover:border-accent hover:shadow-sm"
          >
            <span className="text-ink/70 transition group-hover:text-accent-deep">
              {action.icon}
            </span>
            <span className="text-sm font-semibold text-ink">{action.title}</span>
            <span className="text-xs text-muted">{action.description}</span>
            {statMap && statMap[action.title] > 0 && (
              <span className="mt-auto rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-ink">
                {statMap[action.title]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Profile details */}
      <div className="mt-10">
        <h2 className="font-display text-2xl text-ink">Profile details</h2>
        <div className="mt-4 space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div>
            <label htmlFor="fullName" className="block text-xs font-medium uppercase tracking-wider text-muted">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              value={form?.full_name ?? ""}
              onChange={(e) => setForm((f) => f ? { ...f, full_name: e.target.value } : f)}
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-medium uppercase tracking-wider text-muted">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              required
              pattern="[-+0-9() ]{7,}"
              title="Enter a valid phone number"
              value={form?.phone ?? ""}
              onChange={(e) => setForm((f) => f ? { ...f, phone: e.target.value } : f)}
              className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Email
            </label>
            <p className="mt-1 rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm text-muted">
              {auth.user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Update profile"}
          </button>
          {profileError ? <p className="text-sm text-red-700" role="alert">{profileError}</p> : null}
          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Account access</p>
              <p className="mt-1 text-xs text-muted">Sign out of Morni on this device.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
          {signOutError && (
            <p className="text-sm text-red-700" role="alert">
              {signOutError}
            </p>
          )}
        </div>
      </div>

      {/* Seller section */}
      {auth.hasStore ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h3 className="font-medium text-ink">Seller dashboard</h3>
          <p className="mt-1 text-sm text-muted">Manage your store, products, and orders.</p>
          <Link
            href="/portal"
            className="mt-3 inline-block rounded-lg bg-accent-deep px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Go to My Store
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface/70 p-5 text-center sm:p-6">
          <p className="text-sm text-muted">Interested in selling on Morni?</p>
          <Link href="/sell" className="mt-2 inline-block text-sm font-medium text-accent-deep underline">
            Start selling
          </Link>
        </div>
      )}
    </div>
  );
}
