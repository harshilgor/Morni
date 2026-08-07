"use client";

import { EMIRATES } from "@/lib/format";
import { UAE_AREAS } from "@/lib/location";
import type { UaeEmirate } from "@/lib/types";

export type DeliveryAddressDraft = {
  label: string;
  emirate: UaeEmirate;
  area: string;
  street: string;
  building: string;
  apartment: string;
  notes: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddressDraft = {
  label: "",
  emirate: "dubai",
  area: "",
  street: "",
  building: "",
  apartment: "",
  notes: "",
};

export function DeliveryAddressFields({
  value,
  onChange,
  idPrefix,
  requireLabel = true,
}: {
  value: DeliveryAddressDraft;
  onChange: (next: DeliveryAddressDraft) => void;
  idPrefix: string;
  requireLabel?: boolean;
}) {
  const areas = UAE_AREAS[value.emirate] ?? [];

  function patch(next: Partial<DeliveryAddressDraft>) {
    onChange({ ...value, ...next });
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Name this address</span>
        <input
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.label}
          onChange={(event) => patch({ label: event.target.value })}
          placeholder="Harshil, Home, Office"
          required={requireLabel}
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Emirate</span>
        <select
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.emirate}
          onChange={(event) => patch({ emirate: event.target.value as UaeEmirate })}
        >
          {EMIRATES.map((emirate) => (
            <option key={emirate.value} value={emirate.value}>
              {emirate.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Area / neighborhood</span>
        <input
          list={`${idPrefix}-areas`}
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.area}
          onChange={(event) => patch({ area: event.target.value })}
          placeholder="Dubai Marina"
          required
        />
        <datalist id={`${idPrefix}-areas`}>
          {areas.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Street address</span>
        <input
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.street}
          onChange={(event) => patch({ street: event.target.value })}
          placeholder="Street, villa, or building address"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Building</span>
          <input
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.building}
            onChange={(event) => patch({ building: event.target.value })}
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Apartment / villa</span>
          <input
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.apartment}
            onChange={(event) => patch({ apartment: event.target.value })}
          />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Delivery notes</span>
        <textarea
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          rows={2}
          value={value.notes}
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </label>
    </div>
  );
}
