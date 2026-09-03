"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useLocation, DELIVERY_EMIRATE, DELIVERY_ONLY_MESSAGE, isDeliverableEmirate } from "@/lib/location";
import { calculateCheckoutFees } from "@/lib/fees";
import { formatCustomizationValues } from "@/lib/product-customization";
import {
  FreeDeliveryNudge,
  OrderFeeLines,
} from "@/components/order-fee-summary";
import { DeliverySlotPicker } from "@/components/delivery-slot-picker";
import {
  listBookableDeliverySlots,
  type BookableDeliverySlot,
} from "@/lib/delivery-slots";
import { navigateToPaymentPage } from "@/lib/payment-navigation";

const CHECKOUT_DRAFT_KEY = "morni.checkout.delivery.v1";

function readRememberedAddress(): DeliveryAddressDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeliveryAddressDraft>;
    if (typeof parsed.area !== "string" || typeof parsed.street !== "string") return null;
    return { ...EMPTY_DELIVERY_ADDRESS, ...parsed, emirate: DELIVERY_EMIRATE };
  } catch {
    return null;
  }
}

function addressToDraft(address: DeliveryAddress): DeliveryAddressDraft {
  return {
    label: address.label,
    phone: "phone" in address && typeof address.phone === "string" ? address.phone : "",
    emirate: DELIVERY_EMIRATE,
    area: address.area,
    street: address.street,
    building: address.building ?? "",
    apartment: address.apartment ?? "",
    notes: address.notes ?? "",
  } as DeliveryAddressDraft;
}

