"use client";

import {
  CUSTOMIZATION_FIELD_OPTIONS,
  type ProductCustomizationConfig,
} from "@/lib/product-customization";
import { PortalIcon } from "@/components/portal-icons";

export function CustomizationEditor({
  value,
  onChange,
  compact = false,
}: {
  value: ProductCustomizationConfig;
  onChange: (next: ProductCustomizationConfig) => void;
  compact?: boolean;
}) {
  const selectedIds = new Set(value.fields.map((field) => field.id));

  function toggleField(id: string) {
    const option = CUSTOMIZATION_FIELD_OPTIONS.find((field) => field.id === id);
    if (!option) return;
    onChange({
      ...value,
      fields: selectedIds.has(id)
        ? value.fields.filter((field) => field.id !== id)
        : [...value.fields, { ...option }],
    });
  }

  function toggleRequired(id: string) {
    onChange({
      ...value,
      fields: value.fields.map((field) =>
        field.id === id ? { ...field, required: !field.required } : field,
      ),
    });
  }

  return (
    <section className={`rounded-xl border border-[#c9d9d2] bg-[#f5faf7] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dceee7] text-[#2f6f66]">
          <PortalIcon name="sparkle" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-[#243a33]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#2f6f66]"
              checked={value.enabled}
              onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
            />
            Offer custom measurements for this product
          </label>
          <p className="mt-1 text-xs leading-5 text-[#63766e]">
            Shoppers can share their measurements and you can confirm the fit before stitching.
          </p>
        </div>
      </div>

      {value.enabled ? (
        <div className="mt-4 space-y-4 border-t border-[#d8e6df] pt-4">
          <label className="block space-y-1.5 text-xs font-medium text-[#4c6259]">
            Instructions shown to shoppers
            <textarea
              className="w-full rounded-lg border border-[#b9cec4] bg-white px-3 py-2.5 text-sm font-normal text-[#23342e] outline-none focus:border-[#5f9184]"
              rows={2}
              value={value.instructions}
              onChange={(event) => onChange({ ...value, instructions: event.target.value })}
              placeholder="Tell shoppers how to measure or what you will confirm."
            />
          </label>

          <div>
            <p className="text-xs font-medium text-[#4c6259]">Ask for</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CUSTOMIZATION_FIELD_OPTIONS.map((field) => {
                const selected = selectedIds.has(field.id);
                return (
                  <button
                    key={field.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleField(field.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected ? "border-[#2f6f66] bg-[#2f6f66] text-white" : "border-[#b9cec4] bg-white text-[#52665d] hover:border-[#5f9184]"}`}
                  >
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>

          {value.fields.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {value.fields.map((field) => (
                <div key={field.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#d8e6df] bg-white px-3 py-2.5">
                  <span className="text-sm text-[#33483f]">{field.label} <span className="text-xs text-[#84938d]">({field.unit})</span></span>
                  <label className="flex items-center gap-1.5 text-[11px] text-[#687a72]">
                    <input type="checkbox" checked={field.required} onChange={() => toggleRequired(field.id)} className="accent-[#2f6f66]" />
                    Required
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#a05252]">Choose at least one measurement to turn this on.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
