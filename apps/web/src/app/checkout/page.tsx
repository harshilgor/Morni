"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart";
import { EMIRATES, formatAed } from "@/lib/format";
import type { UaeEmirate } from "@/lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    emirate: "dubai" as UaeEmirate,
    area: "",
    street: "",
    building: "",
    apartment: "",
    notes: "",
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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

    const storeId = items[0].storeId;
    const orderSubtotal = subtotal();
    const deliveryFee = 0;
    const total = orderSubtotal + deliveryFee;

    const { data: store } = await supabase
      .from("stores")
      .select("delivery_eta_minutes")
      .eq("id", storeId)
      .single();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        shopper_id: user.id,
        store_id: storeId,
        status: "placed",
        payment_method: "cod",
        payment_status: "pending",
        subtotal_aed: orderSubtotal,
        delivery_fee_aed: deliveryFee,
        total_aed: total,
        delivery_emirate: form.emirate,
        delivery_area: form.area,
        delivery_street: form.street,
        delivery_building: form.building || null,
        delivery_apartment: form.apartment || null,
        delivery_notes: form.notes || null,
        delivery_eta_minutes: store?.delivery_eta_minutes ?? 60,
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      setError(orderError?.message ?? "Could not place order.");
      setLoading(false);
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        title: item.title,
        unit_price_aed: item.priceAed,
        quantity: item.quantity,
        line_total_aed: item.priceAed * item.quantity,
      })),
    );

    if (itemsError) {
      setError(itemsError.message);
      setLoading(false);
      return;
    }

    clear();
    router.push(`/orders/${order.id}`);
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
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form onSubmit={onSubmit} className="space-y-5 rounded-[1.5rem] border border-line bg-surface p-6">
        <div>
          <h1 className="font-display text-3xl text-ink">Checkout</h1>
          <p className="mt-1 text-sm text-muted">
            Pay on delivery · gateway support coming later
          </p>
        </div>

        {authed === false ? (
          <p className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
            <Link href="/auth?next=/checkout" className="underline">
              Sign in
            </Link>{" "}
            to place your order.
          </p>
        ) : null}

        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Emirate</span>
          <select
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={form.emirate}
            onChange={(e) =>
              setForm((f) => ({ ...f, emirate: e.target.value as UaeEmirate }))
            }
            required
          >
            {EMIRATES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>

        {(
          [
            ["area", "Area / neighbourhood", true],
            ["street", "Street", true],
            ["building", "Building", false],
            ["apartment", "Apartment / villa", false],
          ] as const
        ).map(([key, label, required]) => (
          <label key={key} className="block space-y-1.5 text-sm">
            <span className="text-muted">{label}</span>
            <input
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              required={required}
            />
          </label>
        ))}

        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Delivery notes</span>
          <textarea
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>

        <div className="rounded-xl border border-line bg-background px-4 py-3 text-sm">
          <p className="font-medium text-ink">Payment</p>
          <p className="mt-1 text-muted">
            Cash / card on delivery. Online payments will be added after infrastructure.
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-mint">
            payment_method = cod · payment_status = pending
          </p>
        </div>

        {error ? <p className="text-sm text-accent-deep">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || authed === false}
          className="w-full rounded-full bg-ink py-3 text-sm text-white transition hover:bg-accent-deep disabled:opacity-50"
        >
          {loading ? "Placing order…" : `Place order · ${formatAed(subtotal())}`}
        </button>
      </form>

      <aside className="h-fit rounded-[1.5rem] border border-line bg-surface p-6">
        <h2 className="font-display text-2xl">Order summary</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span>
                {item.title} × {item.quantity}
              </span>
              <span>{formatAed(item.priceAed * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Delivery</span>
            <span className="text-mint">Within 1 hour · AED 0</span>
          </div>
          <div className="mt-2 flex justify-between font-medium">
            <span>Total</span>
            <span>{formatAed(subtotal())}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
