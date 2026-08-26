"use client";

import { useRef, useState } from "react";
import {
  ImagePreviewDialog,
  type PreviewImage,
} from "@/components/image-preview-dialog";
import { PortalIcon } from "@/components/portal-icons";
import {
  MEDIA_ACCEPT,
  MEDIA_ACCEPT_LABEL,
  PRODUCT_IMAGE_LIMIT,
  validateImageFile,
} from "@/lib/media-upload";
import { PRODUCT_SIZES } from "@/lib/product-sizes";
import {
  COLOR_SWATCHES,
  createColorDraft,
  type ColorDraft,
  type ColorDraftImage,
} from "@/lib/product-variants";

function newImageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ColorVariantEditor({
  value,
  onChange,
  disabled = false,
  compact = false,
  showSizes = true,
}: {
  value: ColorDraft[];
  onChange: (next: ColorDraft[]) => void;
  disabled?: boolean;
  compact?: boolean;
  showSizes?: boolean;
}) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    startIndex: number;
    title: string;
  } | null>(null);
  const libraryInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function updateDraft(key: string, patch: Partial<ColorDraft>) {
    onChange(value.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  }

  function addImages(key: string, files: FileList | File[] | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const draft = value.find((item) => item.key === key);
    if (!draft) return;

    const remaining = PRODUCT_IMAGE_LIMIT - draft.images.length;
    if (remaining <= 0) {
      setImageErrors((current) => ({
        ...current,
        [key]: `You can add up to ${PRODUCT_IMAGE_LIMIT} photos per color.`,
      }));
      return;
    }

    const accepted: ColorDraftImage[] = [];
    let rejection: string | null = null;
    let hitLimit = false;

    for (const file of incoming) {
      if (accepted.length >= remaining) {
        hitLimit = true;
        break;
      }
      const validationError = validateImageFile(file);
      if (validationError) {
        rejection = `${file.name}: ${validationError}`;
        continue;
      }
      accepted.push({
        id: newImageId(),
        url: URL.createObjectURL(file),
        file,
      });
    }

    setImageErrors((current) => ({
      ...current,
      [key]:
        hitLimit && !rejection
          ? `You can add up to ${PRODUCT_IMAGE_LIMIT} photos per color.`
          : rejection,
    }));
    if (accepted.length === 0) return;

    onChange(
      value.map((item) =>
        item.key === key ? { ...item, images: [...item.images, ...accepted] } : item,
      ),
    );
  }

  function makeMainImage(key: string, imageId: string) {
    onChange(
      value.map((draft) => {
        if (draft.key !== key) return draft;
        const target = draft.images.find((image) => image.id === imageId);
        if (!target) return draft;
        return {
          ...draft,
          images: [target, ...draft.images.filter((image) => image.id !== imageId)],
        };
      }),
    );
  }

  function removeImage(key: string, imageId: string) {
    setPreview(null);
    onChange(
      value.map((draft) => {
        if (draft.key !== key) return draft;
        const target = draft.images.find((image) => image.id === imageId);
        if (target?.file) URL.revokeObjectURL(target.url);
        return {
          ...draft,
          images: draft.images.filter((image) => image.id !== imageId),
        };
      }),
    );
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">Color options</p>
          <p className="text-xs text-muted">
            Add every color in one go — each gets its own photos{showSizes ? ", sizes," : ""} and stock.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, createColorDraft()])}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40 disabled:opacity-50"
        >
          + Add color
        </button>
      </div>

      {value.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([createColorDraft({ color_name: "Default" })])}
          className="w-full rounded-2xl border border-dashed border-line bg-background/60 px-4 py-8 text-center text-sm text-muted transition hover:border-accent/50 hover:bg-[#fff0f4]/60 disabled:opacity-50"
        >
          Add the first color for this product
        </button>
      ) : (
        <div className="space-y-3">
          {value.map((draft, index) => {
            const canAddPhotos = draft.images.length < PRODUCT_IMAGE_LIMIT;
            return (
              <div
                key={draft.key}
                className={`rounded-2xl border border-line bg-background/70 p-4 ${
                  compact ? "space-y-3" : "space-y-4"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <label className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-line shadow-sm">
                      <span
                        className="absolute inset-0"
                        style={{ background: draft.color_hex || "#c45b7a" }}
                      />
                      <input
                        type="color"
                        value={draft.color_hex || "#c45b7a"}
                        disabled={disabled}
                        onChange={(event) =>
                          updateDraft(draft.key, { color_hex: event.target.value })
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label={`Swatch for ${draft.color_name || "color"}`}
                      />
                    </label>
                    <input
                      type="text"
                      value={draft.color_name}
                      disabled={disabled}
                      onChange={(event) =>
                        updateDraft(draft.key, { color_name: event.target.value })
                      }
                      placeholder="Color name (e.g. Emerald)"
                      className="min-w-[160px] flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_SWATCHES.slice(0, 10).map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          disabled={disabled}
                          title={swatch.label}
                          onClick={() =>
                            updateDraft(draft.key, {
                              color_hex: swatch.hex,
                              color_name: draft.color_name.trim()
                                ? draft.color_name
                                : swatch.label,
                            })
                          }
                          className={`h-5 w-5 rounded-full border ${
                            draft.color_hex === swatch.hex
                              ? "border-ink ring-2 ring-ink/20"
                              : "border-line"
                          }`}
                          style={{ background: swatch.hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      onClick={() => moveDraft(index, -1)}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-muted disabled:opacity-40"
                      aria-label="Move color up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={disabled || index === value.length - 1}
                      onClick={() => moveDraft(index, 1)}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-muted disabled:opacity-40"
                      aria-label="Move color down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onChange([
                          ...value,
                          createColorDraft({
                            color_name: draft.color_name
                              ? `${draft.color_name} copy`
                              : "",
                            color_hex: draft.color_hex,
                            sizes: draft.sizes,
                            stock: draft.stock,
                          }),
                        ])
                      }
                      className="rounded-lg border border-line px-2 py-1 text-xs text-muted"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={disabled || value.length <= 1}
                      onClick={() => {
                        draft.images.forEach((image) => {
                          if (image.file) URL.revokeObjectURL(image.url);
                        });
                        onChange(value.filter((item) => item.key !== draft.key));
                      }}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-accent-deep disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDraggingKey(draft.key);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDraggingKey(draft.key);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setDraggingKey((current) => (current === draft.key ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggingKey(null);
                    addImages(draft.key, event.dataTransfer.files);
                  }}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted">
                      Photos for {draft.color_name.trim() || "this color"}
                    </p>
                    <p className="text-[11px] text-muted">
                      {draft.images.length}/{PRODUCT_IMAGE_LIMIT} photos
                      {draft.images.length > 0 ? " · tap to preview" : ""}
                    </p>
                  </div>

                  {draft.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {draft.images.map((image, imageIndex) => (
                        <div
                          key={image.id}
                          className="relative overflow-hidden rounded-xl border border-line bg-[#f2f2f3]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPreview({
                                images: draft.images.map((item, itemIndex) => ({
                                  url: item.url,
                                  label: `${
                                    draft.color_name.trim() || "Color"
                                  } · photo ${itemIndex + 1}`,
                                })),
                                startIndex: imageIndex,
                                title: draft.color_name.trim() || "Product photos",
                              })
                            }
                            className="block aspect-[3/4] w-full overflow-hidden"
                            title="Preview this photo"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.url}
                              alt={`${draft.color_name.trim() || "Color"} photo ${
                                imageIndex + 1
                              }`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          {imageIndex === 0 ? (
                            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                              Main
                            </span>
                          ) : null}
                          <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1">
                            {imageIndex !== 0 ? (
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => makeMainImage(draft.key, image.id)}
                                className="flex-1 rounded-full bg-white/95 px-1.5 py-1 text-[10px] font-semibold text-ink shadow-sm disabled:opacity-50"
                              >
                                Main
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => removeImage(draft.key, image.id)}
                              className="flex-1 rounded-full bg-ink/90 px-1.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {canAddPhotos ? (
                    <div
                      className={`rounded-2xl border-2 border-dashed px-3 py-4 transition ${
                        draggingKey === draft.key
                          ? "border-accent bg-[#fff0f4]"
                          : "border-[#d4d4d8] bg-[#f2f2f3]"
                      }`}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => cameraInputs.current[draft.key]?.click()}
                          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                        >
                          <PortalIcon name="camera" className="h-4 w-4" />
                          Take photo
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => libraryInputs.current[draft.key]?.click()}
                          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                        >
                          <PortalIcon name="image" className="h-4 w-4" />
                          Choose photos
                        </button>
                      </div>
                      <p className="mt-2 text-center text-[11px] text-muted">
                        Up to {PRODUCT_IMAGE_LIMIT} photos · {MEDIA_ACCEPT_LABEL}
                        <span className="hidden sm:inline"> · or drag and drop</span>
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-[#edf3f0] px-3 py-2 text-center text-xs text-[#466058]">
                      Photo limit reached for this color ({PRODUCT_IMAGE_LIMIT}).
                    </p>
                  )}

                  <input
                    ref={(node) => {
                      libraryInputs.current[draft.key] = node;
                    }}
                    type="file"
                    accept={MEDIA_ACCEPT}
                    multiple
                    className="sr-only"
                    disabled={disabled}
                    onChange={(event) => {
                      addImages(draft.key, event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <input
                    ref={(node) => {
                      cameraInputs.current[draft.key] = node;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    disabled={disabled}
                    onChange={(event) => {
                      addImages(draft.key, event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />

                  {imageErrors[draft.key] ? (
                    <p className="text-xs text-accent-deep">{imageErrors[draft.key]}</p>
                  ) : null}
                </div>

                <div className={showSizes ? "grid gap-3 sm:grid-cols-[1fr_120px]" : "grid gap-3"}>
                  {showSizes ? <div>
                    <p className="mb-2 text-xs font-medium text-muted">Sizes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRODUCT_SIZES.map((size) => {
                        const selected = draft.sizes.includes(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            onClick={() =>
                              updateDraft(draft.key, {
                                sizes: selected
                                  ? draft.sizes.filter((item) => item !== size)
                                  : [...draft.sizes, size],
                              })
                            }
                            className={`min-h-10 min-w-10 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                              selected
                                ? "border-ink bg-ink text-white"
                                : "border-line bg-white text-muted hover:border-ink/40"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div> : null}
                  <label className="block space-y-1.5 text-xs text-muted">
                    Stock
                    <input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={draft.stock}
                      onChange={(event) =>
                        updateDraft(draft.key, { stock: event.target.value })
                      }
                      className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview ? (
        <ImagePreviewDialog
          images={preview.images}
          startIndex={preview.startIndex}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
