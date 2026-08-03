"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import {
  StoreLocationFields,
  type StoreLocationValue,
} from "@/components/store-location-fields";
import { useOwnerStore } from "@/lib/use-owner-store";

type Step = 1 | 2 | 3;

export default function SellSetupPage() {
  const router = useRouter();
  const { store, loading, error, userId, refresh } = useOwnerStore();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<StoreLocationValue>({
    emirate: "dubai",
    area: "",
    address: "",
    lat: null,
    lng: null,
  });

  const [eta, setEta] = useState("60");
  const [opensAt, setOpensAt] = useState("10:00");
  const [closesAt, setClosesAt] = useState("22:00");

  const [productTitle, setProductTitle] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("10");
  const [createdStoreId, setCreatedStoreId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && store) {
      router.replace("/portal");
    }
  }, [loading, store, router]);

  async function ensureOwnerRole(uid: string) {
    const supabase = createClient();
    await supabase.from("profiles").update({ role: "store_owner" }).eq("id", uid);
  }

  async function saveStoreBasics(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!location.area.trim() || !location.address.trim()) {
      setMessage("Add your area and exact street address.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    await ensureOwnerRole(userId);

    const baseSlug = slugify(name) || `store-${Date.now()}`;
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error: err } = await supabase
      .from("stores")
      .insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        emirate: location.emirate,
        area: location.area.trim(),
        address: location.address.trim(),
        lat: location.lat,
        lng: location.lng,
        is_active: true,
        delivery_eta_minutes: Number(eta) || 60,
        opens_at: opensAt,
        closes_at: closesAt,
      })
      .select("id")
      .single();

    if (err || !data) {
      setMessage(err?.message ?? "Could not create store.");
      setBusy(false);
      return;
    }

    const { error: memberError } = await supabase.from("store_members").insert({
      store_id: data.id,
      user_id: userId,
    });

    if (memberError) {
      setMessage(memberError.message);
      setBusy(false);
      return;
    }

    setCreatedStoreId(data.id);
    setBusy(false);
    setStep(2);
  }

  async function saveDelivery(e: FormEvent) {
    e.preventDefault();
    if (!createdStoreId) {
      setStep(3);
      return;
    }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("stores")
      .update({
        delivery_eta_minutes: Number(eta) || 60,
        opens_at: opensAt,
        closes_at: closesAt,
        area: location.area.trim(),
        address: location.address.trim(),
        emirate: location.emirate,
        lat: location.lat,
        lng: location.lng,
      })
      .eq("id", createdStoreId);

    setBusy(false);
    if (err) {
      setMessage(err.message);
      return;
    }
    setStep(3);
  }

  async function saveFirstProduct(e: FormEvent) {
    e.preventDefault();
    if (!createdStoreId) {
      await refresh();
      router.push("/portal");
      return;
    }

    if (productTitle.trim() && productPrice) {
      setBusy(true);
      setMessage(null);
      const supabase = createClient();
      const { error: err } = await supabase.from("products").insert({
        store_id: createdStoreId,
        title: productTitle.trim(),
        price_aed: Number(productPrice),
        stock: Number(productStock) || 0,
        is_available: true,
        image_urls: [],
      });
      setBusy(false);
      if (err) {
        setMessage(err.message);
        return;
      }
    }

    await refresh();
    router.push("/portal");
  }

  async function skipProduct() {
    await refresh();
    router.push("/portal");
  }

  if (error === "unauthenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl text-ink">Sign in to sell on Morni</h1>
        <p className="mt-2 text-sm text-muted">
          Create a seller account, then finish your store setup.
        </p>
        <Link
          href="/auth?next=/sell/setup&role=store_owner"
          className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
        >
          Sign in / Sign up
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-muted">Loading setup…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-deep">
        Store setup · Step {step} of 3
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
        {step === 1 && "Tell us about your boutique"}
        {step === 2 && "Delivery & opening hours"}
        {step === 3 && "Add your first product"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {step === 1 && "This is what shoppers see on Morni."}
        {step === 2 && "Defaults to delivery within 1 hour across your area."}
        {step === 3 && "Optional — you can add more later in the portal."}
      </p>

      <div className="mt-6 flex gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>

      {step === 1 ? (
        <form onSubmit={saveStoreBasics} className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Store name</span>
            <input
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Short description</span>
            <textarea
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <StoreLocationFields value={location} onChange={setLocation} />
          {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form onSubmit={saveDelivery} className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Delivery ETA (minutes)</span>
            <input
              type="number"
              min={15}
              max={180}
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Opens</span>
              <input
                type="time"
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Closes</span>
              <input
                type="time"
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </label>
          </div>
          {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === 3 ? (
        <form onSubmit={saveFirstProduct} className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Product title</span>
            <input
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={productTitle}
              onChange={(e) => setProductTitle(e.target.value)}
              placeholder="e.g. Satin Slip Dress"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Price AED</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Stock</span>
              <input
                type="number"
                min="0"
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                value={productStock}
                onChange={(e) => setProductStock(e.target.value)}
              />
            </label>
          </div>
          {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Finish & open portal"}
          </button>
          <button
            type="button"
            onClick={skipProduct}
            className="w-full rounded-full border border-line py-3 text-sm text-ink"
          >
            Skip for now
          </button>
        </form>
      ) : null}
    </div>
  );
}
