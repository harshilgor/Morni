"use client";

const ETA_PRESETS = [
  { value: 30, label: "30 min", hint: "Same-area express" },
  { value: 45, label: "45 min", hint: "Nearby delivery" },
  { value: 60, label: "1 hour", hint: "Most popular" },
  { value: 90, label: "90 min", hint: "Across the city" },
] as const;

export type DeliverySetupValue = {
  delivery_eta_minutes: string;
  opens_at: string;
  closes_at: string;
};

export function DeliverySetupFields({
  value,
  onChange,
}: {
  value: DeliverySetupValue;
  onChange: (next: DeliverySetupValue) => void;
}) {
  const etaNumber = Number(value.delivery_eta_minutes);
  const isCustom =
    !ETA_PRESETS.some((preset) => preset.value === etaNumber) &&
    value.delivery_eta_minutes.trim() !== "";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div>
          <p className="text-sm text-muted">Typical delivery time</p>
          <p className="mt-0.5 text-xs text-muted">
            Shown to shoppers as your delivery promise. Pick a preset or enter a
            custom value between 15 and 180 minutes.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ETA_PRESETS.map((preset) => {
            const selected = etaNumber === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    delivery_eta_minutes: String(preset.value),
                  })
                }
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-background text-ink hover:border-ink/40"
                }`}
              >
                <p className="text-sm font-medium">{preset.label}</p>
                <p
                  className={`mt-0.5 text-[11px] ${
                    selected ? "text-white/70" : "text-muted"
                  }`}
                >
                  {preset.hint}
                </p>
              </button>
            );
          })}
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Custom minutes</span>
          <input
            type="number"
            min={15}
            max={180}
            className={`w-full rounded-xl border bg-background px-3 py-2.5 ${
              isCustom ? "border-ink" : "border-line"
            }`}
            value={value.delivery_eta_minutes}
            onChange={(e) =>
              onChange({ ...value, delivery_eta_minutes: e.target.value })
            }
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Opens</span>
          <input
            type="time"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.opens_at}
            onChange={(e) => onChange({ ...value, opens_at: e.target.value })}
            required
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Closes</span>
          <input
            type="time"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.closes_at}
            onChange={(e) => onChange({ ...value, closes_at: e.target.value })}
            required
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Opening hours help shoppers know when they can expect same-day delivery
        from your boutique.
      </p>
    </div>
  );
}
