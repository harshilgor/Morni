"use client";

import type {
  ProductCustomizationConfig,
  ProductCustomizationValues,
} from "@/lib/product-customization";

export function ProductCustomizationFields({
  config,
  enabled,
  values,
  error,
  onToggle,
  onChange,
}: {
  config: ProductCustomizationConfig;
  enabled: boolean;
  values: ProductCustomizationValues;
  error?: string | null;
  onToggle: (enabled: boolean) => void;
  onChange: (id: string, value: string) => void;
}) {
  if (!config.enabled) return null;

  return (
    <section className="rounded-xl border border-[#ead9df] bg-[#fffaf8] p-4" aria-labelledby="custom-measurements-title">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f3e4dc] text-accent-deep" aria-hidden="true">✦</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="custom-measurements-title" className="text-sm font-semibold text-ink">Make it yours</h2>
              <p className="mt-1 text-xs leading-5 text-muted">This boutique offers custom sizing for this piece.</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink">
              <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} className="h-4 w-4 accent-[#c45b7a]" />
              Customize
            </label>
          </div>
          {enabled ? (
            <div className="mt-4 space-y-3 border-t border-[#f0e1db] pt-3">
              <p className="text-xs leading-5 text-muted">{config.instructions}</p>
              <p
                role="note"
                className="rounded-lg border border-[#e8c5cf] bg-[#fff1f4] px-3 py-2.5 text-xs font-medium leading-5 text-[#9b3f5d]"
              >
                Customized products cannot be returned.
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {config.fields.map((field) => (
                  <label key={field.id} className="block space-y-1 text-xs font-semibold text-ink">
                    <span>{field.label}{field.required ? <span className="text-accent-deep"> *</span> : null}</span>
                    <span className="relative block">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        step="0.25"
                        inputMode="decimal"
                        value={values[field.id] ?? ""}
                        onChange={(event) => onChange(field.id, event.target.value)}
                        placeholder="—"
                        className="w-full rounded-lg border border-line bg-white px-3 py-2.5 pr-9 text-sm font-normal text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                        aria-label={`${field.label} in ${field.unit}`}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase text-muted">{field.unit}</span>
                    </span>
                  </label>
                ))}
              </div>
              {error ? <p role="alert" className="text-xs font-medium text-accent-deep">{error}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">Optional — leave this off to receive the standard size.</p>
          )}
        </div>
      </div>
    </section>
  );
}
