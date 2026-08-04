"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  promo_type: "percent_off" | "bogo" | "flat_off" | "category_sale";
  value_aed: number | null;
  value_percent: number | null;
  category_slug: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

const promoTypeLabels: Record<Promotion["promo_type"], string> = {
  percent_off: "% Off",
  bogo: "Buy 1 Get 1",
  flat_off: "Flat AED Off",
  category_sale: "Category Sale",
};

export default function PortalPromotionsPage() {
  const { store, loading, error } = useOwnerStore();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    promo_type: "percent_off" as Promotion["promo_type"],
    value_percent: "",
    value_aed: "",
    category_slug: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
  });

  useEffect(() => {
    if (!store) return;
    loadPromotions(store.id);
  }, [store]);

  async function loadPromotions(storeId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("store_promotions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setPromotions((data as Promotion[]) ?? []);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error: createErr } = await supabase.from("store_promotions").insert({
      store_id: store.id,
      title: form.title,
      description: form.description || null,
      promo_type: form.promo_type,
      value_percent: form.value_percent ? Number(form.value_percent) : null,
      value_aed: form.value_aed ? Number(form.value_aed) : null,
      category_slug: form.category_slug || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: form.is_active,
    });
    setSaving(false);
    if (createErr) {
      setMessage(createErr.message);
      return;
    }
    setForm({
      title: "",
      description: "",
      promo_type: "percent_off",
      value_percent: "",
      value_aed: "",
      category_slug: "",
      starts_at: "",
      ends_at: "",
      is_active: true,
    });
    await loadPromotions(store.id);
  }

  async function togglePromotion(promo: Promotion) {
    const supabase = createClient();
    await supabase
      .from("store_promotions")
      .update({ is_active: !promo.is_active })
      .eq("id", promo.id);
    if (store) await loadPromotions(store.id);
  }

  async function removePromotion(promo: Promotion) {
    const supabase = createClient();
    await supabase.from("store_promotions").delete().eq("id", promo.id);
    if (store) await loadPromotions(store.id);
  }

  if (error === "unauthenticated") {
    return (
      <Link href="/auth?next=/portal/promotions" className="text-accent-deep underline">
        Sign in
      </Link>
    );
  }
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) {
    return (
      <p className="text-muted">
        Set up a store first from <Link href="/portal/settings" className="text-accent-deep underline">Store settings</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Promotions</h1>
        <p className="mt-1 text-sm text-muted">
          Create timed offers and category sales for your store.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-[1.5rem] border border-line bg-surface p-5 sm:grid-cols-2"
      >
        <h2 className="font-medium sm:col-span-2">Create promotion</h2>
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="Title (e.g. Flat 20% on Kurtis)"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <select
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          value={form.promo_type}
          onChange={(e) =>
            setForm((f) => ({ ...f, promo_type: e.target.value as Promotion["promo_type"] }))
          }
        >
          <option value="percent_off">% Off</option>
          <option value="flat_off">Flat AED Off</option>
          <option value="bogo">Buy 1 Get 1</option>
          <option value="category_sale">Category Sale</option>
        </select>
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="Percent value (e.g. 20)"
          type="number"
          min="0"
          step="0.1"
          value={form.value_percent}
          onChange={(e) => setForm((f) => ({ ...f, value_percent: e.target.value }))}
        />
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="AED value (e.g. 30)"
          type="number"
          min="0"
          step="0.01"
          value={form.value_aed}
          onChange={(e) => setForm((f) => ({ ...f, value_aed: e.target.value }))}
        />
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="Category slug (optional)"
          value={form.category_slug}
          onChange={(e) => setForm((f) => ({ ...f, category_slug: e.target.value }))}
        />
        <label className="rounded-xl border border-line bg-background px-3 py-2 text-sm text-muted">
          Starts at
          <input
            type="datetime-local"
            className="mt-1 w-full bg-transparent text-ink"
            value={form.starts_at}
            onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
          />
        </label>
        <label className="rounded-xl border border-line bg-background px-3 py-2 text-sm text-muted">
          Ends at
          <input
            type="datetime-local"
            className="mt-1 w-full bg-transparent text-ink"
            value={form.ends_at}
            onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active now
        </label>
        <textarea
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm sm:col-span-2"
          rows={2}
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-5 py-2.5 text-sm text-white sm:col-span-2 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Create promotion"}
        </button>
        {message ? (
          <p className="text-sm text-accent-deep sm:col-span-2">{message}</p>
        ) : null}
      </form>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-xl text-ink">Current promotions</h2>
        {promotions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No promotions yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {promotions.map((promo) => (
              <li
                key={promo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/70 p-3"
              >
                <div>
                  <p className="font-medium text-ink">{promo.title}</p>
                  <p className="text-xs text-muted">
                    {promoTypeLabels[promo.promo_type]}
                    {promo.value_percent ? ` · ${promo.value_percent}%` : ""}
                    {promo.value_aed ? ` · AED ${promo.value_aed}` : ""}
                    {promo.category_slug ? ` · ${promo.category_slug}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePromotion(promo)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs"
                  >
                    {promo.is_active ? "Active" : "Paused"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePromotion(promo)}
                    className="text-xs text-accent-deep"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

