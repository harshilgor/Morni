"use client";

import { ImageUploadField } from "@/components/image-upload-field";

export type StoreBrandingValue = {
  logoFile: File | null;
  coverFile: File | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

export function StoreBrandingFields({
  value,
  onChange,
  required = false,
  logoError,
  coverError,
}: {
  value: StoreBrandingValue;
  onChange: (next: StoreBrandingValue) => void;
  required?: boolean;
  logoError?: string | null;
  coverError?: string | null;
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
        label="Store banner / cover"
        hint="Wide banner for the top of your store page (recommended 1600 × 600)."
        aspect="banner"
        required={required}
        valueUrl={value.coverUrl}
        file={value.coverFile}
        error={coverError}
        onFileChange={(coverFile) => onChange({ ...value, coverFile })}
      />
    </div>
  );
}
