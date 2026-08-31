"use client";

import {
  ProductImagesField,
  type ProductImageItem,
} from "@/components/product-images-field";
import { PRODUCT_SIZES } from "@/lib/product-sizes";
import { PRODUCT_FABRICS } from "@/lib/product-fabrics";
import { CustomizationEditor } from "@/components/customization-editor";
import {
  defaultCustomizationConfig,
  type ProductCustomizationConfig,
} from "@/lib/product-customization";

export type ProductFormValue = {
  title: string;
  description: string;
  fabric: string;
  categorySlug: string;
  price_aed: string;
  compare_at_price_aed: string;
  stock: string;
  sizes: string[];
  customization: ProductCustomizationConfig;
  images: ProductImageItem[];
};

export type CategoryOption = {
  slug: string;
  name: string;
};

export function ProductFormFields({
  value,
  onChange,
  categories,
  requireImages = false,
  fieldErrors,
}: {
  value: ProductFormValue;
  onChange: (next: ProductFormValue) => void;
  categories: CategoryOption[];
  requireImages?: boolean;
  fieldErrors?: Partial<Record<keyof ProductFormValue, string>>;
}) {
  function patch(partial: Partial<ProductFormValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">
          Product title <span className="text-accent-deep">*</span>
        </span>
        <input
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="e.g. Satin Slip Dress"
          required
        />
        {fieldErrors?.title ? (
          <p className="text-sm text-accent-deep">{fieldErrors.title}</p>
        ) : null}
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Fabric / material</span>
        <select className="w-full rounded-xl border border-line bg-background px-3 py-2.5" value={value.fabric} onChange={(e) => patch({ fabric: e.target.value })}>
          <option value="">Select material</option>
          {PRODUCT_FABRICS.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
        </select>
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">
          Description <span className="text-accent-deep">*</span>
        </span>
        <textarea
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          rows={4}
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Fabric, fit, occasion, and care details shoppers care about."
          required
        />
        {fieldErrors?.description ? (
          <p className="text-sm text-accent-deep">{fieldErrors.description}</p>
        ) : null}
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">
          Category <span className="text-accent-deep">*</span>
        </span>
        <select
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.categorySlug}
          onChange={(e) => {
            const categorySlug = e.target.value;
            patch({
              categorySlug,
              ...(["gifting", "hamper", "hampers"].includes(categorySlug)
                ? { sizes: [], customization: defaultCustomizationConfig() }
                : {}),
            });
          }}
          required
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        {fieldErrors?.categorySlug ? (
          <p className="text-sm text-accent-deep">{fieldErrors.categorySlug}</p>
        ) : null}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">
            Price AED <span className="text-accent-deep">*</span>
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.price_aed}
            onChange={(e) => patch({ price_aed: e.target.value })}
            required
          />
          {fieldErrors?.price_aed ? (
            <p className="text-sm text-accent-deep">{fieldErrors.price_aed}</p>
          ) : null}
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Compare-at price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={value.compare_at_price_aed}
            onChange={(e) => patch({ compare_at_price_aed: e.target.value })}
            placeholder="Optional"
          />
        </label>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">
          Stock <span className="text-accent-deep">*</span>
        </span>
        <input
          type="number"
          min="0"
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.stock}
          onChange={(e) => patch({ stock: e.target.value })}
          required
        />
        {fieldErrors?.stock ? (
          <p className="text-sm text-accent-deep">{fieldErrors.stock}</p>
        ) : null}
      </label>

      {!(["gifting", "hamper", "hampers"].includes(value.categorySlug)) ? <fieldset className="rounded-xl border border-line bg-background p-3">
        <legend className="px-1 text-sm text-muted">
          Available sizes <span className="text-accent-deep">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_SIZES.map((size) => {
            const selected = value.sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  patch({
                    sizes: selected
                      ? value.sizes.filter((item) => item !== size)
                      : [...value.sizes, size],
                  })
                }
                className={`min-w-11 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-muted hover:border-ink/40"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
        {fieldErrors?.sizes ? (
          <p className="mt-2 text-sm text-accent-deep">{fieldErrors.sizes}</p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Shoppers pick one of these sizes before adding to cart.
          </p>
        )}
      </fieldset> : null}

      {!(["gifting", "hamper", "hampers"].includes(value.categorySlug)) ? (
        <CustomizationEditor
          value={value.customization}
          onChange={(customization) => patch({ customization })}
        />
      ) : null}

      <ProductImagesField
        items={value.images}
        onChange={(images) => patch({ images })}
        required={requireImages}
        error={fieldErrors?.images}
      />
    </div>
  );
}

export function emptyProductForm(): ProductFormValue {
  return {
    title: "",
    description: "",
    fabric: "",
    categorySlug: "",
    price_aed: "",
    compare_at_price_aed: "",
    stock: "10",
    sizes: ["S", "M", "L"],
    customization: defaultCustomizationConfig(),
    images: [],
  };
}
