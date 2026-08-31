"use client";

import { PRODUCT_SIZES } from "@/lib/product-sizes";
import type { SizeStock } from "@/lib/size-inventory";

export function SizeInventoryEditor({
  sizes,
  sizeStock,
  onChange,
  disabled = false,
}: {
  sizes: string[];
  sizeStock: SizeStock;
  onChange: (sizes: string[], sizeStock: SizeStock) => void;
  disabled?: boolean;
}) {
  const selected = new Set(sizes);
  const toggle = (size: string) => {
    const nextSizes = selected.has(size) ? sizes.filter((item) => item !== size) : [...sizes, size];
    const nextStock = { ...sizeStock };
    if (!selected.has(size)) nextStock[size] = nextStock[size] ?? 0;
    else delete nextStock[size];
    onChange(nextSizes, nextStock);
  };
  return (
    <fieldset className="rounded-2xl border border-line bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-[#40534d]">Inventory by size</legend>
      <p className="mt-1 text-xs leading-5 text-muted">Select the sizes you sell and enter the quantity available for each one.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRODUCT_SIZES.map((size) => <button key={size} type="button" disabled={disabled} aria-pressed={selected.has(size)} onClick={() => toggle(size)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selected.has(size) ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}>{size}</button>)}
      </div>
      {sizes.length ? <div className="mt-4 grid gap-2 sm:grid-cols-3">{sizes.map((size) => <label key={size} className="text-xs font-medium text-muted">{size}<input type="number" min="0" step="1" value={sizeStock[size] ?? 0} disabled={disabled} onChange={(event) => onChange(sizes, { ...sizeStock, [size]: Math.max(0, Number(event.target.value) || 0) })} className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink" /></label>)}</div> : <p className="mt-3 text-xs text-accent-deep">Choose at least one size.</p>}
      <p className="mt-3 text-xs text-muted">Total stock: <strong>{Object.values(sizeStock).reduce((sum, value) => sum + (Number(value) || 0), 0)}</strong></p>
    </fieldset>
  );
}
