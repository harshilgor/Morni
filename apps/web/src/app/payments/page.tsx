"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatAed } from "@/lib/format";
import type { DeliveryAddressDraft } from "@/components/delivery-address-fields";
import { calculateCheckoutFees } from "@/lib/fees";
import {
  OrderFeeLines,
  SmallOrderNudge,
} from "@/components/order-fee-summary";

export default function PaymentsPage() {
  const { items, subtotal } = useCart();
  const [address, setAddress] = useState<DeliveryAddressDraft | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const orderSubtotal = subtotal();
  const fees = calculateCheckoutFees(orderSubtotal);
  const orderTotal = fees.totalAed;

  useEffect(() => {
    const storedAddress = window.sessionStorage.getItem("morni-checkout-address");
    if (!storedAddress) return;

    const timeout = window.setTimeout(() => {
      try {
        setAddress(JSON.parse(storedAddress) as DeliveryAddressDraft);
      } catch {
        window.sessionStorage.removeItem("morni-checkout-address");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="text-muted">Your bag is empty.</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-accent-deep underline underline-offset-4">
          Browse stores
        </Link>
      </main>
    );
  }

  if (!address) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Payment</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Choose a delivery address first</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">Select where you would like this order delivered before continuing to payment.</p>
        <Link href="/checkout" className="mt-7 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
          Return to checkout
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12">
        <div className="space-y-8">
          <header className="border-b border-line pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Checkout · Step 2 of 2</p>
            <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Payment</h1>
            <p className="mt-2 text-sm text-muted">Pay securely online to place your order.</p>
          </header>

          <section className="rounded-xl border border-line bg-background p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">Delivering to</p>
                <h2 className="mt-1 font-display text-2xl text-ink">{address.label || "Your delivery address"}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {[address.street, address.building, address.apartment, address.area].filter(Boolean).join(", ")}
                </p>
                {address.phone ? <p className="mt-1 text-sm text-muted">{address.phone}</p> : null}
              </div>
              <Link href="/checkout" className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-accent-deep underline underline-offset-4">
                Change
              </Link>
            </div>
          </section>

          <section aria-labelledby="payment-method-heading" className="border-t border-line pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Pay securely online</p>
                <h2 id="payment-method-heading" className="mt-1 font-display text-3xl text-ink">Choose a payment method</h2>
              </div>
              <span className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Secure</span>
            </div>

            <button
              type="button"
              aria-expanded={cardOpen}
              onClick={() => setCardOpen((open) => !open)}
              className={`mt-5 w-full rounded-xl border p-4 text-left transition ${cardOpen ? "border-ink bg-background ring-1 ring-ink" : "border-line bg-surface hover:border-ink/40"}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">Card</span>
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{cardOpen ? "Selected" : "Select"}</span>
              </span>
              <span className="mt-1 block text-xs text-muted">Visa, Mastercard and more</span>
            </button>

            {cardOpen ? (
              <div className="mt-3 rounded-xl border border-line bg-background p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-medium text-ink">Card number</span>
                    <input type="text" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-ink">Expiry date</span>
                    <input type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-ink">Security code</span>
                    <input type="text" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-medium text-ink">Name on card</span>
                    <input type="text" autoComplete="cc-name" placeholder="As shown on your card" className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted" />
                  </label>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted">Payment processing will be enabled when Morni connects its certified payment provider.</p>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="h-fit border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
          <SmallOrderNudge fees={fees} />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Order total</p>
          <h2 className="mt-1 font-display text-3xl text-ink">Price details</h2>
          <div className="mt-6 border-y border-line py-5"><OrderFeeLines fees={fees} /></div>
          <div className="mt-5 flex justify-between gap-4 text-lg font-semibold text-ink"><span>Total</span><span>{formatAed(orderTotal)}</span></div>
          <button type="button" disabled className="mt-6 w-full cursor-not-allowed bg-ink px-4 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-white opacity-50">
            Payment integration coming soon
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted">Your order will be placed once online payments are connected.</p>
        </aside>
      </div>
    </main>
  );
}
