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
import { ImageUploadField } from "@/components/image-upload-field";
import { PortalEmpty, PortalPageHeader, StatusBadge } from "@/components/portal-ui";
import type { StorePickupLocation } from "@/lib/types";

export default function PortalSettingsPage() {
  const { store, loading, error, refresh, storeRole } = useOwnerStore();
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
  const [pickupLocation, setPickupLocation] = useState<StoreLocationValue>({
    emirate: "dubai",
    area: "",
    address: "",
    lat: null,
    lng: null,
  });
  const [pickupLocationPublic, setPickupLocationPublic] = useState(false);
  const [branding, setBranding] = useState<StoreBrandingValue>({
      logoFile: null,
      logoUrl: null,
      sizeChartFile: null,
      sizeChartUrl: null,
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
    const currentStore = store;
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
        logoUrl: store.logo_url,
        sizeChartFile: null,
        sizeChartUrl: store.size_chart_url,
      });
    };
    if (typeof queueMicrotask === "function") queueMicrotask(syncFromStore);
    else window.setTimeout(syncFromStore, 0);

    let cancelled = false;
    async function loadPickupLocation() {
      const supabase = createClient();
      const { data } = await supabase
        .from("store_pickup_locations")
        .select("store_id, emirate, area, address, lat, lng, is_public")
        .eq("store_id", currentStore.id)
        .maybeSingle();
      if (cancelled) return;
      const pickup = data as StorePickupLocation | null;
      setPickupLocation(
        pickup
          ? {
              emirate: pickup.emirate,
              area: pickup.area,
              address: pickup.address,
              lat: pickup.lat,
              lng: pickup.lng,
            }
          : {
              emirate: currentStore.emirate,
              area: "",
              address: "",
              lat: null,
              lng: null,
            },
      );
      setPickupLocationPublic(pickup?.is_public ?? false);
    }
    void loadPickupLocation();
    return () => {
      cancelled = true;
    };
  }, [store]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    if (!location.area.trim() || !location.address.trim()) {
      setMessage("Add your area and exact street address.");
      return;
    }
    const pickupArea = pickupLocation.area.trim();
    const pickupAddress = pickupLocation.address.trim();
    if (Boolean(pickupArea) !== Boolean(pickupAddress)) {
      setMessage("Add both pickup area and pickup address, or leave both blank.");
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      let logo_url = branding.logoUrl ?? store.logo_url;
      let size_chart_url = branding.sizeChartUrl ?? store.size_chart_url ?? null;

      if (branding.logoFile) {
        logo_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.logoFile,
          prefix: "logo",
        });
      }
      if (branding.sizeChartFile) {
        size_chart_url = await uploadStoreMedia({
          bucket: "store-logos",
          storeId: store.id,
          file: branding.sizeChartFile,
          prefix: "size-chart",
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
          size_chart_url,
        })
        .eq("id", store.id);

      if (updateError) throw new Error(updateError.message);

      if (pickupArea && pickupAddress) {
        const { error: pickupError } = await supabase
          .from("store_pickup_locations")
          .upsert(
            {
              store_id: store.id,
              emirate: pickupLocation.emirate,
              area: pickupArea,
              address: pickupAddress,
              lat: pickupLocation.lat,
              lng: pickupLocation.lng,
              is_public: pickupLocationPublic,
            },
            { onConflict: "store_id" },
          );
        if (pickupError) throw new Error(pickupError.message);
      } else {
        const { error: pickupDeleteError } = await supabase
          .from("store_pickup_locations")
          .delete()
          .eq("store_id", store.id);
        if (pickupDeleteError) throw new Error(pickupDeleteError.message);
      }

      setBranding({
        logoFile: null,
        logoUrl: logo_url,
        sizeChartFile: null,
        sizeChartUrl: size_chart_url,
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
    return <PortalEmpty icon="settings" title="Sign in to manage your store" description="Use the owner account linked to your Morni store." action={{ label: "Sign in", href: "/auth?next=/portal/settings" }} />;
  }
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) {
    return <PortalEmpty icon="store" title="Set up your first store" description="Create a store before you can manage the public storefront and delivery details." action={{ label: "Start store setup", href: "/sell/setup" }} />;
  }
  if (storeRole !== "owner") {
    return <PortalEmpty icon="settings" title="Owner access required" description="Only the store owner can edit store settings, visibility, or delete the store." />;
  }

  const incomplete = !isOnboardingComplete(store);

  return (
    <div className="max-w-6xl">
      <PortalPageHeader eyebrow="Store management" title="Store settings" description="Set your branding, location, delivery hours, and public visibility so shoppers know what to expect." />

      {incomplete ? (
        <div className="mt-5 rounded-2xl border border-[#bad7cd] bg-[#edf7f3] px-4 py-3 text-sm text-[#315b51]">
          Setup is still incomplete.{" "}
          <Link href="/sell/setup" className="font-medium text-[#2f6f66] underline">
            Continue onboarding
          </Link>{" "}
          to launch publicly.
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={onSave} className="portal-card space-y-6 p-6">
          <div className="grid gap-4 lg:grid-cols-2">
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
              <span className="text-muted">Store hours summary</span>
              <div className="flex min-h-[2.75rem] items-center rounded-xl border border-line bg-[#f7faf8] px-3 text-sm text-muted">
                {storeHours.opens_at} – {storeHours.closes_at}
              </div>
            </label>
          </div>
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

          <section className="rounded-2xl border border-line bg-[#fbfdfc] p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#263530]">Branding & sizing</h2>
              <p className="mt-1 text-sm text-muted">Keep your storefront recognizable across Morni.</p>
            </div>
            <StoreBrandingFields value={branding} onChange={setBranding} includeSizeChart={false} />
          </section>

          <section className="rounded-2xl border border-[#c9ddd4] bg-[#f7fbf8] p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#263530]">Size chart</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted">Upload the chart shoppers should use when choosing a size. It appears on product pages that offer sizing.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#3b7162]">{branding.sizeChartUrl ? "Uploaded" : "Optional"}</span>
            </div>
            <ImageUploadField label="Store size chart" hint="Use a clear JPG, PNG, or WebP image up to 8 MB." aspect="product" valueUrl={branding.sizeChartUrl} file={branding.sizeChartFile ?? null} onFileChange={(sizeChartFile) => setBranding((current) => ({ ...current, sizeChartFile }))} />
          </section>

          <section className="rounded-2xl border border-line bg-[#fbfdfc] p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#263530]">Public store location</h2>
              <p className="mt-1 text-sm text-muted">This is the location shoppers see on your storefront.</p>
            </div>
            <StoreLocationFields value={location} onChange={setLocation} />
          </section>

          <section className="rounded-2xl border border-[#f0d8c8] bg-[#fffaf6] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#7b492d]">Driver pickup location</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[#8b6958]">
                  Use this when riders collect orders from a home, studio, or a different address. Leave it blank to use the public store location.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8b6958]">Private by default</span>
            </div>
            <div className="mt-4">
              <StoreLocationFields
                value={pickupLocation}
                onChange={setPickupLocation}
                required={false}
                mapTitle="Driver pickup location map"
              />
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#ecd9cc] bg-white p-3.5">
              <input
                type="checkbox"
                checked={pickupLocationPublic}
                onChange={(event) => setPickupLocationPublic(event.target.checked)}
                disabled={!pickupLocation.area.trim() || !pickupLocation.address.trim()}
                className="mt-0.5 h-4 w-4 accent-[#b75c35]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#6f432c]">Show pickup location to shoppers</span>
                <span className="mt-1 block text-xs leading-5 text-[#8b6958]">When enabled, the pickup address can appear on your public storefront. Riders always receive it for assigned orders.</span>
              </span>
            </label>
          </section>

          <section className="rounded-2xl border border-line bg-[#fbfdfc] p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#263530]">Delivery hours</h2>
              <p className="mt-1 text-sm text-muted">Tell shoppers when orders can be prepared.</p>
            </div>
            <StoreHoursFields value={storeHours} onChange={setStoreHours} />
          </section>

          {message ? <p role="status" className="rounded-xl bg-[#edf7f3] px-4 py-3 text-sm text-[#277044]">{message}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-xs text-muted">Changes are saved to the selected store.</p>
            <button type="submit" disabled={saving} className="portal-button-primary disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <aside className="space-y-6 xl:sticky xl:top-24">
        <section className="portal-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#263530]">Store visibility</h2>
              <StatusBadge status={store.is_active ? "live" : "paused"} />
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
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
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

        <section className="portal-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">At a glance</p>
          <h2 className="mt-2 text-lg font-semibold text-[#263530]">Pickup routing</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {pickupLocation.area.trim() && pickupLocation.address.trim()
              ? `Riders will be routed to ${pickupLocation.area}.`
              : "Riders will use your public store address until you add a separate pickup point."}
          </p>
          <div className="mt-4 rounded-xl bg-[#f7faf8] p-3 text-xs leading-5 text-muted">
            <strong className="text-[#263530]">Privacy note:</strong> pickup details stay hidden from shoppers unless you switch on public visibility.
          </div>
        </section>

      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">Delete store</h2>
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
        </aside>
      </div>

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
