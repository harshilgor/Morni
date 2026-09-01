"use client";

import { ImageUploadField } from "@/components/image-upload-field";

export type StoreBrandingValue = {
  logoFile: File | null;
  logoUrl?: string | null;
  sizeChartFile?: File | null;
  sizeChartUrl?: string | null;
};

export function StoreBrandingFields({
  value,
  onChange,
  required = false,
  logoError,
  sizeChartError,
}: {
  value: StoreBrandingValue;
  onChange: (next: StoreBrandingValue) => void;
  required?: boolean;
  logoError?: string | null;
  sizeChartError?: string | null;
}) {
  return (
    <div className="space-y-5">
      <ImageUploadField
        label="Store logo"
        hint="Square logo works best (recommended 400 × 400)."
        aspect="square"
        required={required}
        valueUrl={value.logoUrl}
        file={value.logoFile}
        error={logoError}
        onFileChange={(logoFile) => onChange({ ...value, logoFile })}
      />
      <ImageUploadField
        label="Size chart"
        hint="Optional. Shoppers will see this when they are choosing sizes for your products."
        aspect="product"
        valueUrl={value.sizeChartUrl}
        file={value.sizeChartFile ?? null}
        error={sizeChartError}
        onFileChange={(sizeChartFile) => onChange({ ...value, sizeChartFile })}
      />
    </div>
  );
}
