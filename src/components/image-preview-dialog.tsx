"use client";

import { useEffect, useState } from "react";

export type PreviewImage = {
  url: string;
  label?: string;
};

export function ImagePreviewDialog({
  images,
  startIndex = 0,
  title,
  onClose,
}: {
  images: PreviewImage[];
  startIndex?: number;
  title?: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, images.length - 1));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (images.length < 2) return;
      if (event.key === "ArrowRight") {
        setIndex((current) => (current + 1) % images.length);
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => (current - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length, onClose]);

  if (images.length === 0) return null;

  const active = images[Math.min(index, images.length - 1)];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Photo preview"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-[1.5rem] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative bg-[#f2f2f3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={active.label ?? title ?? "Uploaded photo"}
            className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
          />
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setIndex((current) => (current - 1 + images.length) % images.length)
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm text-ink shadow transition hover:bg-white"
                aria-label="Previous photo"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setIndex((current) => (current + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm text-ink shadow transition hover:bg-white"
                aria-label="Next photo"
              >
                →
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {active.label ?? title ?? "Uploaded photo"}
            </p>
            {images.length > 1 ? (
              <p className="text-xs text-muted">
                Photo {Math.min(index, images.length - 1) + 1} of {images.length}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
