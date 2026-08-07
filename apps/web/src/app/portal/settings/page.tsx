"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isOnboardingComplete, useOwnerStore } from "@/lib/use-owner-store";
import {
  StoreLocationFields,
  type StoreLocationValue,
} from "@/components/store-location-fields";
import {
  StoreBrandingFields,
  type StoreBrandingValue,
} from "@/components/store-branding-fields";
import {
  StoreHoursFields,
  type StoreHoursValue,
} from "@/components/delivery-setup-fields";
import { uploadStoreMedia } from "@/lib/media-upload";

export default function PortalSettingsPage() {
  const { store, loading, error, refresh } = useOwnerStore();
  const [form, setForm] = useState({
    name: "",
    description: "",
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
  const [storeHours, setStoreHours] = useState<StoreHoursValue>({
    opens_at: "10:00",
    closes_at: "22:00",
  });
  const [branding, setBranding] = useState<StoreBrandingValue>({
    logoFile: null,
    coverFile: null,
    logoUrl: null,
    coverUrl: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [storeActionError, setStoreActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    const syncFromStore = () => {
      setForm({
        name: store.name,
        description: store.description ?? "",
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
      setStoreHours({
        opens_at: store.opens_at?.slice(0, 5) ?? "10:00",
        closes_at: store.closes_at?.slice(0, 5) ?? "22:00",
      });
      setBranding({
        logoFile: null,
        coverFile: null,
        logoUrl: store.logo_url,
        coverUrl: store.cover_url,
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

    try {
      let logo_url = branding.logoUrl ?? store.logo_url;
      let cover_url = branding.coverUrl ?? store.cover_url;

      if (branding.logoFile) {
        logo_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.logoFile,
          prefix: "logo",
        });
      }
      if (branding.coverFile) {
        cover_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.coverFile,
          prefix: "cover",
        });
      }

      const supabase = createClient();
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
          opens_at: storeHours.opens_at,
          closes_at: storeHours.closes_at,
          pause_note: form.pause_note || null,
          logo_url,
          cover_url,
        })
        .eq("id", store.id);

      if (updateError) throw new Error(updateError.message);

      setBranding({
        logoFile: null,
        coverFile: null,
        logoUrl: logo_url,
        coverUrl: cover_url,
      });
      setMessage("Store updated.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStoreVisibility() {
    if (!store) return;
    if (!isOnboardingComplete(store) && !store.is_active) {
      setStoreActionError(
        "Finish onboarding and launch your store before listing it publicly.",
      );
      return;
    }

    const nextActive = !store.is_active;
    setVisibilitySaving(true);
    setStoreActionError(null);
    setMessage(null);
    const supabase = createClient();

    if (nextActive) {
      const { error: launchError } = await supabase.rpc("launch_owned_store", {
        p_store_id: store.id,
      });
      if (launchError) {
        setStoreActionError(launchError.message);
        setVisibilitySaving(false);
        return;
      }
    } else {
      const { error: updateError } = await supabase
        .from("stores")
        .update({
          is_active: false,
          pause_note: form.pause_note.trim() || "Unlisted by store owner",
        })
        .eq("id", store.id);

      if (updateError) {
        setStoreActionError(updateError.message);
        setVisibilitySaving(false);
        return;
      }
    }

    setForm((current) => ({
      ...current,
      is_active: nextActive,
      pause_note: nextActive
        ? ""
        : current.pause_note || "Unlisted by store owner",
    }));
    await refresh();
    setVisibilitySaving(false);
  }

  async function deleteStore() {
    if (!store || deleteConfirmation.trim() !== store.name) return;
    setDeleting(true);
    setStoreActionError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.rpc("delete_owned_store", {
      p_store_id: store.id,
    });

    if (deleteError) {
      setStoreActionError(deleteError.message);
      setDeleting(false);
      return;
    }

    window.location.assign("/sell/setup");
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

  const incomplete = !isOnboardingComplete(store);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl text-ink">Store settings</h1>
      <p className="mt-1 text-sm text-muted">
        Set your branding, location, and store hours so shoppers know what to
        expect.
      </p>

      {incomplete ? (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-[#fff0f4] px-4 py-3 text-sm text-ink">
          Setup is still incomplete.{" "}
          <Link href="/sell/setup" className="font-medium text-accent-deep underline">
            Continue onboarding
          </Link>{" "}
          to launch publicly.
        </div>
      ) : null}

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

        <StoreBrandingFields value={branding} onChange={setBranding} />
        <StoreLocationFields value={location} onChange={setLocation} />
        <StoreHoursFields value={storeHours} onChange={setStoreHours} />

        {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-6 py-3 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section className="mt-6 rounded-[1.5rem] border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl text-ink">Store visibility</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  store.is_active
                    ? "bg-[#e8f5ef] text-mint"
                    : "bg-[#fff0f4] text-accent-deep"
                }`}
              >
                {store.is_active ? "Listed" : "Unlisted"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {store.is_active
                ? "Your store and available products are visible to shoppers."
                : incomplete
                  ? "Finish onboarding before listing your store publicly."
                  : "Your store is hidden from shoppers. You can still manage everything here and list it again at any time."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleStoreVisibility}
            disabled={visibilitySaving || (incomplete && !store.is_active)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
              store.is_active
                ? "border border-line bg-background text-ink hover:border-ink/30"
                : "bg-ink text-white hover:bg-ink/90"
            }`}
          >
            {visibilitySaving
              ? "Updating…"
              : store.is_active
                ? "Unlist store"
                : "List store"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-[1.5rem] border border-red-200 bg-surface p-6">
        <h2 className="font-display text-xl text-red-700">Delete store</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Permanently removes your catalog and access to this store. Completed
          order records are retained for customers and legal records. This
          cannot be undone.
        </p>

        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirmation("");
              setStoreActionError(null);
            }}
            className="mt-4 rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            Delete store
          </button>
        ) : (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-sm text-ink">
              Type <strong>{store.name}</strong> to confirm permanent deletion.
            </p>
            <input
              type="text"
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className="mt-3 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-red-500"
              placeholder={store.name}
              aria-label={`Type ${store.name} to confirm deletion`}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                  setStoreActionError(null);
                }}
                disabled={deleting}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteStore}
                disabled={
                  deleting || deleteConfirmation.trim() !== store.name
                }
                className="rounded-full bg-red-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        )}
      </section>

      {storeActionError ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {storeActionError}
        </p>
      ) : null}
    </div>
  );
}
