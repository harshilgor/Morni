"use client";

import Link from "next/link";
import { useAuthUser } from "@/lib/use-auth-user";

const steps = [
  {
    number: "01",
    title: "Tell us about your boutique",
    body: "Add your name, story, location, and opening hours so shoppers know where you are.",
  },
  {
    number: "02",
    title: "Add your first look",
    body: "Upload one product with a photo, price, sizes, and the details customers need.",
  },
  {
    number: "03",
    title: "Preview, then go live",
    body: "See your storefront before shoppers do. Save your progress and launch when ready.",
  },
] as const;

const sellerBenefits = [
  {
    title: "Reach nearby shoppers",
    body: "Put your boutique in front of people already looking for local fashion.",
  },
  {
    title: "Keep it simple",
    body: "Manage products, stock, and orders from one focused seller portal.",
  },
  {
    title: "Online payments",
    body: "Give shoppers a smooth online checkout experience while you grow your boutique.",
  },
] as const;

const gettingStarted = [
  "Your boutique name and location",
  "Your Dubai location and street address",
  "A store logo",
  "One product photo, price, and size list",
] as const;

function CheckIcon() {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#d9efe5] text-sm font-bold text-[#2f6f66]" aria-hidden>
      ✓
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5V20h16v-9.5M3 10.5 4.5 4h15l1.5 6.5M3 10.5h18M8 20v-5h8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SellerCta({
  href,
  label,
  loading,
  tone = "dark",
}: {
  href: string;
  label: string;
  loading: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={loading ? "/sell/setup" : href}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
        tone === "dark"
          ? "bg-[#21342e] text-white shadow-[0_12px_24px_-16px_rgba(24,52,45,0.8)] hover:bg-[#2f6f66]"
          : "bg-white text-[#21342e] hover:bg-[#eff8f3]",
      ].join(" ")}
    >
      {loading ? "Loading…" : label}
      {!loading ? <ArrowIcon /> : null}
    </Link>
  );
}

export default function SellPage() {
  const { auth, loading } = useAuthUser();
  const hasStore = auth?.hasStore ?? false;

  const ctaHref = !auth
    ? "/auth?next=/sell/setup"
    : hasStore
      ? "/portal"
      : "/sell/setup";

  const ctaLabel = !auth
    ? "Create a store page in 6 minutes"
    : hasStore
      ? "Open my store portal"
      : "Continue store setup";

  const storeLoginHref = auth
    ? hasStore
      ? "/portal"
      : "/auth?next=/portal"
    : "/auth?next=/portal";

  const additionalStoreHref = auth?.hasStore ? "/sell/setup?new=1" : null;

  return (
    <div className="text-[#21342e]">
      <section className="relative overflow-hidden border-b border-[#cfe0da]">
        <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-[#b9ddd4]/55 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-40 top-8 h-[30rem] w-[30rem] rounded-full bg-[#d7dfe8]/65 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="animate-rise mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#b9d7ce] bg-white/65 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#2f6f66]">
              <StoreIcon />
              For UAE boutiques
            </div>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[0.96] tracking-[-0.045em] text-[#172b25] sm:text-6xl">
              Your boutique is ready for its next customer.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[#526861] sm:text-lg">
              Bring your best looks online, reach nearby shoppers, and manage orders from one simple Morni storefront.
            </p>

            <div className="mt-7 flex flex-col items-center gap-3">
              <SellerCta href={ctaHref} label={ctaLabel} loading={loading} />
              <Link
                href={storeLoginHref}
                className="inline-flex items-center justify-center rounded-full border border-[#a9c9bf] bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#2f6f66] transition hover:border-[#2f6f66] hover:bg-white"
              >
                Log into your store page
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#657a72]">
              Start with one product. Save your progress and add more whenever you&apos;re ready.
            </p>
          </div>
        </div>

        <div className="relative border-t border-[#cfe0da]/80 bg-white/35">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:grid-cols-3 sm:px-6 sm:py-6">
            {sellerBenefits.map((benefit) => (
              <div key={benefit.title} className="flex gap-3 sm:block">
                <CheckIcon />
                <div>
                  <h2 className="text-sm font-semibold text-[#21342e]">{benefit.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#657a72]">{benefit.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-b border-[#d8e4df] bg-white/45">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6f66]">A lighter way to sell online</p>
            <h2 className="mt-3 font-display text-3xl tracking-[-0.035em] text-[#172b25] sm:text-5xl">From boutique floor to live storefront.</h2>
            <p className="mt-4 text-base leading-7 text-[#60756d]">You do not need a huge catalog or a complicated setup. Start with the pieces you already know customers love.</p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.number} className="rounded-[1.4rem] border border-[#d4e2dc] bg-white/75 p-5 shadow-[0_12px_30px_-26px_rgba(26,64,53,0.55)] sm:p-6">
                <p className="font-display text-3xl text-[#9ac8ba]">{step.number}</p>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-[#21342e]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#687d75]">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch">
        <div className="rounded-[1.6rem] bg-[#21342e] p-6 text-white sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b9ddd4]">Start with what you have</p>
          <h2 className="mt-4 max-w-md font-display text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">Your first storefront can be lighter than you think.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/65">Gather these basics and you can begin. Morni keeps the next step clear as you go.</p>
          <div className="mt-7 grid gap-3">
            {gettingStarted.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/85">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/12 text-[#b9ddd4]">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-[#d4e2dc] bg-white/65 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6f66]">Built for boutique owners</p>
          <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight tracking-[-0.03em] text-[#172b25] sm:text-4xl">Keep your attention on the clothes, not the admin.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f0f7f4] p-4">
              <p className="text-sm font-semibold text-[#21342e]">A storefront that feels like you</p>
              <p className="mt-2 text-sm leading-6 text-[#687d75]">Add your story, imagery, products, and location in one place.</p>
            </div>
            <div className="rounded-2xl bg-[#f7f4f0] p-4">
              <p className="text-sm font-semibold text-[#21342e]">A clearer day-to-day</p>
              <p className="mt-2 text-sm leading-6 text-[#687d75]">Keep catalog, stock, and order status together in your portal.</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SellerCta href={ctaHref} label={ctaLabel} loading={loading} />
            {additionalStoreHref ? (
              <Link href={additionalStoreHref} className="text-sm font-semibold text-[#2f6f66] underline decoration-[#9ac8ba] underline-offset-4 hover:text-[#21342e]">
                Add another store
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t border-[#d4e2dc] bg-[#dceee7]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6f66]">Your next customer is already browsing</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-[#172b25]">Ready to put your boutique on Morni?</h2>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <SellerCta href={ctaHref} label={ctaLabel} loading={loading} />
            <Link href="/" className="text-center text-xs font-semibold text-[#56736a] underline underline-offset-4 hover:text-[#21342e] sm:text-right">Browse Morni as a shopper</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