/** Matches Tailwind `lg` — mobile checkout sheet is `lg:hidden`. */
function isMobileCheckoutViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, removeItem, setQuantity, clear } = useCart();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [form, setForm] = useState<DeliveryAddressDraft>(EMPTY_DELIVERY_ADDRESS);
  const [recommendations, setRecommendations] = useState<RailProduct[]>([]);
  const [mobileAddressOpen, setMobileAddressOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [deliverySlots, setDeliverySlots] = useState<BookableDeliverySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [paymentMethod, setPaymentMethod] = useState<"card">("card");
  const locationLabel = useLocation((state) => state.label());
  const orderSubtotal = subtotal();
  const fees = calculateCheckoutFees(orderSubtotal);
  const orderTotal = fees.totalAed;
  const selectedAddress = savedAddresses.find(
    (address) => address.id === selectedAddressId,
  );
  const deliverySummary = selectedAddress
    ? [selectedAddress.street, selectedAddress.area].filter(Boolean).join(", ")
    : [form.street, form.area].filter(Boolean).join(", ") || locationLabel;
  const mobileAddressReady = Boolean(
    selectedAddressId || (form.area.trim() && form.street.trim()),
  );
  const selectedSlot = deliverySlots.find((slot) => slot.id === selectedSlotId) ?? null;
  const slotSummary = selectedSlot
    ? `${selectedSlot.dateLabel} · ${selectedSlot.label}`
    : "Select a time";
  const checkoutReady = mobileAddressReady && Boolean(selectedSlot);

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (form.area.trim() || form.street.trim() || form.phone.trim()) {
      window.localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ ...form, emirate: DELIVERY_EMIRATE }));
    }
  }, [form]);

  function resolveAddress(): DeliveryAddressDraft | null {
    if (selectedAddress && isDeliverableEmirate(selectedAddress.emirate)) {
      return addressToDraft(selectedAddress);
    }
    if (form.area.trim() && form.street.trim() && isDeliverableEmirate(form.emirate)) {
      return { ...form, emirate: DELIVERY_EMIRATE };
    }
    return null;
  }

  function promptForAddress(message?: string) {
    if (message) setPlaceError(message);
    // The address sheet is mobile-only (`lg:hidden`). Opening it on desktop
    // still locked body scroll with no visible UI — the page looked frozen.
    if (isMobileCheckoutViewport()) {
      setMobileAddressOpen(true);
      return;
    }
    setMobileAddressOpen(false);
    document.getElementById("checkout-delivery-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function confirmMobileAddress() {
    if (!resolveAddress()) {
      promptForAddress();
      return;
    }
    if (!selectedSlot) {
      setPlaceError("Choose a delivery time slot.");
      return;
    }
    setPlaceError(null);
    setMobileAddressOpen(false);
  }

  async function placeOrder() {
    if (!online) {
      setPlaceError("You are offline. Reconnect before placing your order.");
      return;
    }
    if (authed === false) {
      router.push("/auth?next=/checkout");
      return;
    }
    if (paymentMethod === "card" && !cardPaymentsEnabled) {
      setPlaceError("Online card payments are temporarily unavailable. Please try again later.");
      return;
    }
    if (!legalAccepted) {
      setPlaceError("Please review and accept the Customer Terms & Conditions and Privacy Policy.");
      return;
    }

    const address = resolveAddress();
    if (!address) {
      promptForAddress("Add a delivery area and street before placing this order.");
      return;
    }
    if (!address.phone.trim()) {
      promptForAddress("Add a contact number so the boutique and driver can reach you.");
      return;
    }
    if (!selectedSlot) {
      setPlaceError("Choose a delivery time slot before placing this order.");
      if (isMobileCheckoutViewport()) setMobileAddressOpen(true);
      else {
        document.getElementById("checkout-delivery-slot-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      return;
    }

    setPlacing(true);
    setPlaceError(null);
    try {
      const method = paymentMethod;
      const response = await fetch("/api/orders", {
        method: "POST",
        // Stable for this browser attempt; prevents double orders on retries.
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": window.crypto.randomUUID(),
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            size: item.size ?? null,
            customization: item.customization ?? null,
          })),
          address,
          saveAddress: Boolean(authed && saveAddress && !selectedAddressId),
          makeDefault,
          paymentMethod: method,
          deliverySlot: {
            start: selectedSlot.startIso,
            end: selectedSlot.endIso,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { order?: { id?: string }; next?: string; error?: string }
        | null;
      if (response.status === 401) {
        router.push("/auth?next=/checkout");
        return;
      }
      if (!response.ok || !payload?.order?.id) {
        setPlaceError(payload?.error ?? "Unable to place this order.");
        return;
      }
      clear();
      if (typeof window !== "undefined") window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
      if (payload.next === "pay" || method === "card") {
        // The payment route has a broader frame-src policy for issuer-owned
        // 3DS frames. A client-side transition would retain this document's
        // stricter storefront CSP, so card checkout must load a new document.
        navigateToPaymentPage(payload.order.id);
        return;
      }
      router.push(`/orders/${payload.order.id}`);
    } catch {
      setPlaceError("Unable to place this order.");
    } finally {
      setPlacing(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/payments/afs/config");
        const payload = (await response.json().catch(() => null)) as {
          enabled?: boolean;
        } | null;
        if (!active) return;
        const enabled = Boolean(payload?.enabled);
        setCardPaymentsEnabled(enabled);
      } catch {
        if (active) setCardPaymentsEnabled(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
    if (!isDeliverableEmirate(address.emirate)) return;
    setSelectedAddressId(address.id);
    setForm(addressToDraft(address));
    setSaveAddress(true);
    setMakeDefault(address.is_default);
  }

  function useNewAddress() {
    setSelectedAddressId(null);
    setForm({
      ...EMPTY_DELIVERY_ADDRESS,
      emirate: DELIVERY_EMIRATE,
      label: "",
    });
    setSaveAddress(true);
    setMakeDefault(savedAddresses.length === 0);
    if (isMobileCheckoutViewport()) setMobileAddressOpen(true);
  }

  function openMobileAddress() {
    if (isMobileCheckoutViewport()) setMobileAddressOpen(true);
  }

  useEffect(() => {
    if (!mobileAddressOpen) return;

    // Never lock scroll when the sheet isn't actually shown (desktop / lg+).
    if (!isMobileCheckoutViewport()) {
      if (typeof queueMicrotask === "function") queueMicrotask(() => setMobileAddressOpen(false));
      else window.setTimeout(() => setMobileAddressOpen(false), 0);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const media = window.matchMedia("(max-width: 1023px)");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileAddressOpen(false);
    };
    const closeIfDesktop = () => {
      if (!media.matches) setMobileAddressOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    media.addEventListener("change", closeIfDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      media.removeEventListener("change", closeIfDesktop);
    };
  }, [mobileAddressOpen]);

  useEffect(() => {
    function refreshSlots() {
      const nextSlots = listBookableDeliverySlots();
      setDeliverySlots(nextSlots);
      setSelectedSlotId((current) => {
        if (current && nextSlots.some((slot) => slot.id === current)) return current;
        return nextSlots[0]?.id ?? null;
      });
    }

    refreshSlots();
    const interval = window.setInterval(refreshSlots, 60_000);
    return () => window.clearInterval(interval);
  }, []);

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
      const defaultAddress =
        addresses.find((address) => address.is_default && isDeliverableEmirate(address.emirate)) ??
        addresses.find((address) => isDeliverableEmirate(address.emirate));
      if (defaultAddress) selectSavedAddress(defaultAddress);
      else {
        const remembered = readRememberedAddress();
        if (remembered) setForm(remembered);
        setMakeDefault(addresses.length === 0);
      }
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
    <>
      {!online ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900" role="status">
          You are offline. Your address is saved on this device; reconnect before placing the order.
        </div>
      ) : null}
      <div className="lg:hidden">
        <div className="mx-auto max-w-lg px-4 pb-6 pt-5">
          <header className="flex items-end justify-between gap-4 border-b border-line pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">Your bag</p>
              <h1 className="mt-1 font-display text-3xl text-ink">Cart</h1>
            </div>
            <p className="max-w-40 text-right text-xs leading-relaxed text-muted">
              {items.length} {items.length === 1 ? "piece" : "pieces"} from {items[0]?.storeName}
            </p>
          </header>

          <section aria-labelledby="mobile-cart-items" className="py-2">
            <h2 id="mobile-cart-items" className="sr-only">Items in your bag</h2>
            <div className="divide-y divide-line">
              {items.map((item) => {
                const lineId = item.lineId ?? cartLineId(item.productId, item.size, item.variantId);
                return (
                  <article key={lineId} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-4">
                    <div className="aspect-[4/5] overflow-hidden rounded-xl bg-sand">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{item.title}</h3>
                          {(item.colorName || item.size || item.customization) ? (
                            <p className="mt-1 text-xs text-muted">
                              {[item.colorName, item.size ? `Size ${item.size}` : null, item.customization ? `Custom: ${formatCustomizationValues(null, item.customization).map((measurement) => `${measurement.label} ${measurement.value}`).join(", ")}` : null].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(lineId)}
                          className="shrink-0 p-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted transition hover:text-accent-deep"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                        <div className="inline-flex items-center rounded-lg border border-line bg-surface">
                          <button type="button" aria-label={`Decrease quantity of ${item.title}`} onClick={() => setQuantity(lineId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-lg">−</button>
                          <input aria-label={`Quantity of ${item.title}`} inputMode="numeric" type="number" min="1" max="99" value={item.quantity} onChange={(event) => setQuantity(lineId, Math.max(1, Math.min(99, Number(event.target.value) || 1)))} className="h-8 w-10 border-x border-line bg-transparent text-center text-xs font-semibold outline-none" />
                          <button type="button" aria-label={`Increase quantity of ${item.title}`} onClick={() => setQuantity(lineId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center text-lg">+</button>
                        </div>
                        <p className="text-sm font-semibold text-ink">{formatAed(item.priceAed * item.quantity)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="mobile-price-details" className="border-t border-line py-6">
            <FreeDeliveryNudge fees={fees} />
            <div className="flex items-center justify-between gap-4">
              <h2 id="mobile-price-details" className="text-base font-semibold uppercase tracking-[0.08em] text-ink">Price details</h2>
              <span className="text-sm font-semibold text-ink">{formatAed(orderTotal)}</span>
            </div>
            <div className="mt-4"><OrderFeeLines fees={fees} /></div>
            <div className="mt-4 flex justify-between border-t border-line pt-4 text-base font-semibold text-ink"><span>Grand total</span><span>{formatAed(orderTotal)}</span></div>
          </section>
        </div>

        <div className="pb-40">
          <ProductRail
            id="checkout-mobile-recommendations"
            title="Complete your edit"
            subtitle="Pieces chosen to pair with your bag."
            products={recommendations}
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 shadow-[0_-12px_30px_-22px_rgba(28,20,24,0.65)] lg:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          <div className="mx-auto max-w-lg space-y-3">
            <button
              type="button"
              onClick={openMobileAddress}
              aria-expanded={mobileAddressOpen}
              aria-controls="mobile-address-sheet"
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-ink" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
                  <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-deep">Deliver to</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{selectedAddress?.label ?? locationLabel}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{deliverySummary}</span>
                <span className="mt-1 block truncate text-xs font-medium text-ink">{slotSummary}</span>
              </span>
              <span className="shrink-0 border-b border-ink text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">Change</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <label className={`rounded-lg border px-3 py-2 text-xs font-semibold ${paymentMethod === "card" ? "border-ink bg-background text-ink" : "border-line bg-white text-muted"}`}><input type="radio" name="mobile-payment-method" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} disabled={!cardPaymentsEnabled} className="mr-1.5 accent-[#21342e]" />Card {cardPaymentsEnabled ? "payment" : "(unavailable)"}</label>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-[#c8d1cc] bg-white px-3 py-3 text-xs leading-5 text-[#4d5c56] shadow-sm">
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(event) => setLegalAccepted(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 appearance-auto accent-[#21342e]"
                aria-label="Agree to the Customer Terms and Conditions and Privacy Policy"
              />
              <span>
                I agree to the <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">Customer Terms &amp; Conditions</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">Privacy Policy</Link>.
              </span>
            </label>
            {placeError ? <p className="text-center text-xs leading-relaxed text-accent-deep">{placeError}</p> : null}
            <button type="button" onClick={() => void placeOrder()} disabled={placing || (paymentMethod === "card" && !cardPaymentsEnabled) || !legalAccepted || !online} className="min-h-12 w-full rounded-lg bg-ink px-4 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-white transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50">
              {placing
                ? "Starting payment..."
                : paymentMethod === "card" && !cardPaymentsEnabled
                  ? "Card payments unavailable"
                : authed === false
                  ? "Sign in to place order"
                  : checkoutReady
                    ? "Continue to payment"
                    : !mobileAddressReady
                      ? "Select address to continue"
                      : "Select delivery time"}
            </button>
          </div>
        </div>

        {mobileAddressOpen ? (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button
              type="button"
              aria-label="Close delivery address picker"
              onClick={() => setMobileAddressOpen(false)}
              className="absolute inset-0 bg-ink/45"
            />
            <section
              id="mobile-address-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-address-sheet-title"
              className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-surface shadow-[0_-18px_50px_-20px_rgba(28,20,24,0.65)]"
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
              <header className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 id="mobile-address-sheet-title" className="text-base font-semibold uppercase tracking-[0.08em] text-ink">
                  Delivery details
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setMobileAddressOpen(false)}
                  className="grid h-9 w-9 place-items-center text-2xl font-light text-ink"
                >
                  ×
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {authed === null ? (
                  <p className="py-8 text-center text-sm text-muted">Loading delivery addresses...</p>
                ) : null}

                {authed === false ? (
                  <p className="mb-5 rounded-xl bg-[#fff0f4] px-3 py-3 text-sm leading-relaxed text-accent-deep">
                    <Link href="/auth?next=/checkout" className="font-semibold underline underline-offset-4">Sign in</Link> to save an address and place your order.
                  </p>
                ) : null}

                {authed && savedAddresses.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">Saved addresses</p>
                      <button type="button" onClick={useNewAddress} className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-deep">
                        + Add new
                      </button>
                    </div>
                    {savedAddresses.map((address) => {
                      const selected = selectedAddressId === address.id;
                      const deliverable = isDeliverableEmirate(address.emirate);
                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => selectSavedAddress(address)}
                          disabled={!deliverable}
                          className={`flex w-full items-start gap-3 border p-4 text-left transition ${selected ? "border-ink bg-background ring-1 ring-ink" : "border-line bg-surface"} ${deliverable ? "" : "cursor-not-allowed opacity-55"}`}
                        >
                          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-ink" : "border-line"}`} aria-hidden="true">
                            {selected ? <span className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                              {address.label}
                              {address.is_default ? <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">Default</span> : null}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted">{address.street}, {address.area}</span>
                            {!deliverable ? <span className="mt-1 block text-xs text-accent-deep">{DELIVERY_ONLY_MESSAGE}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {!selectedAddressId && authed !== null ? (
                  <div className={savedAddresses.length > 0 ? "mt-6 border-t border-line pt-5" : ""}>
                    <p className="mb-4 text-sm font-semibold text-ink">Enter your delivery address</p>
                    <DeliveryAddressFields value={form} onChange={setForm} idPrefix="checkout-mobile-delivery-address" requireLabel={saveAddress} />
                  </div>
                ) : null}

                <div className="mt-6 border-t border-line pt-5">
                  <p className="mb-1 text-sm font-semibold text-ink">Delivery time</p>
                  <p className="mb-4 text-xs text-muted">Same-day slots until 6:30 PM. Later bookings move to tomorrow.</p>
                  <DeliverySlotPicker
                    slots={deliverySlots}
                    selectedId={selectedSlotId}
                    onSelect={(slot) => setSelectedSlotId(slot.id)}
                    idPrefix="checkout-mobile-delivery-slot"
                  />
                </div>
              </div>

              <footer className="border-t border-line bg-surface px-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
                <button
                  type="button"
                  disabled={!checkoutReady || !online}
                  onClick={confirmMobileAddress}
                  className="w-full bg-ink px-4 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {!mobileAddressReady
                    ? "Select address"
                    : !selectedSlot
                      ? "Select delivery time"
                      : "Deliver here"}
                </button>
              </footer>
            </section>
          </div>
        ) : null}
      </div>

    <div className="hidden lg:block">
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
                        {(item.colorName || item.size || item.customization) ? (
                          <p className="mt-3 text-sm text-ink/80">
                            {[item.colorName, item.size ? `Size ${item.size}` : null, item.customization ? `Custom: ${formatCustomizationValues(null, item.customization).map((measurement) => `${measurement.label} ${measurement.value}`).join(", ")}` : null].filter(Boolean).join(" · ")}
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
                        <input aria-label={`Quantity of ${item.title}`} inputMode="numeric" type="number" min="1" max="99" value={item.quantity} onChange={(event) => setQuantity(lineId, Math.max(1, Math.min(99, Number(event.target.value) || 1)))} className="h-9 w-11 border-x border-line bg-transparent text-center text-sm outline-none" />
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

        <section id="checkout-delivery-section" className="space-y-5 border-b border-line pb-8">
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
              {savedAddresses.map((address) => {
                const deliverable = isDeliverableEmirate(address.emirate);
                return (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => selectSavedAddress(address)}
                  disabled={!deliverable}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedAddressId === address.id
                      ? "border-accent bg-[#fff0f4]"
                      : "border-line bg-surface"
                  } ${deliverable ? "hover:border-ink/30" : "cursor-not-allowed opacity-55"}`}
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
                  {!deliverable ? (
                    <span className="mt-1 block text-xs text-accent-deep">{DELIVERY_ONLY_MESSAGE}</span>
                  ) : null}
                </button>
                );
              })}
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

        <section id="checkout-delivery-slot-section" className="space-y-3 border-t border-line pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">When</p>
            <h2 className="mt-1 font-display text-3xl text-ink">Choose a delivery window</h2>
            <p className="mt-1 text-sm text-muted">
              Same-day booking closes at 6:30 PM. After that, tomorrow&apos;s slots open.
            </p>
          </div>
          <DeliverySlotPicker
            slots={deliverySlots}
            selectedId={selectedSlotId}
            onSelect={(slot) => setSelectedSlotId(slot.id)}
            idPrefix="checkout-desktop-delivery-slot"
          />
        </section>

        <section aria-labelledby="payment-heading" className="border-t border-line pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Payment</p>
          <h2 id="payment-heading" className="mt-1 font-display text-3xl text-ink">Choose payment method</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border px-4 py-3 ${paymentMethod === "card" ? "border-ink bg-background" : "border-line bg-surface"}`}><input type="radio" name="payment-method" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} disabled={!cardPaymentsEnabled} className="mr-2 accent-[#21342e]" /> <span className="text-sm font-semibold text-ink">Card payment</span><span className="mt-1 block pl-6 text-xs text-muted">{cardPaymentsEnabled ? "Pay securely online." : "Temporarily unavailable."}</span></label>
          </div>
        </section>
        </section>

      </div>

      <aside className="h-fit border border-line bg-surface p-5 sm:sticky sm:top-24 sm:p-6">
        <FreeDeliveryNudge fees={fees} />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">Order total</p>
        <h2 className="mt-1 font-display text-3xl text-ink">Price details</h2>
        <div className="mt-6 border-y border-line py-5"><OrderFeeLines fees={fees} /></div>
        <div className="mt-5 flex justify-between gap-4 text-lg font-semibold text-ink">
          <span>Total</span>
          <span>{formatAed(orderTotal)}</span>
        </div>
        <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-muted">
          <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 appearance-auto accent-[#21342e]" aria-label="Agree to the Customer Terms and Conditions and Privacy Policy" />
          <span>I have read and agree to the <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">Customer Terms &amp; Conditions</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">Privacy Policy</Link>.</span>
        </label>
        {placeError ? <p className="mt-4 text-center text-xs leading-relaxed text-accent-deep">{placeError}</p> : null}
        <button
          type="button"
          disabled={placing || (paymentMethod === "card" && !cardPaymentsEnabled) || !legalAccepted || !online || (!checkoutReady && authed !== false)}
          onClick={() => void placeOrder()}
          className="mt-6 w-full bg-ink px-4 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing
            ? "Starting payment..."
            : paymentMethod === "card" && !cardPaymentsEnabled
              ? "Card payments unavailable"
            : authed === false
              ? "Sign in to place order"
              : checkoutReady
                ? "Continue to payment"
                : !mobileAddressReady
                  ? "Select address to continue"
                  : "Select delivery time"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          You will enter card details on AFS’s secure form next.
        </p>
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
    </div>
    </>
  );
}
