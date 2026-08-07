"use client";

export type StoreHoursValue = {
  opens_at: string;
  closes_at: string;
};

export function StoreHoursFields({
  value,
  onChange,
}: {
  value: StoreHoursValue;
  onChange: (next: StoreHoursValue) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Store hours</p>
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
    </div>
  );
}
