"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import {
  StoreLocationFields,
  type StoreLocationValue,
} from "@/components/store-location-fields";

export default function PortalSettingsPage() {
  const { store, loading, error, refresh } = useOwnerStore();
  const [form, setForm] = useState({
    name: "",
    description: "",
    delivery_eta_minutes: "60",
    opens_at: "10:00",
    closes_at: "22:00",
    is_active: true,
    pause_note: "",
  });
  const [location, setLocation] = useState<StoreLocationValue>({
    emirate: "dubai",
    area: "",
    address: "",
    lat: null,
    lng: null,
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    const syncFromStore = () => {
      setForm({
        name: store.name,
        description: store.description ?? "",
        delivery_eta_minutes: String(store.delivery_eta_minutes),
        opens_at: store.opens_at?.slice(0, 5) ?? "10:00",
        closes_at: store.closes_at?.slice(0, 5) ?? "22:00",
        is_active: store.is_active,
        pause_note: store.pause_note ?? "",
      });
      setLocation({
        emirate: store.emirate,
        area: store.area,
        address: store.address,
        lat: store.lat,
        lng: store.lng,
      });
    };
    if (typeof queueMicrotask === "function") queueMicrotask(syncFromStore);
    else window.setTimeout(syncFromStore, 0);
  }, [store]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    if (!location.area.trim() || !location.address.trim()) {
      setMessage("Add your area and exact street address.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    let logo_url = store.logo_url;
    if (logo) {
      const path = `${store.id}/logo-${Date.now()}-${logo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("store-logos")
        .upload(path, logo, { upsert: true });
      if (uploadError) {
        setMessage(uploadError.message);
        setSaving(false);
        return;
      }
      logo_url = supabase.storage.from("store-logos").getPublicUrl(path).data
        .publicUrl;
    }

    const { error: updateError } = await supabase
      .from("stores")
      .update({
        name: form.name,
        description: form.description || null,
        emirate: location.emirate,
        area: location.area.trim(),
        address: location.address.trim(),
        lat: location.lat,
        lng: location.lng,
        delivery_eta_minutes: Number(form.delivery_eta_minutes),
        opens_at: form.opens_at,
        closes_at: form.closes_at,
        is_active: form.is_active,
        pause_note: form.pause_note || null,
        logo_url,
      })
      .eq("id", store.id);

    setSaving(false);
    if (updateError) {
      setMessage(updateError.message);
      return;
    }
    setMessage("Store updated.");
    await refresh();
  }

  if (error === "unauthenticated") {
    return (
      <Link href="/auth?next=/portal/settings" className="text-accent-deep underline">
        Sign in
      </Link>
    );
  }
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) {
    return (
      <p className="text-muted">
        Set up a store on the{" "}
        <Link href="/portal" className="text-accent-deep underline">
          Orders
        </Link>{" "}
        page first.
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl text-ink">Store settings</h1>
      <p className="mt-1 text-sm text-muted">
        Set your exact store location so shoppers know where you operate from.
      </p>

      <form
        onSubmit={onSave}
        className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6"
      >
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Name</span>
          <input
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Description</span>
          <textarea
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </label>

        <StoreLocationFields value={location} onChange={setLocation} />

        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Delivery ETA (minutes)</span>
          <input
            type="number"
            min="15"
            max="180"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={form.delivery_eta_minutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, delivery_eta_minutes: e.target.value }))
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Opens</span>
            <input
              type="time"
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={form.opens_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, opens_at: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Closes</span>
            <input
              type="time"
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={form.closes_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, closes_at: e.target.value }))
              }
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.checked }))
            }
          />
          Store is active / visible to shoppers
        </label>
        {!form.is_active ? (
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Pause reason (shown internally)</span>
            <input
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              placeholder="Temporarily closed for inventory update"
              value={form.pause_note}
              onChange={(e) =>
                setForm((f) => ({ ...f, pause_note: e.target.value }))
              }
            />
          </label>
        ) : null}
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Logo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          />
        </label>
        {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-6 py-3 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
