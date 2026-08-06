"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MEDIA_ACCEPT,
  MEDIA_ACCEPT_LABEL,
  validateImageFile,
} from "@/lib/media-upload";

type Aspect = "square" | "banner" | "product";

const ASPECT_CLASS: Record<Aspect, string> = {
  square: "aspect-square max-w-40",
  banner: "aspect-[8/3] min-h-36 w-full",
  product: "aspect-[3/4] max-w-44",
};

export function ImageUploadField({
  label,
  hint,
  valueUrl,
  file,
  onFileChange,
  aspect = "square",
  required = false,
  error,
}: {
  label: string;
  hint?: string;
  valueUrl?: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  aspect?: Aspect;
  required?: boolean;
  error?: string | null;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function select(next: File | null) {
    setLocalError(null);
    if (!next) {
      onFileChange(null);
      return;
    }
    const validationError = validateImageFile(next);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    onFileChange(next);
  }

  const shown = preview ?? valueUrl ?? null;
  const displayError = error ?? localError;

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-muted">
          {label}
          {required ? <span className="text-accent-deep"> *</span> : null}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>

      <button
        type="button"
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
          select(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group relative block w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          ASPECT_CLASS[aspect]
        } ${
          dragging
            ? "border-accent bg-[#fff0f4]"
            : "border-line bg-background hover:border-accent/60"
        }`}
        aria-label={`Choose ${label.toLowerCase()}`}
      >
        <div className="relative h-full w-full overflow-hidden">
          {shown ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown}
                alt={`${label} preview`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25 transition group-hover:bg-black/40" />
              <div className="absolute inset-0 flex items-center justify-center p-3">
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-center text-xs font-medium text-ink shadow-sm">
                  Replace image
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-xl text-accent-deep shadow-sm">
                +
              </span>
              <p className="mt-2 text-sm font-medium text-ink">Drop an image here</p>
              <p className="mt-1 text-xs text-muted">
                or click to browse · {MEDIA_ACCEPT_LABEL}
              </p>
            </div>
          )}
        </div>
      </button>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={MEDIA_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-label={`Choose ${label.toLowerCase()}`}
        onChange={(e) => {
          select(e.target.files?.[0] ?? null);
          e.currentTarget.value = "";
        }}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-muted">Selected: {file.name}</p>
          <button
            type="button"
            onClick={() => select(null)}
            className="shrink-0 text-xs text-accent-deep hover:underline"
          >
            Remove
          </button>
        </div>
      ) : null}

      {displayError ? (
        <p className="text-sm text-accent-deep">{displayError}</p>
      ) : null}
    </div>
  );
}
