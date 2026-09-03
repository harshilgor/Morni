"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DeliveryAddressFields, EMPTY_DELIVERY_ADDRESS, type DeliveryAddressDraft } from "@/components/delivery-address-fields";
import { createClient } from "@/lib/supabase/client";
import { DELIVERY_EMIRATE, DELIVERY_ONLY_MESSAGE, isDeliverableEmirate } from "@/lib/location";
import type { DeliveryAddress } from "@/lib/types";

type AddressEditor = DeliveryAddressDraft & { isDefault: boolean };

function formatEmirate(emirate: string) {
  return emirate.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AddressCard({
  address,
  onEdit,
  onDefault,
  onRemove,
  busy,
}: {
  address: DeliveryAddress;
  onEdit: () => void;
  onDefault: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <article className="flex min-h-64 flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_12px_30px_-28px_rgba(28,20,24,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">{address.label}</h2>
        {address.is_default ? (
          <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            Default
          </span>
        ) : null}
      </div>
      <div className="mt-4 text-sm leading-relaxed text-ink">
        <p>{address.street}</p>
        {address.building ? <p>{address.building}</p> : null}
        {address.apartment ? <p>{address.apartment}</p> : null}
        <p>{address.area}, {formatEmirate(address.emirate)}</p>
        {!isDeliverableEmirate(address.emirate) ? (
          <p className="mt-2 text-xs text-accent-deep">{DELIVERY_ONLY_MESSAGE}</p>
        ) : null}
        {address.phone ? <p className="mt-2 text-muted">{address.phone}</p> : null}
        {address.notes ? <p className="mt-3 text-xs text-muted">{address.notes}</p> : null}
      </div>
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm font-semibold">
        <button type="button" onClick={onEdit} disabled={busy} className="text-accent-deep hover:underline disabled:opacity-50">
          Edit
        </button>
        {!address.is_default ? (
          <button type="button" onClick={onDefault} disabled={busy} className="text-accent-deep hover:underline disabled:opacity-50">
            Set as default
          </button>
        ) : null}
        <button type="button" onClick={onRemove} disabled={busy} className="text-muted hover:text-accent-deep hover:underline disabled:opacity-50">
          Remove
        </button>
      </div>
    </article>
  );
}

export default function AddressesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted sm:px-6">Loading your address book...</div>}>
      <AddressesPageContent />
    </Suspense>
  );
}

function AddressesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(() => searchParams.get("new") === "1");
  const [editor, setEditor] = useState<AddressEditor>({ ...EMPTY_DELIVERY_ADDRESS, isDefault: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at");
    if (loadError) setError(loadError.message);
    else setAddresses((data ?? []) as DeliveryAddress[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      setAuthReady(true);
      if (id) void loadAddresses();
      else setLoading(false);
    });
  }, [loadAddresses]);


  function openEditor() {
    setError(null);
    setEditingId(null);
    setEditor({ ...EMPTY_DELIVERY_ADDRESS, isDefault: addresses.length === 0 });
    setEditorOpen(true);
  }

  function editAddress(address: DeliveryAddress) {
    setError(null);
    setEditingId(address.id);
    setEditor({
      label: address.label,
      phone: address.phone ?? "",
      emirate: DELIVERY_EMIRATE,
      area: address.area,
      street: address.street,
      building: address.building ?? "",
      apartment: address.apartment ?? "",
      notes: address.notes ?? "",
      isDefault: address.is_default,
    });
    setEditorOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("address-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setError(null);
    if (searchParams.get("new") === "1") router.replace("/addresses");
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;
    if (!editor.label.trim() || !editor.phone.trim() || !editor.area.trim() || !editor.street.trim()) {
      setError("Add a name, contact number, area, and street address before saving.");
      return;
    }
    if (!isDeliverableEmirate(editor.emirate)) {
      setError(DELIVERY_ONLY_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      label: editor.label.trim(),
      phone: editor.phone.trim(),
      emirate: DELIVERY_EMIRATE,
      area: editor.area.trim(),
      street: editor.street.trim(),
      building: editor.building.trim() || null,
      apartment: editor.apartment.trim() || null,
      notes: editor.notes.trim() || null,
      is_default: editor.isDefault,
    };
    const request = editingId
      ? supabase.from("addresses").update(payload).eq("id", editingId).eq("user_id", userId)
      : supabase.from("addresses").insert({ user_id: userId, ...payload });
    const { error: saveError } = await request;
    if (saveError) setError(saveError.message);
    else {
      closeEditor();
      await loadAddresses();
    }
    setSaving(false);
  }

  async function setDefault(address: DeliveryAddress) {
    if (!userId) return;
    setBusyId(address.id);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", address.id)
      .eq("user_id", userId);
    if (updateError) setError(updateError.message);
    else await loadAddresses();
    setBusyId(null);
  }

  async function removeAddress(address: DeliveryAddress) {
    if (!userId || !window.confirm(`Remove ${address.label}?`)) return;
    setBusyId(address.id);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("addresses")
      .delete()
      .eq("id", address.id)
      .eq("user_id", userId);
    if (deleteError) setError(deleteError.message);
    else await loadAddresses();
    setBusyId(null);
  }

  if (!authReady || loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted sm:px-6">Loading your address book...</div>;
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">Your account</p>
        <h1 className="mt-3 font-display text-4xl text-ink">Save delivery addresses</h1>
        <p className="mt-3 text-muted">Sign in to save your home, work, and gift delivery addresses.</p>
        <Link href="/auth?next=/addresses" className="mt-7 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-accent-deep">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">Your account / Addresses</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">Your addresses</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Save Dubai delivery details once, then select the right location in seconds. {DELIVERY_ONLY_MESSAGE}</p>
        </div>
        <Link href="/" className="text-sm font-semibold text-accent-deep hover:underline">Continue shopping</Link>
      </div>

      {error ? <p className="mt-5 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-accent-deep">{error}</p> : null}

      {editorOpen ? (
        <form id="address-editor" onSubmit={saveAddress} className="scroll-mt-32 mt-7 rounded-2xl border border-ink bg-surface p-5 shadow-[0_20px_50px_-35px_rgba(28,20,24,0.6)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl text-ink">{editingId ? "Edit address" : "Add a new address"}</h2>
              <p className="mt-1 text-sm text-muted">Use a clear name like Home, Work, or a recipient&apos;s name. {DELIVERY_ONLY_MESSAGE}</p>
            </div>
            <button type="button" onClick={closeEditor} disabled={saving} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-background disabled:opacity-50">Cancel</button>
          </div>
          <div className="mt-5 max-w-2xl">
            <DeliveryAddressFields value={editor} onChange={(next) => setEditor((current) => ({ ...current, ...next }))} idPrefix="address-book" />
            {editingId && addresses.find((address) => address.id === editingId)?.is_default ? (
              <p className="mt-4 text-sm text-muted">This is your default delivery address.</p>
            ) : (
              <label className="mt-4 flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={editor.isDefault} onChange={(event) => setEditor((current) => ({ ...current, isDefault: event.target.checked }))} />
                Make this my default delivery address
              </label>
            )}
            <button type="submit" disabled={saving} className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Save changes" : "Save address"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={openEditor} className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-background p-6 text-center transition hover:border-ink hover:bg-sand/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-3xl font-light text-ink">+</span>
          <span className="mt-4 font-display text-2xl text-ink">Add address</span>
          <span className="mt-1 text-sm text-muted">Home, work, or someone else</span>
        </button>
        {addresses.map((address) => <AddressCard key={address.id} address={address} busy={busyId === address.id} onEdit={() => editAddress(address)} onDefault={() => void setDefault(address)} onRemove={() => void removeAddress(address)} />)}
      </section>
      {addresses.length === 0 ? <p className="mt-5 text-sm text-muted">Your saved addresses will appear here.</p> : null}
    </main>
  );
}
