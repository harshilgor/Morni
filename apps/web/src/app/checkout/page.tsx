"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear, removeItem, setQuantity } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [form, setForm] = useState<DeliveryAddressDraft>(EMPTY_DELIVERY_ADDRESS);
  const [recommendations, setRecommendations] = useState<RailProduct[]>([]);

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

  async function persistAddress(userId: string) {
    if (!saveAddress) return true;
    if (!form.label.trim()) {
      setError("Give this address a name before saving it.");
      return false;
    }

    const supabase = createClient();
    const payload = {
      label: form.label.trim(),
      emirate: form.emirate,
      area: form.area.trim(),
      street: form.street.trim(),
      building: form.building.trim() || null,
      apartment: form.apartment.trim() || null,
      notes: form.notes.trim() || null,
      is_default: makeDefault,
    };
    const request = selectedAddressId
      ? supabase.from("addresses").update(payload).eq("id", selectedAddressId)
      : supabase.from("addresses").insert({ user_id: userId, ...payload });
    const { error: saveError } = await request;
    if (saveError) {
      setError(saveError.message);
      return false;
    }
    return true;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please sign in to place an order.");
      setLoading(false);
      router.push("/auth?next=/checkout");
      return;
    }

    const addressSaved = await persistAddress(user.id);
    if (!addressSaved) {
      setLoading(false);
      return;
    }

    const storeId = items[0].storeId;
    const orderSubtotal = subtotal();
    const deliveryFee = 0;
    const total = orderSubtotal + deliveryFee;

    const { data: store } = await supabase
      .from("stores")
      .select("delivery_eta_minutes")
      .eq("id", storeId)
      .single();

    const { data: order, error: orderError } = await supabase.rpc(
      "place_order_with_items",
      {
        p_store_id: storeId,
        p_payment_method: "cod",
        p_subtotal_aed: orderSubtotal,
        p_delivery_fee_aed: deliveryFee,
        p_total_aed: total,
        p_delivery_emirate: form.emirate,
        p_delivery_area: form.area.trim(),
        p_delivery_street: form.street.trim(),
        p_delivery_building: form.building.trim() || null,
        p_delivery_apartment: form.apartment.trim() || null,
        p_delivery_notes: form.notes.trim() || null,
        p_delivery_eta_minutes: store?.delivery_eta_minutes ?? 60,
        p_items: items.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          title: item.title,
          size: item.size || null,
          color_name: item.colorName || null,
          unit_price_aed: item.priceAed,
          quantity: item.quantity,
        })),
      },
    );

    if (orderError || !order) {
      setError(orderError?.message ?? "Could not place order.");
      setLoading(false);
      return;
    }

    clear();
    router.push(`/orders/${(order as { id: string }).id}`);
  }

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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
      <form onSubmit={onSubmit} className="space-y-5 rounded-[1.5rem] border border-line bg-surface p-4 sm:p-6">
        <div>
          <h1 className="font-display text-3xl text-ink">Checkout</h1>
          <p className="mt-1 text-sm text-muted">
            Pay on delivery - gateway support coming later
          </p>
        </div>

        <section className="border-b border-line pb-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Your items</h2>
              <p className="mt-1 text-xs text-muted">Review each piece before placing your order.</p>
            </div>
            <span className="text-sm text-muted">{items.length} {items.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="mt-4 divide-y divide-line">
            {items.map((item) => {
              const lineId = item.lineId ?? cartLineId(item.productId, item.size, item.variantId);
              return (
                <div key={lineId} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                  <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-sand sm:h-32 sm:w-28">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-ink">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted">{item.storeName}</p>
                        {(item.colorName || item.size) ? (
                          <p className="mt-2 text-xs font-medium text-accent-deep">
                            {[item.colorName, item.size ? `Size ${item.size}` : null].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => removeItem(lineId)} className="text-xs text-muted hover:text-ink">
                        Remove
                      </button>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Decrease quantity of ${item.title}`} onClick={() => setQuantity(lineId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg">−</button>
                        <span className="min-w-5 text-center text-sm">{item.quantity}</span>
                        <button type="button" aria-label={`Increase quantity of ${item.title}`} onClick={() => setQuantity(lineId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg">+</button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">{formatAed(item.priceAed)} each</p>
                        <p className="mt-1 font-medium text-ink">{formatAed(item.priceAed * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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

        <div className="rounded-xl border border-line bg-background px-4 py-3 text-sm">
          <p className="font-medium text-ink">Payment</p>
          <p className="mt-1 text-muted">
            Cash / card on delivery. Online payments will be added after infrastructure.
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-mint">
            Payment on delivery
          </p>
        </div>

        {error ? <p className="text-sm text-accent-deep">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || authed === false}
          className="w-full rounded-full bg-ink py-3 text-sm text-white transition hover:bg-accent-deep disabled:opacity-50"
        >
          {loading ? "Placing order..." : `Place order - ${formatAed(subtotal())}`}
        </button>
      </form>

      <aside className="h-fit rounded-[1.5rem] border border-line bg-surface p-4 sm:sticky sm:top-24 sm:p-6">
        <h2 className="font-display text-2xl">Order summary</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li
              key={
                item.lineId ??
                `${item.productId}:${item.variantId ?? "default"}:${item.size ?? "one-size"}`
              }
              className="flex justify-between gap-3"
            >
              <span>
                {item.title}
                {item.colorName ? ` - ${item.colorName}` : ""}
                {item.size ? ` - Size ${item.size}` : ""} x {item.quantity}
              </span>
              <span>{formatAed(item.priceAed * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line pt-4 text-sm">
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatAed(subtotal())}</span>
          </div>
        </div>
      </aside>
      </div>

      <ProductRail
        id="checkout-recommendations"
        title="You may also like"
        subtitle="Complete your order with more pieces from Morni boutiques."
        products={recommendations}
      />
    </div>
  );
}
