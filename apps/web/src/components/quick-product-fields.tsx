"use client";

import { ProductImagesField, type ProductImageItem } from "@/components/product-images-field";
import type { ColorDraft, ColorDraftImage } from "@/lib/product-variants";

export function QuickProductFields({
  draft,
  priceAed,
  onPriceChange,
  onChange,
  disabled = false,
}: {
  draft: ColorDraft;
  priceAed: string;
  onPriceChange: (priceAed: string) => void;
  onChange: (draft: ColorDraft) => void;
  disabled?: boolean;
}) {
  const imageItems: ProductImageItem[] = draft.images.map((image) => ({
    id: image.id,
    file: image.file,
    url: image.existing ? image.url : undefined,
    previewUrl: image.existing ? undefined : image.url,
  }));

  function setImages(items: ProductImageItem[]) {
    const images: ColorDraftImage[] = items.map((item) => ({
      id: item.id,
      url: item.previewUrl ?? item.url ?? "",
      file: item.file,
      existing: Boolean(item.url && !item.file),
    }));
    onChange({ ...draft, images });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#c9ddd4] bg-[#f4faf7] p-4">
        <p className="text-sm font-semibold text-[#21463b]">Start with the essentials</p>
        <p className="mt-1 text-xs leading-5 text-[#54756b]">
          Add photos, price, and stock. Morni will prepare the title, description, and category for you to review.
        </p>
      </div>

      <ProductImagesField
        items={imageItems}
        onChange={setImages}
        required
        disabled={disabled}
        error={draft.images.length === 0 ? "Add at least one product photo." : null}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-[#40534d]">Price (AED) *</span>
          <input
            className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
            type="number"
            min="0"
            step="0.01"
            value={priceAed}
            onChange={(event) => onPriceChange(event.target.value)}
            disabled={disabled}
            placeholder="0.00"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-[#40534d]">Stock *</span>
          <input
            className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
            type="number"
            min="0"
            step="1"
            value={draft.stock}
            onChange={(event) => onChange({ ...draft, stock: event.target.value })}
            disabled={disabled}
            placeholder="0"
          />
        </label>
      </div>

      <p className="text-xs leading-5 text-muted">
        You can review sizing after Morni identifies the category. Gifting products do not need sizes.
      </p>
    </div>
  );
}
