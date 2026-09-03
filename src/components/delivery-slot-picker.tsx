"use client";

import type { BookableDeliverySlot } from "@/lib/delivery-slots";

type DeliverySlotPickerProps = {
  slots: BookableDeliverySlot[];
  selectedId: string | null;
  onSelect: (slot: BookableDeliverySlot) => void;
  idPrefix?: string;
};

export function DeliverySlotPicker({
  slots,
  selectedId,
  onSelect,
  idPrefix = "delivery-slot",
}: DeliverySlotPickerProps) {
  if (slots.length === 0) {
    return (
      <p className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
        No delivery slots are available right now. Please try again later.
      </p>
    );
  }

  const groups = slots.reduce<Array<{ dateKey: string; dateLabel: string; slots: BookableDeliverySlot[] }>>(
    (acc, slot) => {
      const existing = acc.find((group) => group.dateKey === slot.dateKey);
      if (existing) {
        existing.slots.push(slot);
        return acc;
      }
      acc.push({ dateKey: slot.dateKey, dateLabel: slot.dateLabel, slots: [slot] });
      return acc;
    },
    [],
  );

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.dateKey}>
          <p className="text-sm font-semibold text-ink">{group.dateLabel}</p>
          <div
            role="radiogroup"
            aria-label={`Delivery times for ${group.dateLabel}`}
            className="mt-2 grid gap-2 sm:grid-cols-2"
          >
            {group.slots.map((slot) => {
              const selected = selectedId === slot.id;
              const inputId = `${idPrefix}-${slot.id}`;
              return (
                <label
                  key={slot.id}
                  htmlFor={inputId}
                  className={`flex cursor-pointer items-center gap-3 border px-3 py-3 transition ${
                    selected ? "border-ink bg-background ring-1 ring-ink" : "border-line bg-surface hover:border-ink/30"
                  }`}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={idPrefix}
                    value={slot.id}
                    checked={selected}
                    onChange={() => onSelect(slot)}
                    className="sr-only"
                  />
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      selected ? "border-ink" : "border-line"
                    }`}
                    aria-hidden="true"
                  >
                    {selected ? <span className="h-2.5 w-2.5 rounded-full bg-ink" /> : null}
                  </span>
                  <span className="text-sm font-semibold text-ink">{slot.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
