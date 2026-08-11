"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { cartLineId } from "@/lib/cart";
import { formatAed } from "@/lib/format";
import {
  DeliveryAddressFields,
  EMPTY_DELIVERY_ADDRESS,
  type DeliveryAddressDraft,
} from "@/components/delivery-address-fields";
import type { DeliveryAddress } from "@/lib/types";
import { ProductRail, type RailProduct } from "@/components/product-rail";

function addressToDraft(address: DeliveryAddress): DeliveryAddressDraft {
  return {
    label: address.label,
    phone: "phone" in address && typeof address.phone === "string" ? address.phone : "",
    emirate: address.emirate,
    area: address.area,
    street: address.street,
    building: address.building ?? "",
    apartment: address.apartment ?? "",
    notes: address.notes ?? "",
  } as DeliveryAddressDraft;
}

const paymentMethods = [
  { title: "Apple Pay", detail: "Fast checkout on supported devices" },
];

export default function CheckoutPage() {
  const { items, subtotal, removeItem, setQuantity } = useCart();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [form, setForm] = useState<DeliveryAddressDraft>(EMPTY_DELIVERY_ADDRESS);
  const [recommendations, setRecommendations] = useState<RailProduct[]>([]);
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);
  const orderSubtotal = subtotal();
  const smallOrderFee = orderSubtotal < 99 ? 15 : 0;
  const deliveryFee = 7;
  const serviceFee = 3;
  const orderTotal = orderSubtotal + smallOrderFee + deliveryFee + serviceFee;

  useEffect(() => {
    const supabase = createClient();
    const excludedIds = items.map((item) => item.productId);
    let active = true;

    async function loadRecommendations() {
      let request = supabase
        .from("storefront_products")
        .select("id, title, price_aed, compare_at_price_aed, image_urls, stores!inner(slug, is_active)")
        .eq("is_available", true)
        .eq("stores.is_active", true)
        .limit(10);
      if (excludedIds.length > 0) request = request.not("id", "in", `(${excludedIds.join(",")})`);

      const { data } = await request;
      if (!active) return;
      setRecommendations(
        ((data ?? []) as Array<{
          id: string;
          title: string;
          price_aed: number;
          compare_at_price_aed: number | null;
          image_urls: string[];
          stores: { slug: string } | { slug: string }[];
        }>).map((product) => {
          const store = Array.isArray(product.stores) ? product.stores[0] : product.stores;
          return {
            id: product.id,
            title: product.title,
            price_aed: Number(product.price_aed),
            compare_at_price_aed: product.compare_at_price_aed,
            image_urls: product.image_urls,
            href: `/stores/${store?.slug ?? "store"}/products/${product.id}`,
          };
        }),
      );
    }

    void loadRecommendations();
    return () => {
      active = false;
    };
  }, [items]);

  function selectSavedAddress(address: DeliveryAddress) {
    setSelectedAddressId(address.id);
    setForm(addressToDraft(address));
    setSaveAddress(true);
    setMakeDefault(address.is_default);
  }

  function useNewAddress() {
    setSelectedAddressId(null);
    setForm((current) => ({
      ...EMPTY_DELIVERY_ADDRESS,
      emirate: current.emirate,
      label: "",
    }));
    setSaveAddress(true);
    setMakeDefault(savedAddresses.length === 0);
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setAuthed(!!user);
      if (!user) return;

      const { data: addressData } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at");
      const addresses = (addressData ?? []) as DeliveryAddress[];
      setSavedAddresses(addresses);
      const defaultAddress = addresses.find((address) => address.is_default);
      if (defaultAddress) selectSavedAddress(defaultAddress);
      else setMakeDefault(addresses.length === 0);
    });
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="text-muted">Nothing to checkout.</p>
        <Link href="/" className="mt-4 inline-block text-accent-deep underline">
          Browse stores
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
      <div className="min-w-0 space-y-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Your bag</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-display text-4xl text-ink sm:text-5xl">Checkout</h1>
            <p className="pb-1 text-sm text-muted">{items[0]?.storeName} · One boutique per order</p>
          </div>
        </header>

        <section className="border-y border-line py-5 sm:py-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Items in your bag</h2>
              <p className="mt-1 text-xs text-muted">Review your selection before delivery details.</p>
            </div>
            <span className="text-sm text-muted">{items.length} {items.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="mt-5 divide-y divide-line">
            {items.map((item) => {
              const lineId = item.lineId ?? cartLineId(item.productId, item.size, item.variantId);
              return (
                <div key={lineId} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-5 first:pt-0 last:pb-0 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5">
                  <div className="aspect-[4/5] overflow-hidden rounded-md bg-sand">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col justify-between gap-4 py-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl leading-tight text-ink sm:text-2xl">{item.title}</h3>
                        <p className="mt-1.5 text-xs uppercase tracking-[0.12em] text-muted">{item.storeName}</p>
                        {(item.colorName || item.size) ? (
                          <p className="mt-3 text-sm text-ink/80">
                            {[item.colorName, item.size ? `Size ${item.size}` : null].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => removeItem(lineId)} className="border-b border-transparent text-xs font-semibold uppercase tracking-[0.1em] text-muted transition hover:border-ink hover:text-ink">
                        Remove
                      </button>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="inline-flex items-center border border-line">
                        <button type="button" aria-label={`Decrease quantity of ${item.title}`} onClick={() => setQuantity(lineId, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center text-lg transition hover:bg-background">−</button>
                        <span className="flex h-9 min-w-9 items-center justify-center border-x border-line text-sm">{item.quantity}</span>
                        <button type="button" aria-label={`Increase quantity of ${item.title}`} onClick={() => setQuantity(lineId, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center text-lg transition hover:bg-background">+</button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">{formatAed(item.priceAed)} each</p>
                        <p className="mt-1 text-lg font-semibold text-ink">{formatAed(item.priceAed * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-5 border-b border-line pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Delivery</p>
            <h2 className="mt-1 font-display text-3xl text-ink">Where should we send it?</h2>
          </div>

        {authed === false ? (
          <p className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
            <Link href="/auth?next=/checkout" className="underline">
              Sign in
            </Link>{" "}
            to place your order.
          </p>
        ) : null}

        {authed && savedAddresses.length > 0 ? (
          <section className="rounded-xl border border-line bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl text-ink">Saved addresses</h2>
                <p className="mt-0.5 text-xs text-muted">Choose who this order is for.</p>
              </div>
              <button
                type="button"
                onClick={useNewAddress}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/40"
              >
                Use a new address
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {savedAddresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => selectSavedAddress(address)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedAddressId === address.id
                      ? "border-accent bg-[#fff0f4]"
                      : "border-line bg-surface hover:border-ink/30"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {address.label}
                    {address.is_default ? (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white">
                        Default
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {address.street}, {address.area}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <DeliveryAddressFields
          value={form}
          onChange={setForm}
          idPrefix="checkout-delivery-address"
          requireLabel={saveAddress}
        />

        {authed ? (
          <div className="rounded-xl border border-line bg-background px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(event) => setSaveAddress(event.target.checked)}
              />
              Save this address to my account
            </label>
            {saveAddress &&
            !savedAddresses.find((address) => address.id === selectedAddressId)
              ?.is_default ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(event) => setMakeDefault(event.target.checked)}
                />
                Make this my default address
              </label>
            ) : saveAddress ? (
              <p className="mt-2 text-sm text-muted">Using your default address.</p>
            ) : null}
          </div>
        ) : null}

        <section aria-labelledby="payment-heading" className="border-t border-line pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Payment</p>
              <h2 id="payment-heading" className="mt-1 font-display text-3xl text-ink">Pay securely online</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                We are preparing a secure online payment experience for Morni.
              </p>
            </div>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Coming soon
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-expanded={cardDetailsOpen}
              aria-controls="card-payment-details"
              onClick={() => setCardDetailsOpen((open) => !open)}
              className={`rounded-xl border p-4 text-left transition ${
                cardDetailsOpen
                  ? "border-ink bg-background ring-1 ring-ink"
                  : "border-line bg-surface hover:border-ink/40"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">Card</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {cardDetailsOpen ? "Selected" : "Select"}
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">Visa, Mastercard and more</span>
            </button>
            {paymentMethods.map((method) => (
              <div key={method.title} aria-disabled="true" className="rounded-xl border border-line bg-surface p-4 opacity-70">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{method.title}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Soon</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{method.detail}</p>
              </div>
            ))}
          </div>

          {cardDetailsOpen ? (
            <div id="card-payment-details" className="mt-3 rounded-xl border border-line bg-background p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-ink">Card details</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">Your details will be entered securely through our payment partner.</p>
                </div>
                <span className="rounded-full bg-sand px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Preview</span>
              </div>
              <fieldset disabled className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium text-ink">Card number</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234  5678  9012  3456"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-ink">Expiry date</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-ink">Security code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVV"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium text-ink">Name on card</span>
                  <input
                    type="text"
                    autoComplete="cc-name"
                    placeholder="As shown on your card"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              </fieldset>
              <p className="mt-4 text-xs leading-relaxed text-muted">This is a design preview only — do not enter card information. These secure fields will be enabled when the payment provider is connected.</p>
            </div>
          ) : null}

          <p className="mt-4 flex items-center gap-2 text-xs leading-relaxed text-muted">
            <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-[11px] text-ink">✓</span>
            Payment details will be handled by a certified payment provider and never stored by Morni.
          </p>
        </section>
        </section>

      </div>

      <aside className="h-fit border border-line bg-surface p-5 sm:sticky sm:top-24 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Order total</p>
        <h2 className="mt-1 font-display text-3xl text-ink">Price details</h2>
        <div className="mt-6 space-y-3 border-y border-line py-5 text-sm">
          <div className="flex justify-between gap-4"><span className="text-muted">Subtotal</span><span>{formatAed(orderSubtotal)}</span></div>
          {smallOrderFee > 0 ? (
            <div className="flex justify-between gap-4"><span className="text-muted">Small order fee (under AED 99)</span><span>{formatAed(smallOrderFee)}</span></div>
          ) : null}
          <div className="flex justify-between gap-4"><span className="text-muted">Delivery fee</span><span>{formatAed(deliveryFee)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-muted">Service fee</span><span>{formatAed(serviceFee)}</span></div>
        </div>
        <div className="mt-5 flex justify-between gap-4 text-lg font-semibold text-ink">
          <span>Total</span>
          <span>{formatAed(orderTotal)}</span>
        </div>
        <button
          type="button"
          disabled
          className="mt-6 w-full cursor-not-allowed bg-ink px-4 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-white opacity-50"
        >
          Secure payment coming soon
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">Online payment will be required to place this order. Delivery and service fees are included above.</p>
      </aside>
      </div>

      <div className="mt-8 border-t border-line">
        <ProductRail
          id="checkout-recommendations"
          title="Complete your edit"
          subtitle="More pieces that pair well with your selection."
          products={recommendations}
        />
      </div>
    </div>
  );
}
