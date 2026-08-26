"use client";

import { ImageUploadField } from "@/components/image-upload-field";

export type StoreBrandingValue = {
  logoFile: File | null;
  logoUrl?: string | null;
};

export function StoreBrandingFields({
  value,
  onChange,
  required = false,
  logoError,
}: {
  value: StoreBrandingValue;
  onChange: (next: StoreBrandingValue) => void;
  required?: boolean;
  logoError?: string | null;
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
    </div>
  );
}
