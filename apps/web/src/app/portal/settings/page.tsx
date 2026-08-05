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
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [draggingCover, setDraggingCover] = useState(false);
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

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(cover);
    setCoverPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [cover]);

  function selectCover(file: File | null) {
    setCoverError(null);
    if (!file) {
      setCover(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setCoverError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setCoverError("Banner images must be smaller than 8 MB.");
      return;
    }
    setCover(file);
  }

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

    let cover_url = store.cover_url;
    if (cover) {
      const path = `${store.id}/cover-${Date.now()}-${cover.name}`;
      const { error: uploadError } = await supabase.storage
        .from("store-logos")
        .upload(path, cover, { upsert: true });
      if (uploadError) {
        setMessage(uploadError.message);
        setSaving(false);
        return;
      }
      cover_url = supabase.storage.from("store-logos").getPublicUrl(path).data
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
        cover_url,
      })
      .eq("id", store.id);

    setSaving(false);
    if (updateError) {
      setMessage(updateError.message);
      return;
    }
    setLogo(null);
    setCover(null);
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

        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted">Store banner / cover</p>
            <p className="mt-0.5 text-xs text-muted">
              This appears across the top of your public store page. Use a wide,
              high-quality image (recommended 1600 × 600).
            </p>
          </div>

          <label
            htmlFor="store-cover-upload"
            onDragEnter={(e) => {
              e.preventDefault();
              setDraggingCover(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDraggingCover(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDraggingCover(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingCover(false);
              selectCover(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`group relative block cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition ${
              draggingCover
                ? "border-accent bg-[#fff0f4]"
                : "border-line bg-background hover:border-accent/60"
            }`}
          >
            <div className="relative aspect-[8/3] min-h-36 w-full overflow-hidden">
              {coverPreview || store.cover_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview ?? store.cover_url ?? ""}
                    alt={`${store.name} banner preview`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25 transition group-hover:bg-black/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow-sm">
                      Drop a new banner or click to replace
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-2xl text-accent-deep shadow-sm">
                    +
                  </span>
                  <p className="mt-3 text-sm font-medium text-ink">
                    Drop your store banner here
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    or click to browse · JPG, PNG or WebP · max 8 MB
                  </p>
                </div>
              )}
            </div>
          </label>
          <input
            id="store-cover-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => selectCover(e.target.files?.[0] ?? null)}
          />
          {cover ? (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs text-muted">
                Selected: {cover.name}
              </p>
              <button
                type="button"
                onClick={() => selectCover(null)}
                className="shrink-0 text-xs text-accent-deep hover:underline"
              >
                Undo selection
              </button>
            </div>
          ) : null}
          {coverError ? (
            <p className="text-sm text-accent-deep">{coverError}</p>
          ) : null}
        </div>

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
          {store.logo_url ? (
            <div className="mb-2 h-16 w-16 overflow-hidden rounded-xl border border-line bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={store.logo_url}
                alt={`${store.name} logo`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          />
          {logo ? (
            <p className="text-xs text-muted">Selected: {logo.name}</p>
          ) : null}
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
