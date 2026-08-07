"use client";

import Link from "next/link";
import { useAuthUser } from "@/lib/use-auth-user";

const steps = [
  {
    title: "Create your Morni account",
    body: "Sign in with Google or email, then start setting up your boutique.",
  },
  {
    title: "Brand your boutique",
    body: "Add your name, location, logo, banner, hours, and delivery promise.",
  },
  {
    title: "List a product & launch",
    body: "Add a complete first product with photos, preview your storefront, then go live.",
  },
];

const perks = [
  {
    title: "Shoppers nearby",
    body: "Reach customers browsing local retail who want same-hour delivery.",
  },
  {
    title: "Simple portal",
    body: "Manage catalog, stock, and order status in one place.",
  },
  {
    title: "Pay on delivery first",
    body: "Start selling with COD while online payments come later.",
  },
];

export default function SellPage() {
  const { auth, loading } = useAuthUser();
  const hasStore = auth?.hasStore ?? false;

  const ctaHref = !auth
    ? "/auth?next=/sell/setup"
    : hasStore
      ? "/portal"
      : "/sell/setup";

  const ctaLabel = !auth
    ? "Start selling"
    : hasStore
      ? "Go to store portal"
      : "Continue store setup";

  const additionalStoreHref = auth?.hasStore ? "/sell/setup?new=1" : null;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
          <div className="animate-rise space-y-6">
            <p className="text-sm uppercase tracking-[0.2em] text-accent-deep">
              Sell on Morni
            </p>
            <h1 className="font-display text-4xl leading-[0.95] text-ink sm:text-6xl">
              Put your boutique
              <span className="block text-accent-deep">in front of nearby shoppers.</span>
            </h1>
            <p className="max-w-lg text-lg text-muted">
              List what you already sell on the floor. Morni brings customers who want
              local fashion delivered within about an hour.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={loading ? "/sell/setup" : ctaHref}
                className="rounded-full bg-ink px-6 py-3 text-sm text-white transition hover:bg-accent-deep"
              >
                {loading ? "Loading…" : ctaLabel}
              </Link>
              <Link
                href="/"
                className="rounded-full border border-line bg-surface px-6 py-3 text-sm text-ink"
              >
                Browse as a shopper
              </Link>
              {additionalStoreHref ? (
                <Link
                  href={additionalStoreHref}
                  className="rounded-full border border-line bg-surface px-6 py-3 text-sm text-ink"
                >
                  Add another store
                </Link>
              ) : null}
            </div>
          </div>
          <div className="animate-rise-delay relative min-h-[260px] overflow-hidden rounded-[2rem] bg-sand">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1418]/60 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 text-sm text-white">
              Your store · Your catalog · Orders in one portal
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl text-ink">How it works</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">
                Step {index + 1}
              </p>
              <h3 className="mt-3 font-display text-2xl text-ink">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface/70">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl text-ink">Why sellers join</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {perks.map((perk) => (
              <div key={perk.title} className="space-y-2">
                <h3 className="font-medium text-ink">{perk.title}</h3>
                <p className="text-sm text-muted">{perk.body}</p>
              </div>
            ))}
          </div>
          <Link
            href={loading ? "/sell/setup" : ctaHref}
            className="mt-10 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white transition hover:bg-accent-deep"
          >
            {loading ? "Loading…" : ctaLabel}
          </Link>
          {additionalStoreHref ? (
            <Link
              href={additionalStoreHref}
              className="mt-3 inline-flex rounded-full border border-line bg-surface px-6 py-3 text-sm text-ink"
            >
              Add another store
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
