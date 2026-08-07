"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DeliveryAddressFields,
  EMPTY_DELIVERY_ADDRESS,
  type DeliveryAddressDraft,
} from "@/components/delivery-address-fields";
import type { DeliveryAddress, UaeEmirate } from "@/lib/types";

type EditableAddress = DeliveryAddressDraft & { id?: string; isDefault: boolean };

function toDraft(address: DeliveryAddress): EditableAddress {
  return {
    id: address.id,
    label: address.label,
    emirate: address.emirate,
    area: address.area,
    street: address.street,
    building: address.building ?? "",
    apartment: address.apartment ?? "",
    notes: address.notes ?? "",
    isDefault: address.is_default,
  };
}

export function SavedAddressPicker({
  userId,
  defaultLabel,
  currentEmirate,
  currentArea,
  onSelect,
}: {
  userId: string | undefined;
  defaultLabel: string;
  currentEmirate: UaeEmirate;
  currentArea: string;
  onSelect: (address: DeliveryAddress) => void;
}) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditableAddress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!userId) {
      setAddresses([]);
      return;
    }
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
  }, [userId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAddresses();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadAddresses]);

  if (!userId) return null;

  const editingDefault = Boolean(
    editor?.id && addresses.find((address) => address.id === editor.id)?.is_default,
  );

  function startNew() {
    setError(null);
    setEditor({
      ...EMPTY_DELIVERY_ADDRESS,
      label: defaultLabel || "Home",
      emirate: currentEmirate,
      area: currentArea,
      isDefault: addresses.length === 0,
    });
  }

  async function saveAddress() {
    if (!editor || !userId) return;
    if (!editor.label.trim() || !editor.area.trim() || !editor.street.trim()) {
      setError("Add a name, area, and street address.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      label: editor.label.trim(),
      emirate: editor.emirate,
      area: editor.area.trim(),
      street: editor.street.trim(),
      building: editor.building.trim() || null,
      apartment: editor.apartment.trim() || null,
      notes: editor.notes.trim() || null,
      is_default: editor.isDefault,
    };
    const request = editor.id
      ? supabase.from("addresses").update(payload).eq("id", editor.id)
      : supabase.from("addresses").insert({ user_id: userId, ...payload });
    const { error: saveError } = await request;
    if (saveError) setError(saveError.message);
    else {
      setEditor(null);
      await loadAddresses();
    }
    setSaving(false);
  }

  async function makeDefault(address: DeliveryAddress) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", address.id);
    if (updateError) setError(updateError.message);
    else await loadAddresses();
  }

  async function removeAddress(address: DeliveryAddress) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("addresses")
      .delete()
      .eq("id", address.id);
    if (deleteError) setError(deleteError.message);
    else await loadAddresses();
  }

  return (
    <div className="border-b border-line pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg">Saved addresses</p>
          <p className="mt-0.5 text-xs text-muted">Choose who this delivery is for.</p>
        </div>
        {!editor ? (
          <button
            type="button"
            onClick={startNew}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/40"
          >
            Add address
          </button>
        ) : null}
      </div>

      {loading ? <p className="mt-3 text-xs text-muted">Loading addresses...</p> : null}
      {!loading && addresses.length === 0 && !editor ? (
        <p className="mt-3 text-sm text-muted">No saved addresses yet.</p>
      ) : null}

      {!editor ? (
        <div className="mt-3 space-y-2">
          {addresses.map((address) => {
            const selected =
              address.emirate === currentEmirate && address.area === currentArea;
            return (
              <div
                key={address.id}
                className={`rounded-xl border p-3 ${selected ? "border-accent bg-[#fff0f4]" : "border-line bg-background"}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(address)}
                    className="min-w-0 flex-1 text-left"
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
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditor(toDraft(address))}
                      className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAddress(address)}
                      className="rounded-lg px-2 py-1 text-xs text-accent-deep hover:bg-[#fff0f4]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {!address.is_default ? (
                  <button
                    type="button"
                    onClick={() => makeDefault(address)}
                    className="mt-2 text-xs font-medium text-accent-deep hover:underline"
                  >
                    Make default
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-background p-3">
          <DeliveryAddressFields
            value={editor}
            onChange={(next) =>
              setEditor((current) => (current ? { ...current, ...next } : current))
            }
            idPrefix="header-saved-address"
          />
          {editingDefault ? (
            <p className="mt-3 text-sm text-muted">This is your default address.</p>
          ) : (
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={editor.isDefault}
                onChange={(event) =>
                  setEditor({ ...editor, isDefault: event.target.checked })
                }
              />
              Make this my default address
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setEditor(null)}
              disabled={saving}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAddress}
              disabled={saving}
              className="rounded-full bg-ink px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : editor.id ? "Save changes" : "Save address"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-accent-deep">{error}</p> : null}
    </div>
  );
}
