"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DeliveryAddress, UaeEmirate } from "@/lib/types";

function AddressCard({
  address,
  selected,
  onSelect,
}: {
  address: DeliveryAddress;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ink/30 ${
        selected
          ? "border-ink bg-sand"
          : "border-line bg-background hover:border-ink/35 hover:bg-sand/40"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{address.label}</span>
        {address.is_default ? (
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
            Default
          </span>
        ) : null}
      </span>
      <span className="mt-2 block text-xs leading-relaxed text-muted">
        {address.street}
        {address.building ? `, ${address.building}` : ""}
        {address.apartment ? `, ${address.apartment}` : ""}
        <br />
        {address.area}, {address.emirate.replace("_", " ")}
      </span>
      {address.phone ? (
        <span className="mt-1 block text-xs text-muted">{address.phone}</span>
      ) : null}
      {selected ? (
        <span className="mt-2 block text-xs font-medium text-ink">Delivering here</span>
      ) : null}
    </button>
  );
}

export function SavedAddressPicker({
  userId,
  currentEmirate,
  currentArea,
  onSelect,
  onNavigate,
}: {
  userId: string | undefined;
  currentEmirate: UaeEmirate;
  currentArea: string;
  onSelect: (address: DeliveryAddress) => void;
  onNavigate?: () => void;
}) {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!userId) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    setError(null);
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

  if (!userId) {
    return (
      <section className="rounded-xl border border-line bg-background p-4">
        <p className="text-sm font-semibold text-ink">Save delivery addresses</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Sign in to keep home, work, and gift addresses ready for checkout.
        </p>
        <Link
          href="/auth?next=/addresses"
          onClick={onNavigate}
          className="mt-3 inline-flex text-sm font-semibold text-accent-deep hover:underline"
        >
          Sign in to manage addresses
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl text-ink">Choose your location</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Delivery options and local stores update for the address you choose.
          </p>
        </div>
        <Link
          href="/addresses?new=1"
          onClick={onNavigate}
          className="shrink-0 text-sm font-semibold text-accent-deep hover:underline"
        >
          Add new
        </Link>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Loading your addresses...</p> : null}
      {!loading && addresses.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-background p-4">
          <p className="text-sm font-medium text-ink">No saved addresses yet</p>
          <p className="mt-1 text-xs text-muted">Add one to make delivery faster next time.</p>
          <Link
            href="/addresses?new=1"
            onClick={onNavigate}
            className="mt-3 inline-flex text-sm font-semibold text-accent-deep hover:underline"
          >
            Add an address
          </Link>
        </div>
      ) : null}
      {!loading && addresses.length > 0 ? (
        <div className="mt-4 space-y-2">
          {addresses.slice(0, 3).map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              selected={address.emirate === currentEmirate && address.area === currentArea}
              onSelect={() => onSelect(address)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-sm">
        <Link
          href="/addresses"
          onClick={onNavigate}
          className="font-semibold text-accent-deep hover:underline"
        >
          Manage address book
        </Link>
        {addresses.length > 3 ? (
          <Link href="/addresses" onClick={onNavigate} className="text-muted hover:text-ink hover:underline">
            See all ({addresses.length})
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-accent-deep">{error}</p> : null}
    </section>
  );
}
