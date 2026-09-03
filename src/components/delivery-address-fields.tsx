"use client";

import {
  DELIVERY_EMIRATE,
  DELIVERY_ONLY_MESSAGE,
  UAE_AREAS,
} from "@/lib/location";
import type { UaeEmirate } from "@/lib/types";

export type DeliveryAddressDraft = {
  label: string;
  phone: string;
  emirate: UaeEmirate;
  area: string;
  street: string;
  building: string;
  apartment: string;
  notes: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddressDraft = {
  label: "",
  phone: "",
  emirate: DELIVERY_EMIRATE,
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
  const areas = UAE_AREAS[DELIVERY_EMIRATE] ?? [];

  function patch(next: Partial<DeliveryAddressDraft>) {
    onChange({ ...value, ...next, emirate: DELIVERY_EMIRATE });
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Name this address</span>
        <input
          name={`${idPrefix}-label`}
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.label}
          onChange={(event) => patch({ label: event.target.value })}
          placeholder="Home, Office"
          required={requireLabel}
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Contact number</span>
        <input
          type="tel"
          inputMode="tel"
          name={`${idPrefix}-phone`}
          autoComplete="shipping tel"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.phone}
          onChange={(event) => patch({ phone: event.target.value })}
          placeholder="+971 50 123 4567"
          pattern="[-+0-9() ]{7,}"
          title="Enter a valid phone number"
          required
        />
      </label>
      <div className="space-y-1.5 text-sm">
        <span className="text-muted">Emirate</span>
        <p className="rounded-xl border border-line bg-background px-3 py-2.5 text-ink">Dubai</p>
        <p className="text-xs leading-relaxed text-muted">{DELIVERY_ONLY_MESSAGE}</p>
        <input type="hidden" name={`${idPrefix}-emirate`} value={DELIVERY_EMIRATE} />
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Area / neighborhood</span>
        <input
          name={`${idPrefix}-area`}
          autoComplete="shipping address-level2"
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
          name={`${idPrefix}-street`}
          autoComplete="shipping street-address"
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
            name={`${idPrefix}-building`}
            autoComplete="shipping address-line2"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.building}
            onChange={(event) => patch({ building: event.target.value })}
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Apartment / villa</span>
          <input
            name={`${idPrefix}-apartment`}
            autoComplete="shipping address-line3"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.apartment}
            onChange={(event) => patch({ apartment: event.target.value })}
          />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Delivery notes</span>
        <textarea
          name={`${idPrefix}-notes`}
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          rows={2}
          value={value.notes}
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </label>
    </div>
  );
}
