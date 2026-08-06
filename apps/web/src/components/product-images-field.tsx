"use client";

import { useEffect, useId, useState } from "react";
import {
  MEDIA_ACCEPT,
  MEDIA_ACCEPT_LABEL,
  PRODUCT_IMAGE_LIMIT,
  validateImageFile,
} from "@/lib/media-upload";

export type ProductImageItem = {
  id: string;
  file?: File;
  url?: string;
  previewUrl?: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProductImagesField({
  items,
  onChange,
  required = false,
  error,
}: {
  items: ProductImageItem[];
  onChange: (items: ProductImageItem[]) => void;
  required?: boolean;
  error?: string | null;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
    // Only revoke on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList: FileList | File[] | null) {
    if (!fileList) return;
    setLocalError(null);
    const next = [...items];
    const files = Array.from(fileList);

    for (const file of files) {
      if (next.length >= PRODUCT_IMAGE_LIMIT) {
        setLocalError(`You can add up to ${PRODUCT_IMAGE_LIMIT} photos.`);
        break;
      }
      const validationError = validateImageFile(file);
      if (validationError) {
        setLocalError(validationError);
        continue;
      }
      next.push({
        id: makeId(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    onChange(next);
  }

  function removeAt(index: number) {
    const target = items[index];
    if (target?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(items.filter((_, i) => i !== index));
  }

  function setPrimary(index: number) {
    if (index === 0) return;
    const next = [...items];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [picked] = next.splice(index, 1);
    next.splice(target, 0, picked);
    onChange(next);
  }

  const displayError = error ?? localError;
  const canAdd = items.length < PRODUCT_IMAGE_LIMIT;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-muted">
          Product photos
          {required ? <span className="text-accent-deep"> *</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Add up to {PRODUCT_IMAGE_LIMIT} photos. The first image is the primary
          shopper-facing photo. {MEDIA_ACCEPT_LABEL}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => {
          const src = item.previewUrl ?? item.url ?? "";
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-line bg-background"
            >
              <div className="relative aspect-[3/4] bg-sand">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`Product photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Primary
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1 p-2">
                {index !== 0 ? (
                  <button
                    type="button"
                    onClick={() => setPrimary(index)}
                    className="rounded-full border border-line px-2 py-1 text-[10px] text-muted"
                  >
                    Make primary
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-full border border-line px-2 py-1 text-[10px] text-muted disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-full border border-line px-2 py-1 text-[10px] text-muted disabled:opacity-40"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="rounded-full border border-line px-2 py-1 text-[10px] text-accent-deep"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {canAdd ? (
          <label
            htmlFor={inputId}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 text-center transition ${
              dragging
                ? "border-accent bg-[#fff0f4]"
                : "border-line bg-background hover:border-accent/60"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-xl text-accent-deep shadow-sm">
              +
            </span>
            <p className="mt-2 text-xs font-medium text-ink">Add photos</p>
            <p className="mt-1 text-[10px] text-muted">
              {items.length}/{PRODUCT_IMAGE_LIMIT}
            </p>
          </label>
        ) : null}
      </div>

      <input
        id={inputId}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {displayError ? (
        <p className="text-sm text-accent-deep">{displayError}</p>
      ) : null}
    </div>
  );
}
