"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadBrowseCategoryOptions } from "@/lib/store-category";
import { PRODUCT_SIZES } from "@/lib/product-sizes";
import { uploadProductImages, validateImageFile } from "@/lib/media-upload";
import { useOwnerStore } from "@/lib/use-owner-store";
import { PortalIcon } from "@/components/portal-icons";
import { PRODUCT_FABRICS } from "@/lib/product-fabrics";
import { UploadSuccessConfetti } from "@/components/upload-success-confetti";
import { SizeInventoryEditor } from "@/components/size-inventory-editor";
import { AiProcessingOverlay as SimpleAiProcessingOverlay } from "@/components/ai-processing-overlay";
import { aggregateBulkSizeStock } from "@/lib/product-variants";
import { CustomizationEditor } from "@/components/customization-editor";
import {
  defaultCustomizationConfig,
  type ProductCustomizationConfig,
} from "@/lib/product-customization";

type Photo = { id: string; file: File; preview: string };
type ColorGroup = {
  id: string;
  colorName: string;
  colorHex?: string;
  photos: Photo[];
  confidence?: number;
  needsReview?: boolean;
  sizes: string[];
  sizeStock: Record<string, number>;
  stock: string;
};
type Draft = {
  id: string;
  photos: Photo[];
  title: string;
  productTag: string;
  description: string;
  fabric: string;
  categorySlug: string;
  colorName: string;
  priceAed: string;
  stock: string;
  sizes: string[];
  sizeStock: Record<string, number>;
  customization: ProductCustomizationConfig;
  confidence?: number;
  needsReview?: boolean;
  /** True only when the title came from validated vision output. */
  aiGenerated?: boolean;
  generationStatus?: "ok" | "partial" | "failed" | "manual";
  failureReason?: string;
  colors: ColorGroup[];
};

type PublishProgress = {
  completed: number;
  total: number;
  currentProduct?: string;
  stage: "uploading" | "saving";
};

const BULK_UPLOAD_MAX_PHOTOS = 1_000;
const AI_ANALYSIS_MAX_PHOTOS = 30;
const MAX_PHOTOS_PER_COLOUR = 10;
const MAX_PRODUCTS_PER_PUBLISH = 100;
const BULK_UPLOAD_DRAFT_DB = "morni-bulk-upload-drafts";
const BULK_UPLOAD_DRAFT_STORE = "drafts";

function openBulkDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(BULK_UPLOAD_DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BULK_UPLOAD_DRAFT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local draft storage."));
  });
}

async function readBulkDraft(storeId: string): Promise<Draft[] | null> {
  try {
    const db = await openBulkDraftDb();
    return await new Promise<Draft[] | null>((resolve, reject) => {
      const request = db.transaction(BULK_UPLOAD_DRAFT_STORE, "readonly").objectStore(BULK_UPLOAD_DRAFT_STORE).get(storeId);
      request.onsuccess = () => {
        const saved = request.result as { drafts?: Array<Omit<Draft, "photos"> & { photos: Array<Omit<Photo, "preview">> }> } | undefined;
        if (!saved?.drafts) return resolve(null);
        resolve(saved.drafts.map((draft) => ({
          ...draft,
          // Older locally saved drafts predate per-colour size selection. Keep
          // them usable by inheriting the product's existing size selection.
          colors: draft.colors.map((color) => ({
            ...color,
            sizes: Array.isArray(color.sizes) ? color.sizes : draft.sizes,
          })),
          customization: draft.customization ?? defaultCustomizationConfig(),
          photos: draft.photos.map((photo) => ({ ...photo, preview: URL.createObjectURL(photo.file) })),
        })) as Draft[]);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function saveBulkDraft(storeId: string, drafts: Draft[]) {
  try {
    const db = await openBulkDraftDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(BULK_UPLOAD_DRAFT_STORE, "readwrite").objectStore(BULK_UPLOAD_DRAFT_STORE).put({
        drafts: drafts.map((draft) => ({ ...draft, photos: draft.photos.map(({ preview: _preview, ...photo }) => photo) })),
        updatedAt: Date.now(),
      }, storeId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Local recovery is best-effort; the active in-memory draft remains intact.
  }
}

async function clearBulkDraft(storeId: string) {
  try {
    const db = await openBulkDraftDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(BULK_UPLOAD_DRAFT_STORE, "readwrite").objectStore(BULK_UPLOAD_DRAFT_STORE).delete(storeId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Nothing to do if local cleanup is unavailable.
  }
}

function createColorGroup(colorName = "", sizes = ["S", "M", "L"], sizeStock: Record<string, number> = { S: 0, M: 0, L: 0 }) : ColorGroup {
  return { id: uid(), colorName, photos: [], sizes, sizeStock, stock: "0", needsReview: true };
}
function colourHexForName(name: string) {
  const value = name.toLowerCase();
  if (value.includes("black")) return "#171717";
  if (value.includes("pink")) return "#e88baa";
  if (value.includes("red")) return "#c94b4b";
  if (value.includes("blue")) return "#4d78ed";
  if (value.includes("green")) return "#4f9b78";
  if (value.includes("white")) return "#f7f7f4";
  if (value.includes("cream") || value.includes("beige")) return "#d8c4a4";
  if (value.includes("purple")) return "#8b6bb1";
  if (value.includes("yellow")) return "#e5b94e";
  if (value.includes("orange")) return "#e38b45";
  return "#245448";
}

function PhotoStack({
  draft,
  draftIndex,
  onMakeCover,
  onSplit,
  onMove,
  otherDrafts,
  showCoach,
  onDismissCoach,
}: {
  draft: Draft;
  draftIndex: number;
  onMakeCover: (photoId: string) => void;
  onSplit: (photoId: string) => void;
  onMove: (photoId: string, targetId: string) => void;
  otherDrafts: Array<{ id: string; label: string }>;
  showCoach: boolean;
  onDismissCoach: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cover = draft.photos[0];
  if (!cover) return null;

  return (
    <div
      className="mt-3 overflow-hidden rounded-2xl border border-[#dfe8e3] bg-[#f8fbf9] p-3"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#34594d]">
            Product photos
          </p>
          <p className="mt-1 text-xs text-muted">
            Click a photo to make it the cover.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#34594d]">
          {draft.photos.length} {draft.photos.length === 1 ? "photo" : "photos"}
        </span>
      </div>

      <div className="relative h-60 overflow-hidden rounded-xl bg-[#e8f0eb] p-2 sm:h-64">
        <img
          src={cover.preview}
          alt={`Product ${draftIndex + 1} cover`}
          className="h-full w-full rounded-lg object-contain shadow-sm transition duration-500"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        <span className="absolute left-4 top-4 rounded-full bg-ink/90 px-2.5 py-1 text-[10px] font-bold text-white">
          Cover photo
        </span>
        <span className="absolute bottom-4 left-4 text-xs font-semibold text-white drop-shadow">
          {expanded ? "Choose a photo below to change the cover" : draft.aiGenerated && draft.confidence && draft.confidence > 0 ? "AI-selected cover" : "Selected cover"}
        </span>
      </div>

      <div className={`mt-3 flex gap-2 overflow-x-auto pb-1 transition-all duration-300 ${expanded ? "max-h-24 opacity-100" : "max-h-16 opacity-90"}`}>
        {draft.photos.map((photo, photoIndex) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onMakeCover(photo.id)}
            aria-label={`${photoIndex === 0 ? "Current cover" : `Make photo ${photoIndex + 1} the cover`}`}
            className={`group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition duration-200 hover:-translate-y-0.5 sm:h-16 sm:w-16 ${photoIndex === 0 ? "border-[#245448] ring-2 ring-[#cfe5d8]" : "border-transparent hover:border-[#7ca994]"}`}
          >
            <img src={photo.preview} alt={`Photo ${photoIndex + 1}`} className="h-full w-full bg-[#e8f0eb] object-contain" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[9px] font-bold text-white">
              {photoIndex === 0 ? "Cover" : photoIndex + 1}
            </span>
          </button>
        ))}
      </div>

      <details className="mt-2 rounded-lg border border-[#dfe8e3] bg-white/70 px-3 md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-[#34594d]">
          <span>Photo actions</span>
          <span className="font-normal text-muted">Move or split</span>
        </summary>
        <div className="space-y-3 border-t border-[#e8efeb] py-3">
        {draft.photos.map((photo, photoIndex) => (
          <div key={photo.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs font-medium text-ink">Photo {photoIndex + 1}</span>
            <div className="flex min-w-0 gap-2">
              <select
                aria-label={`Move photo ${photoIndex + 1} to another product`}
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) onMove(photo.id, event.target.value);
                  event.currentTarget.value = "";
                }}
                disabled={!otherDrafts.length}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-xs text-ink disabled:opacity-60"
              >
                <option value="">Move to product</option>
                {otherDrafts.map((otherDraft) => (
                  <option key={otherDraft.id} value={otherDraft.id}>{otherDraft.label}</option>
                ))}
              </select>
              {photoIndex > 0 ? (
                <button type="button" onClick={() => onSplit(photo.id)} className="min-h-11 shrink-0 rounded-lg border border-[#e7c7d4] px-3 text-xs font-semibold text-accent-deep">
                  Split
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {showCoach ? (
          <div className="flex items-start justify-between gap-3 rounded-lg bg-[#fff7fa] px-3 py-2 text-xs leading-5 text-[#7b3e55]">
            <p><span className="font-semibold">Tip:</span> use Move to product or Split to fix photo groups.</p>
            <button type="button" onClick={onDismissCoach} className="min-h-11 shrink-0 px-2 font-semibold underline underline-offset-4">Got it</button>
          </div>
        ) : null}
        </div>
      </details>

      <details className="mt-2 hidden rounded-lg border border-[#dfe8e3] bg-white/70 px-3 py-2 md:block">
        <summary className="cursor-pointer text-xs font-semibold text-[#34594d]">
          Organize photos
        </summary>
        <div className="mt-3 space-y-2 border-t border-[#e8efeb] pt-3">
          {draft.photos.map((photo, photoIndex) => (
            <div key={photo.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="min-w-16 font-semibold text-ink">Photo {photoIndex + 1}</span>
              {photoIndex > 0 ? (
                <button type="button" onClick={() => onSplit(photo.id)} className="rounded-md border border-[#e7c7d4] px-2 py-1 font-semibold text-accent-deep hover:bg-[#fff3f7]">
                  Split into product
                </button>
              ) : null}
              <select
                aria-label={`Move photo ${photoIndex + 1} to another product`}
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) onMove(photo.id, event.target.value);
                }}
                className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
              >
                <option value="">Move to another product…</option>
                {otherDrafts.map((otherDraft) => (
                  <option key={otherDraft.id} value={otherDraft.id}>
                    {otherDraft.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className="text-[11px] leading-5 text-muted">The AI grouping is advisory. Keep the cover clean and use these controls only when a photo belongs elsewhere.</p>
        </div>
      </details>
    </div>
  );
}

function ColorGroupingPanel({
  draft,
  onAssign,
  onRename,
  onAdd,
  onRemove,
  onUnassign,
  onDeletePhoto,
  onStockChange,
  noSize,
  colorValidationErrors,
}: {
  draft: Draft;
  onAssign: (photoId: string, colorId: string) => void;
  onRename: (colorId: string, colorName: string, colorHex?: string) => void;
  onAdd: () => void;
  onRemove: (colorId: string) => void;
  onUnassign: (photoId: string) => void;
  onDeletePhoto: (photoId: string) => void;
  onStockChange: (colorId: string, sizes: string[], sizeStock: Record<string, number>, stock: string) => void;
  noSize: boolean;
  colorValidationErrors: Record<string, string[]>;
}) {
  const colors = draft.colors;
  const assignedPhotoIds = new Set(colors.flatMap((color) => color.photos.map((photo) => photo.id)));
  const unassignedPhotos = draft.photos.filter((photo) => !assignedPhotoIds.has(photo.id));
  return (
    <section className="mt-5 rounded-2xl border border-[#dfe8e3] bg-[#f8fbf9] p-5 sm:p-6" aria-label="Colour grouping">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#34594d]">Colours (optional)</p>
          <p className="mt-1 text-xs text-muted">AI groups products only. Add colours manually if this product has colourways.</p>
        </div>
        <button type="button" onClick={onAdd} className="rounded-full border-2 border-[#245448] bg-[#245448] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#173d34]">+ Add colour</button>
      </div>
      <div className="mt-5 grid gap-4">
        {colors.map((color) => {
          const colorErrors = colorValidationErrors[color.id] ?? [];
          const hasColorError = colorErrors.length > 0;
          return (
          <div key={color.id} className={`rounded-xl border bg-white p-4 sm:p-5 ${hasColorError ? "border-red-400 ring-1 ring-red-100" : "border-line"}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const photoId = event.dataTransfer.getData("photo-id"); if (photoId) onAssign(photoId, color.id); }}>
            <div className="flex items-center gap-2">
              <label className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line" title="Choose colour swatch">
                <input aria-label="Colour swatch" type="color" value={color.colorHex || colourHexForName(color.colorName)} onChange={(event) => onRename(color.id, color.colorName, event.target.value)} className="absolute -inset-2 h-14 w-14 cursor-pointer" />
              </label>
              <input value={color.colorName} onChange={(event) => onRename(color.id, event.target.value)} aria-invalid={colorErrors.includes("colour name")} placeholder="Colour name" className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold text-ink ${colorErrors.includes("colour name") ? "border-red-400" : "border-line"}`} />
              <button type="button" aria-label={`Remove ${color.colorName || "colour"} group`} onClick={() => onRemove(color.id)} className="rounded-lg p-2 text-accent-deep hover:bg-[#fff1f4]"><PortalIcon name="trash" className="h-4 w-4" /></button>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${color.needsReview ? "bg-[#fff1d8] text-[#98621b]" : "bg-[#e8f5ef] text-[#2f765e]"}`}>{color.needsReview ? "Review" : "Matched"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {color.photos.map((photo) => (
                <div key={photo.id} draggable onDragStart={(event) => { event.dataTransfer.setData("photo-id", photo.id); event.dataTransfer.effectAllowed = "move"; }} className="group relative aspect-square cursor-grab overflow-hidden rounded-lg bg-[#edf3ef] active:cursor-grabbing">
                  <img src={photo.preview} alt={`${color.colorName || "Colour"} product photo`} className="h-full w-full object-cover" />
                  <div className="absolute right-1 top-1 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <button type="button" onClick={() => onUnassign(photo.id)} className="rounded bg-white/95 px-1.5 py-1 text-[10px] font-semibold text-ink shadow" title="Move to unassigned photos">Unassign</button>
                    <button type="button" onClick={() => onDeletePhoto(photo.id)} className="rounded bg-white/95 p-1 text-accent-deep shadow" title="Delete this photo from the upload"><PortalIcon name="trash" className="h-3 w-3" /></button>
                  </div>
                  <select aria-label={`Assign photo to colour`} value={color.id} onChange={(event) => event.target.value === "__unassigned" ? onUnassign(photo.id) : onAssign(photo.id, event.target.value)} className="absolute inset-x-1 bottom-1 min-h-11 min-w-0 rounded bg-white/95 px-1 py-1 text-xs text-ink opacity-100 shadow transition sm:min-h-0 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                    <option value="__unassigned">Unassigned</option>
                    {colors.map((option) => <option key={option.id} value={option.id}>{option.colorName || "Unnamed"}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {noSize ? <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Colour stock<input type="number" min="0" value={color.stock} onChange={(event) => onStockChange(color.id, color.sizes, color.sizeStock, event.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm font-normal normal-case tracking-normal" /></label> : <div className="mt-3"><SizeInventoryEditor sizes={color.sizes} sizeStock={color.sizeStock} onChange={(sizes, stock) => onStockChange(color.id, sizes, stock, color.stock)} /></div>}
            <p className={`mt-2 text-[11px] ${hasColorError ? "font-semibold text-red-600" : "text-muted"}`}>{color.photos.length} / {MAX_PHOTOS_PER_COLOUR} photos · quantities can be entered before publishing</p>
            {hasColorError ? <p className="mt-2 text-xs font-medium text-red-600">Fix: {colorErrors.join(", ")}.</p> : null}
          </div>
        )})}
      </div>
      {colors.length ? (
        unassignedPhotos.length ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#d6b46a] bg-[#fffaf0] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b641f]">Unassigned photos</p>
            <p className="mt-1 text-xs text-[#8b641f]">Assign each photo to a colour, or delete photos that should not be published. Each colour supports up to {MAX_PHOTOS_PER_COLOUR} photos.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {unassignedPhotos.map((photo) => (
                <div key={photo.id} draggable onDragStart={(event) => { event.dataTransfer.setData("photo-id", photo.id); event.dataTransfer.effectAllowed = "move"; }} className="group relative overflow-hidden rounded-lg border border-[#ead8a8] bg-white">
                  <img src={photo.preview} alt="Unassigned product photo" className="aspect-square w-full cursor-grab object-cover active:cursor-grabbing" />
                  <button type="button" onClick={() => onDeletePhoto(photo.id)} className="absolute right-1 top-1 rounded bg-white/95 p-1 text-accent-deep shadow opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" title="Delete this photo from the upload"><PortalIcon name="trash" className="h-3.5 w-3.5" /></button>
                  <select aria-label="Assign unassigned photo to colour" defaultValue="" onChange={(event) => { if (event.target.value) onAssign(photo.id, event.target.value); }} className="w-full border-t border-[#ead8a8] bg-white px-2 py-2 text-xs text-ink">
                    <option value="">Choose colour…</option>
                    {colors.map((color) => <option key={color.id} value={color.id} disabled={color.photos.length >= MAX_PHOTOS_PER_COLOUR}>{color.colorName || "Unnamed colour"}{color.photos.length >= MAX_PHOTOS_PER_COLOUR ? ` · full (${MAX_PHOTOS_PER_COLOUR}/${MAX_PHOTOS_PER_COLOUR})` : ` (${color.photos.length}/${MAX_PHOTOS_PER_COLOUR})`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[#e8c56d] bg-[#fff6d8] px-4 py-3 text-center shadow-[0_0_24px_rgba(222,178,67,0.3)] ring-1 ring-[#fff1bc]">
            <p className="text-sm font-semibold text-[#735313]">All photos are assigned!</p>
          </div>
        )
      ) : null}
    </section>
  );
}

const noSizes = (slug: string) =>
  ["gifting", "hamper", "hampers"].includes(slug);
const uid = () => crypto.randomUUID();

function publishableStock(draft: Draft) {
  if (draft.colors.length) {
    return draft.colors.reduce((total, color) => total + (noSizes(draft.categorySlug)
      ? Number(color.stock || 0)
      : color.sizes.reduce((sum, size) => sum + Number(color.sizeStock[size] || 0), 0)), 0);
  }
  if (noSizes(draft.categorySlug)) return Number(draft.stock || 0);
  return draft.sizes.reduce((sum, size) => sum + Number(draft.sizeStock[size] || 0), 0);
}

function hasValidStockQuantities(draft: Draft) {
  const quantities = draft.colors.length
    ? draft.colors.flatMap((color) => noSizes(draft.categorySlug)
      ? [Number(color.stock || 0)]
      : color.sizes.map((size) => Number(color.sizeStock[size] || 0)))
    : noSizes(draft.categorySlug)
      ? [Number(draft.stock || 0)]
      : draft.sizes.map((size) => Number(draft.sizeStock[size] || 0));
  return quantities.every((quantity) => Number.isSafeInteger(quantity) && quantity >= 0);
}

function getDraftReadinessIssues(draft: Draft) {
  const issues: string[] = [];
  if (!draft.photos.length) issues.push("add photos");
  if (draft.photos.length > MAX_PHOTOS_PER_COLOUR && !draft.colors.length) issues.push(`use at most ${MAX_PHOTOS_PER_COLOUR} photos without colourways`);
  if (draft.title.trim().length < 3 || draft.title.trim().length > 120) issues.push("add a product name (3–120 characters)");
  if (!draft.categorySlug) issues.push("choose a category");
  if (!Number.isFinite(Number(draft.priceAed)) || Number(draft.priceAed) <= 0) issues.push("enter a price");
  if (draft.description.trim().length > 2_000) issues.push("shorten the description");
  if (!hasValidStockQuantities(draft) || publishableStock(draft) <= 0) issues.push("add valid stock");
  if (draft.colors.length > 20) issues.push("use at most 20 colours");
  const assignedPhotoIds = new Set(draft.colors.flatMap((color) => color.photos.map((photo) => photo.id)));
  if (draft.colors.length && draft.photos.some((photo) => !assignedPhotoIds.has(photo.id))) issues.push("assign every photo to a colour");
  if (draft.colors.some((color) => !color.colorName.trim() || color.colorName.trim().length > 80 || !color.photos.length || color.photos.length > MAX_PHOTOS_PER_COLOUR)) issues.push("check colour names and photos");
  if (!noSizes(draft.categorySlug) && draft.customization.enabled && !draft.customization.fields.length) issues.push("choose custom measurement fields");
  if (draft.productTag.trim() && !/^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(draft.productTag.trim())) issues.push("fix the product tag");
  return issues;
}

function isReadyToPublish(drafts: Draft[], busy: boolean) {
  if (busy || !drafts.length || drafts.length > MAX_PRODUCTS_PER_PUBLISH) return false;
  const tags = drafts.map((draft) => draft.productTag.trim().toUpperCase()).filter(Boolean);
  if (new Set(tags).size !== tags.length) return false;
  return drafts.every((draft) => getDraftReadinessIssues(draft).length === 0);
}

function emptyDraft(photos: Photo[] = []): Draft {
  return {
    id: uid(),
    photos,
    title: "",
    productTag: "",
    description: "",
    fabric: "",
    categorySlug: "",
    colorName: "",
    priceAed: "",
    stock: "",
    sizes: ["S", "M", "L"],
    sizeStock: { S: 0, M: 0, L: 0 },
    customization: defaultCustomizationConfig(),
    aiGenerated: false,
    generationStatus: "manual",
    colors: photos.length ? [] : [createColorGroup()],
  };
}

async function imageDataForAnalysis(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    // Keep each data URL small enough for a multi-image request while preserving
    // enough detail for visual matching.
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.5);
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result).replace(
          /^data:image\/jpg;/i,
          "data:image/jpeg;",
        );
        if (data.length > 6_000_000) {
          reject(new Error(`${file.name} is too large to prepare for AI analysis.`));
          return;
        }
        resolve(data);
      };
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  }
}

export default function BulkUploadPage() {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string | null>(null);
  const { store, loading } = useOwnerStore();
  const [categories, setCategories] = useState<
    Array<{ name: string; slug: string }>
  >([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      status: string;
      total_items: number;
      successful_items: number;
      failed_items: number;
      created_at: string;
    }>
  >([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyPhase, setBusyPhase] = useState<
    "idle" | "reading" | "analyzing" | "publishing"
  >("idle");
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishIssues, setPublishIssues] = useState<string[]>([]);
  const [uploadCelebrationKey, setUploadCelebrationKey] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [colorValidationErrors, setColorValidationErrors] = useState<Record<string, string[]>>({});
  const [draftsRestored, setDraftsRestored] = useState(false);
  function openPhotoPicker(targetDraftId?: string) {
    photoTargetRef.current = targetDraftId ?? null;
    photoInputRef.current?.click();
  }
  useEffect(() => {
    void loadBrowseCategoryOptions().then(setCategories);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!window.localStorage.getItem("morni.bulk-upload-coach-dismissed"))
        setShowCoach(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!store) return;
    import("@/lib/supabase/client").then(
      ({ createClient }) =>
        void createClient()
          .from("bulk_imports")
          .select(
            "id,status,total_items,successful_items,failed_items,created_at",
          )
          .eq("store_id", store.id)
          .order("created_at", { ascending: false })
          .limit(10)
          .then(({ data }) => setHistory((data ?? []) as typeof history)),
    );
  }, [store]);
  useEffect(() => {
    if (!store) return;
    let active = true;
    void readBulkDraft(store.id).then((saved) => {
      if (!active) return;
      if (saved?.length) {
        setDrafts(saved);
        const recoveryMessage = "Draft restored. You can continue where you left off.";
        setMessage(recoveryMessage);
        window.setTimeout(() => setMessage((current) => current === recoveryMessage ? null : current), 5000);
      }
      setDraftsRestored(true);
    });
    return () => { active = false; };
  }, [store]);
  useEffect(() => {
    if (!store || !draftsRestored) return;
    void saveBulkDraft(store.id, drafts);
  }, [drafts, draftsRestored, store]);
  function addFiles(list: FileList | File[], targetDraftId?: string) {
    const valid = Array.from(list).filter((file) => {
      if (!validateImageFile(file)) return true;
      if (file.size <= 0 || file.size > 8 * 1024 * 1024) return false;
      // Some mobile browsers leave File.type empty or report image/jpg.
      const extension = file.name.split(".").pop()?.toLowerCase();
      return Boolean(
        extension &&
        ["jpg", "jpeg", "png", "webp"].includes(extension) &&
        file.size <= 8 * 1024 * 1024,
      );
    });
    const queuedPhotoCount = drafts.reduce((total, draft) => total + draft.photos.length, 0);
    const remainingPhotoSlots = BULK_UPLOAD_MAX_PHOTOS - queuedPhotoCount;
    if (remainingPhotoSlots <= 0) {
      setMessage(`This batch already contains ${BULK_UPLOAD_MAX_PHOTOS} photos. Publish it or start a new batch before adding more.`);
      return;
    }
    if (valid.length > remainingPhotoSlots) {
      setMessage(`A bulk upload can contain up to ${BULK_UPLOAD_MAX_PHOTOS} photos. The first ${remainingPhotoSlots} valid photo${remainingPhotoSlots === 1 ? "" : "s"} were added; add the remaining photos in a new upload.`);
    }
    const accepted = valid.slice(0, remainingPhotoSlots);
    if (!accepted.length) {
      setMessage(`Upload up to ${BULK_UPLOAD_MAX_PHOTOS} valid JPG, PNG, or WebP images.`);
      return;
    }
    // Stage photos only — never derive product titles/groups from filenames.
    // Vision analysis creates the product groups.
    const stagedPhotos = accepted.map((file) => ({
      id: uid(),
      file,
      preview: URL.createObjectURL(file),
    }));
    const stagedDrafts = stagedPhotos.map((photo) => emptyDraft([photo]));
    const nextDrafts = targetDraftId
      ? drafts.map((draft) => draft.id === targetDraftId ? { ...draft, photos: [...draft.photos, ...stagedPhotos] } : draft)
      : [...drafts, ...stagedDrafts];
    setDrafts(nextDrafts);
    setMessage(
      `Uploading ${stagedPhotos.length} photo${stagedPhotos.length === 1 ? "" : "s"}… AI is analysing your photos.`,
    );
    void analyze(nextDrafts);
  }
  function patch(draftId: string, changes: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, ...changes } : draft,
      ),
    );
  }
  function assignColor(draftId: string, photoId: string, colorId: string) {
    const target = drafts.find((draft) => draft.id === draftId)?.colors.find((color) => color.id === colorId);
    if (target && !target.photos.some((photo) => photo.id === photoId) && target.photos.length >= MAX_PHOTOS_PER_COLOUR) {
      setMessage(`${target.colorName || "This colour"} already has ${MAX_PHOTOS_PER_COLOUR} photos. Remove or unassign a photo before adding another.`);
      return;
    }
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId || !draft.colors.length) return draft;
      const photo = draft.photos.find((item) => item.id === photoId);
      if (!photo) return draft;
      return { ...draft, colors: draft.colors.map((color) => ({ ...color, photos: color.id === colorId ? [...color.photos.filter((item) => item.id !== photoId), photo] : color.photos.filter((item) => item.id !== photoId) })) };
    }));
  }
  function renameColor(draftId: string, colorId: string, colorName: string, colorHex?: string) {
    setDrafts((current) => current.map((draft) => draft.id === draftId ? { ...draft, colors: draft.colors.map((color) => color.id === colorId ? { ...color, colorName, colorHex: colorHex ?? color.colorHex, needsReview: !colorName.trim() } : color) } : draft));
  }
  function addColor(draftId: string) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId) return draft;
      return { ...draft, colors: [...draft.colors, createColorGroup("", draft.sizes, draft.sizeStock)] };
    }));
  }
  function removeColor(draftId: string, colorId: string) {
    setDrafts((current) => current.map((draft) => draft.id === draftId ? { ...draft, colors: draft.colors.filter((color) => color.id !== colorId) } : draft));
  }
  function unassignColor(draftId: string, photoId: string) {
    setDrafts((current) => current.map((draft) => draft.id === draftId ? { ...draft, colors: draft.colors.map((color) => ({ ...color, photos: color.photos.filter((photo) => photo.id !== photoId) })) } : draft));
  }
  function deletePhoto(draftId: string, photoId: string) {
    const photo = drafts.find((draft) => draft.id === draftId)?.photos.find((item) => item.id === photoId);
    if (photo) URL.revokeObjectURL(photo.preview);
    setDrafts((current) => current.map((draft) => draft.id === draftId ? { ...draft, photos: draft.photos.filter((item) => item.id !== photoId), colors: draft.colors.map((color) => ({ ...color, photos: color.photos.filter((item) => item.id !== photoId) })) } : draft));
  }
  function updateColorStock(draftId: string, colorId: string, sizes: string[], sizeStock: Record<string, number>, stock: string) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId) return draft;
      const colors = draft.colors.map((color) => color.id === colorId ? { ...color, sizes, sizeStock, stock } : color);
      const total = publishableStock({ ...draft, colors });
      const productSizes = [...new Set(colors.flatMap((color) => color.sizes))];
      return { ...draft, colors, sizes: productSizes, stock: String(total), sizeStock: aggregateBulkSizeStock(colors, productSizes) };
    }));
  }
  function hasValidationError(draftId: string, field: string) {
    return validationErrors[draftId]?.includes(field) ?? false;
  }
  function hasProductTagError(draftId: string) {
    return hasValidationError(draftId, "unique product tag") || hasValidationError(draftId, "product tag format");
  }
  function move(photoId: string, targetId: string) {
    const source = drafts.find((draft) =>
      draft.photos.some((photo) => photo.id === photoId),
    );
    const photo = source?.photos.find((item) => item.id === photoId);
    if (!source || !photo || source.id === targetId) return;
    setDrafts((current) =>
      current
        .map((draft) =>
          draft.id === source.id
            ? {
                ...draft,
                photos: draft.photos.filter((item) => item.id !== photoId),
              }
            : draft.id === targetId
              ? { ...draft, photos: [...draft.photos, photo] }
              : draft,
        )
        .filter((draft) => draft.photos.length),
    );
  }
  function makeCover(draftId: string, photoId: string) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== draftId) return draft;
        const index = draft.photos.findIndex((photo) => photo.id === photoId);
        if (index <= 0) return draft;
        const photos = [...draft.photos];
        const [picked] = photos.splice(index, 1);
        photos.unshift(picked);
        return { ...draft, photos };
      }),
    );
  }
  function split(draftId: string, photoId: string) {
    const draft = drafts.find((item) => item.id === draftId);
    const photo = draft?.photos.find((item) => item.id === photoId);
    if (!draft || !photo || draft.photos.length < 2) return;
    setDrafts((current) =>
      current.flatMap((item) =>
        item.id !== draftId
          ? [item]
          : [
              { ...item, photos: item.photos.filter((p) => p.id !== photoId) },
              {
                ...emptyDraft([photo]),
                generationStatus: "manual",
                needsReview: true,
              },
            ],
      ),
    );
  }
  function addRow() {
    setDrafts((current) => [...current, emptyDraft()]);
  }
  async function analyze(draftsToAnalyze: Draft[] = drafts) {
    if (!store || !draftsToAnalyze.length || busy) return;
    const photoCount = draftsToAnalyze.reduce(
      (total, draft) => total + draft.photos.length,
      0,
    );
    if (!photoCount) {
      setMessage("Add product photos before running AI.");
      return;
    }
    setBusy(true);
    setBusyPhase("reading");
    setMessage("Preparing photos securely…");
    try {
      const images = await Promise.all(
        draftsToAnalyze.flatMap((draft) =>
          draft.photos.map(async (photo) => ({
            id: photo.id,
            // Filename is metadata for the API only — never used as a title.
            name: photo.file.name,
            data: await imageDataForAnalysis(photo.file),
          })),
        ),
      );
      setBusyPhase("analyzing");
      const photoMap = new Map(
        draftsToAnalyze.flatMap((draft) =>
          draft.photos.map((photo) => [photo.id, photo]),
        ),
      );
      const categoryByPhoto = new Map(
        draftsToAnalyze.flatMap((draft) =>
          draft.photos.map((photo) => [photo.id, draft.categorySlug] as const),
        ),
      );
      const batches = Array.from(
        { length: Math.ceil(images.length / AI_ANALYSIS_MAX_PHOTOS) },
        (_, index) =>
          images.slice(
            index * AI_ANALYSIS_MAX_PHOTOS,
            (index + 1) * AI_ANALYSIS_MAX_PHOTOS,
          ),
      );
      const grouped: Draft[] = [];
      const warnings: string[] = [];
      let overallStatus: "ok" | "partial" | "failed" | "manual" = "ok";
      for (const [batchIndex, batch] of batches.entries()) {
        setBusyPhase("analyzing");
        setMessage(
          batches.length > 1
            ? `AI is analysing batch ${batchIndex + 1} of ${batches.length} (${batch.length} photos)…`
            : `AI is analysing ${batch.length} photos…`,
        );
        const response = await fetch("/api/portal/products/bulk-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Client allowance above provider timeout (45s) + one retry.
          signal: AbortSignal.timeout(110_000),
          body: JSON.stringify({ storeId: store.id, images: batch }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "AI grouping failed. You can continue manually.",
          );
        if (result.warning) warnings.push(result.warning);
        if (result.status === "failed") overallStatus = "failed";
        else if (result.status === "partial" && overallStatus === "ok")
          overallStatus = "partial";
        grouped.push(
          ...result.groups
            .map((group: {
                imageIds: string[];
                title: string;
                description: string;
                colorName: string;
                confidence: number;
                needsReview: boolean;
                aiGenerated?: boolean;
                generationStatus?: Draft["generationStatus"];
                failureReason?: string;
              }) => {
                const photos = group.imageIds
                  .map((imageId) => photoMap.get(imageId))
                  .filter(Boolean) as Photo[];
                const selectedCategories = new Set(
                  photos
                    .map((photo) => categoryByPhoto.get(photo.id))
                    .filter((slug): slug is string => Boolean(slug)),
                );
                const hasConsistentSellerCategory = photos.length > 0 &&
                  photos.every((photo) => Boolean(categoryByPhoto.get(photo.id))) &&
                  selectedCategories.size === 1;
                return {
                  id: uid(),
                  photos,
                  title: group.title ?? "",
                  description: group.description ?? "",
                  fabric: "",
                  categorySlug: hasConsistentSellerCategory ? [...selectedCategories][0] ?? "" : "",
                  colorName: group.colorName ?? "",
                  productTag: "",
                  priceAed: "",
                  stock: "",
                  sizes: ["S", "M", "L"] as string[],
                  sizeStock: { S: 0, M: 0, L: 0 },
                  customization: defaultCustomizationConfig(),
                  confidence: group.confidence,
                  needsReview: group.needsReview,
                  aiGenerated: Boolean(group.aiGenerated),
                  generationStatus: group.generationStatus ?? "manual",
                  failureReason: group.failureReason,
                  // Colourways are intentionally manual; AI only groups photos into products.
                  colors: [] as ColorGroup[],
                };
              })
            .filter((draft: Draft) => draft.photos.length),
        );
      }
      const safeGroups = grouped.map((draft) => ({
        ...draft,
        needsReview:
          draft.needsReview ||
          draft.generationStatus === "failed" ||
          draft.generationStatus === "partial" ||
          draft.colors.some((color) => color.needsReview),
      }));
      const failedCount = safeGroups.filter(
        (draft) => draft.generationStatus === "failed" || !draft.title.trim(),
      ).length;
      setDrafts(safeGroups);
      const summary = `AI grouped ${images.length} photos into ${safeGroups.length} product${safeGroups.length === 1 ? "" : "s"}.`;
      const batchNote =
        batches.length > 1
          ? " Photos were analysed in separate batches — review any matching views that landed apart."
          : "";
      if (overallStatus === "failed") {
        setMessage(
          `${warnings[0] ?? "AI details couldn't be generated."} ${summary} Edit titles manually or tap Retry AI.`,
        );
      } else {
        setMessage(
          `${warnings[0] ? `${warnings[0]} ` : ""}${summary}${batchNote}${
            failedCount
              ? ` ${failedCount} product${failedCount === 1 ? " needs" : "s need"} a name before publishing.`
              : " Review flagged groups before publishing."
          }`,
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI analysis failed. You can continue manually.",
      );
    } finally {
      setBusy(false);
      setBusyPhase("idle");
    }
  }
  async function publish() {
    if (!store || !drafts.length) return;
    if (drafts.length > MAX_PRODUCTS_PER_PUBLISH) {
      setPublishIssues([`Publish up to ${MAX_PRODUCTS_PER_PUBLISH} products at a time. This batch contains ${drafts.length}.`]);
      setMessage("Split this batch before publishing.");
      window.setTimeout(() => document.querySelector("[data-upload-message]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    const missingByDraft = Object.fromEntries(
      drafts
        .map((draft) => {
          const missing = [
            !draft.photos.length ? "photos" : null,
            draft.title.trim().length < 3 || draft.title.trim().length > 120 ? "product name" : null,
            !draft.categorySlug ? "category" : null,
            !Number.isFinite(Number(draft.priceAed)) || Number(draft.priceAed) <= 0 ? "price" : null,
            draft.description.trim().length > 2_000 ? "description" : null,
            !hasValidStockQuantities(draft) || publishableStock(draft) <= 0 ? "stock" : null,
            draft.colors.length > 20 ? "colour count" : null,
          ].filter((field): field is string => Boolean(field));
          return [draft.id, missing] as const;
        })
        .filter(([, missing]) => missing.length),
    ) as Record<string, string[]>;
    const nextColorValidationErrors: Record<string, string[]> = {};
    drafts.forEach((draft, draftIndex) => {
      const productTitle = draft.title.trim() || `Product ${draftIndex + 1}`;
      const assignedPhotoIds = new Set(draft.colors.flatMap((color) => color.photos.map((photo) => photo.id)));
      if (draft.colors.length && draft.photos.some((photo) => !assignedPhotoIds.has(photo.id)))
        missingByDraft[draft.id] = [...(missingByDraft[draft.id] ?? []), "assign every photo to a colour or delete it"];
      if (!draft.colors.length && draft.photos.length > MAX_PHOTOS_PER_COLOUR)
        missingByDraft[draft.id] = [...(missingByDraft[draft.id] ?? []), `maximum ${MAX_PHOTOS_PER_COLOUR} photos without colourways`];
      if (!noSizes(draft.categorySlug) && draft.customization.enabled && !draft.customization.fields.length)
        missingByDraft[draft.id] = [...(missingByDraft[draft.id] ?? []), "choose at least one custom measurement"];
      draft.colors.forEach((color, colorIndex) => {
        const errors = [
          !color.colorName.trim() || color.colorName.trim().length > 80 ? "colour name (1–80 characters)" : null,
          !color.photos.length ? "at least one photo" : null,
          color.photos.length > MAX_PHOTOS_PER_COLOUR ? `maximum ${MAX_PHOTOS_PER_COLOUR} photos (currently ${color.photos.length})` : null,
        ].filter((error): error is string => Boolean(error));
        if (errors.length) nextColorValidationErrors[color.id] = errors.map((error) => `${productTitle} → ${color.colorName.trim() || `Colour ${colorIndex + 1}`}: ${error}`);
      });
    });
    const tags = drafts.map((draft) => draft.productTag.trim().toUpperCase()).filter(Boolean);
    drafts.forEach((draft) => {
      const tag = draft.productTag.trim();
      if (tag && !/^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(tag))
        missingByDraft[draft.id] = [...(missingByDraft[draft.id] ?? []), "product tag format"];
    });
    if (new Set(tags).size !== tags.length) {
      drafts.forEach((draft) => {
        const tag = draft.productTag.trim().toUpperCase();
        if (tag && tags.filter((value) => value === tag).length > 1)
          missingByDraft[draft.id] = [...(missingByDraft[draft.id] ?? []), "unique product tag"];
      });
    }
    if (Object.keys(missingByDraft).length || Object.keys(nextColorValidationErrors).length) {
      setValidationErrors(missingByDraft);
      setColorValidationErrors(nextColorValidationErrors);
      const productIssues = Object.entries(missingByDraft)
        .map(([draftId, fields]) => {
          const draft = drafts.find((item) => item.id === draftId);
          const title = draft?.title.trim() || `Product ${drafts.findIndex((item) => item.id === draftId) + 1}`;
          return `${title}: ${fields.map((field) => {
            if (field === "stock") return draft && !hasValidStockQuantities(draft)
              ? "stock quantities must be whole numbers"
              : noSizes(draft?.categorySlug ?? "") && !draft?.colors.length
                ? "enter at least 1 unit of stock"
                : "enter at least 1 unit in a selected size or colour";
            if (field === "product name") return "product name must be 3–120 characters";
            if (field === "price") return "enter a price greater than zero";
            if (field === "description") return "description must be at most 2,000 characters";
            if (field === "colour count") return "use at most 20 colours";
            return field;
          }).join(", ")}`;
        });
      const colorIssues = drafts
        .flatMap((draft, draftIndex) => draft.colors.map((color, colorIndex) => ({ draftIndex, colorIndex, errors: nextColorValidationErrors[color.id] })))
        .filter((color): color is { draftIndex: number; colorIndex: number; errors: string[] } => Boolean(color.errors))
        .flatMap((color) => color.errors);
      const issues = [...productIssues, ...colorIssues];
      setPublishIssues(issues);
      setMessage(`Fix ${issues.length} highlighted issue${issues.length === 1 ? "" : "s"} before publishing.`);
      window.setTimeout(() => document.querySelector("[data-upload-message]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    setValidationErrors({});
    setColorValidationErrors({});
    setPublishIssues([]);
    setBusy(true);
    setBusyPhase("publishing");
    setMessage(null);
    const totalPhotoCount = drafts.reduce((total, draft) => total + draft.photos.length, 0);
    let uploadedPhotoCount = 0;
    setPublishProgress({ completed: 0, total: totalPhotoCount, stage: "uploading" });
    try {
      const items = [];
      for (const draft of drafts) {
        if (
          !draft.photos.length ||
          !draft.title.trim() ||
          !draft.categorySlug ||
          !draft.priceAed ||
          publishableStock(draft) <= 0
        )
          throw new Error(
            `Complete the photos, name, category, price, and stock for ${draft.title || "a draft"}.`,
          );
        const sourceColors = draft.colors.length ? draft.colors : [{ ...createColorGroup(draft.colorName || "Default", draft.sizes, draft.sizeStock), photos: draft.photos, stock: draft.stock }];
        const assignedPhotoIds = new Set(sourceColors.flatMap((color) => color.photos.map((photo) => photo.id)));
        const unassignedPhotos = draft.photos.filter((photo) => !assignedPhotoIds.has(photo.id));
        const colors = sourceColors.map((color, colorIndex) => ({
          ...color,
          colorName: color.colorName.trim() || (colorIndex === 0 ? draft.colorName.trim() : "Default"),
          photos: color.photos,
        }));
        if (unassignedPhotos.length || colors.some((color) => !color.photos.length || !color.colorName || color.photos.length > MAX_PHOTOS_PER_COLOUR)) throw new Error(`Fix the highlighted colour assignments for ${draft.title} before publishing.`);
        const aggregateSizeStock = noSizes(draft.categorySlug) ? {} : aggregateBulkSizeStock(colors, draft.sizes);
        const variants = [];
        for (const color of colors) {
          let images: string[];
          try {
            images = await uploadProductImages({
              storeId: store.id,
              files: color.photos.map((photo) => photo.file),
              onFileUploaded: () => {
                uploadedPhotoCount += 1;
                setPublishProgress({
                  completed: uploadedPhotoCount,
                  total: totalPhotoCount,
                  currentProduct: draft.title,
                  stage: "uploading",
                });
              },
            });
          } catch (error) {
            const detail = error instanceof Error ? error.message : "image upload failed";
            throw new Error(`${draft.title || "Untitled product"} → ${color.colorName}: ${detail}. Check the photos in this colour group and try again.`);
          }
          const variantSizeStock = noSizes(draft.categorySlug) ? {} : Object.fromEntries(color.sizes.map((size) => [size, Number(color.sizeStock[size] || 0)]));
          const colorStock = noSizes(draft.categorySlug) ? Number(color.stock || 0) : Object.values(variantSizeStock).reduce((sum, quantity) => sum + quantity, 0);
          variants.push({ colorName: color.colorName.trim(), colorHex: color.colorHex ?? null, sizes: noSizes(draft.categorySlug) ? [] : color.sizes, sizeStock: variantSizeStock, stock: colorStock, images });
        }
        items.push({
          title: draft.title,
          productTag: draft.productTag,
          description: draft.description,
          fabric: noSizes(draft.categorySlug) ? null : draft.fabric || null,
          categorySlug: draft.categorySlug,
          priceAed: Number(draft.priceAed),
          stock: publishableStock(draft),
          sizes: noSizes(draft.categorySlug) ? [] : draft.sizes,
          sizeStock: aggregateSizeStock,
          customization: noSizes(draft.categorySlug)
            ? { ...defaultCustomizationConfig(), enabled: false, fields: [] }
            : draft.customization,
          images: variants.flatMap((variant) => variant.images).slice(0, MAX_PHOTOS_PER_COLOUR),
          variants,
        });
      }
      setPublishProgress({ completed: uploadedPhotoCount, total: totalPhotoCount, stage: "saving" });
      const response = await fetch("/api/portal/products/bulk-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": uid(),
        },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({ storeId: store.id, items }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error((result.issues ?? [result.error ?? "Bulk publish failed."]).join(" · "));
      if (result.failed || result.created !== drafts.length || result.results?.length !== drafts.length) {
        if (result.created > 0) setUploadCelebrationKey(Date.now());
        const failures = (result.results ?? [])
          .filter((item: { ok: boolean }) => !item.ok)
          .map((item: { title: string; error?: string }) => `${item.title}: ${item.error ?? "could not be published"}`)
          .filter(Boolean);
        setPublishIssues(failures);
        const publishedIndexes = new Set<number>((result.results ?? []).filter((item: { ok: boolean }) => item.ok).map((item: { index: number }) => item.index));
        setDrafts((current) => current.filter((_, index) => !publishedIndexes.has(index)));
        setMessage(`${result.created} of ${drafts.length} products published. Review the remaining products and publish again.`);
        return;
      }
      setMessage(
        `${result.created} products published${result.failed ? `, ${result.failed} failed` : ""}.`,
      );
      if (result.created > 0) setUploadCelebrationKey(Date.now());
      setDrafts([]);
      if (store) void clearBulkDraft(store.id);
      router.replace("/portal/products");
    } catch (error) {
      // Keep uploaded media when the server response is uncertain: a timeout can
      // happen after products were committed, and deleting their images breaks them.
      const issue = error instanceof Error ? error.message : "Bulk publish failed.";
      setPublishIssues(issue.split(" · "));
      setMessage("Publishing stopped. Fix the issue below and try again.");
      window.setTimeout(() => document.querySelector("[data-upload-message]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    } finally {
      setBusy(false);
      setBusyPhase("idle");
      setPublishProgress(null);
    }
  }
  async function retryImport(importId: string) {
    if (!store) return;
    setBusy(true);
    setBusyPhase("publishing");
    setMessage("Retrying failed products…");
    try {
      const response = await fetch("/api/portal/products/bulk-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": uid(),
        },
        body: JSON.stringify({ storeId: store.id, importId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error((result.issues ?? [result.error ?? "Retry failed."]).join(" · "));
      setMessage(
        `${result.created} products published${result.failed ? `, ${result.failed} still failed` : ""}.`,
      );
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient()
        .from("bulk_imports")
        .select(
          "id,status,total_items,successful_items,failed_items,created_at",
        )
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((data ?? []) as typeof history);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Retry failed.";
      setPublishIssues(issue.split(" · "));
      setMessage("Retry stopped. Fix the issue below and try again.");
    } finally {
      setBusy(false);
      setBusyPhase("idle");
    }
  }
  if (loading)
    return <main className="mx-auto max-w-6xl px-4 py-10">Loading…</main>;
  const busyLabel =
    busyPhase === "reading"
      ? "Preparing photos…"
      : busyPhase === "analyzing"
        ? "Grouping product views…"
        : busyPhase === "publishing"
          ? "Publishing products…"
          : "Analyze and group with AI";
  const canPublish = Boolean(store) && isReadyToPublish(drafts, busy);
  const photoCount = drafts.reduce((sum, draft) => sum + draft.photos.length, 0);
  const duplicateProductTags = (() => {
    const tags = drafts.map((draft) => draft.productTag.trim().toUpperCase()).filter(Boolean);
    return new Set(tags).size !== tags.length;
  })();
  const firstIncompleteDraft = drafts.find((draft) => getDraftReadinessIssues(draft).length > 0);
  const readinessHint = busy
    ? busyLabel
    : !store
      ? "Choose a store before publishing."
    : drafts.length > MAX_PRODUCTS_PER_PUBLISH
      ? `Publish up to ${MAX_PRODUCTS_PER_PUBLISH} products at a time.`
      : duplicateProductTags
        ? "Product tags must be unique."
        : firstIncompleteDraft
          ? `${firstIncompleteDraft.title.trim() || `Product ${drafts.indexOf(firstIncompleteDraft) + 1}`}: ${getDraftReadinessIssues(firstIncompleteDraft).slice(0, 2).join(" and ")}.`
          : "Ready to publish";

  return (
    <div className="mx-auto w-full max-w-7xl px-0 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-0 lg:pb-0">
      <UploadSuccessConfetti celebrationKey={uploadCelebrationKey} />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">
            Store owner portal
          </p>
          <h1 className="mt-1 font-display text-2xl leading-tight text-ink sm:mt-2 sm:text-4xl">
            Bulk upload studio
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted sm:mt-2 sm:leading-6">
            Add photos, review AI suggestions, then publish when ready.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/portal/products")}
          className="min-h-11 shrink-0 px-2 text-xs font-semibold text-[#245448] underline underline-offset-4 sm:border sm:border-line sm:px-4 sm:text-sm sm:no-underline"
        >
          <span className="sm:hidden">Back</span><span className="hidden sm:inline">Back to products</span>
        </button>
      </header>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label="Add product photos"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files, photoTargetRef.current ?? undefined);
          photoTargetRef.current = null;
          event.currentTarget.value = "";
        }}
      />
      <div className="mt-4 sm:hidden">
        <button type="button" onClick={() => openPhotoPicker()} className="min-h-12 w-full rounded-xl bg-[#245448] px-4 text-sm font-semibold text-white shadow-sm">
          + Add photos
        </button>
        <p className="mt-2 text-center text-xs text-muted">JPG, PNG or WebP · up to {BULK_UPLOAD_MAX_PHOTOS.toLocaleString()} photos</p>
      </div>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`mt-6 hidden min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center sm:mt-8 sm:flex sm:min-h-36 sm:p-6 ${dragging ? "border-accent bg-[#fff0f4]" : "border-line bg-surface"}`}
      >
        <span className="text-3xl text-accent-deep">+</span>
        <span className="mt-2 font-semibold text-ink">
          Drop product photos here
        </span>
        <span className="mt-1 text-sm text-muted">
          JPG, PNG or WebP · up to {BULK_UPLOAD_MAX_PHOTOS.toLocaleString()} photos per upload · AI reviews groups of {AI_ANALYSIS_MAX_PHOTOS}
        </span>
        <button type="button" onClick={() => openPhotoPicker()} className="mt-3 min-h-11 rounded-lg bg-[#245448] px-4 text-sm font-semibold text-white">Choose photos</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
        <button
          type="button"
          onClick={addRow}
          className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold"
        >
          + New product row
        </button>
        {drafts.some((draft) => draft.photos.length) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void analyze(drafts)}
            className="min-h-11 rounded-lg border border-[#245448] bg-[#245448] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Retry AI analysis
          </button>
        ) : null}
      </div>
      {busy ? (
        <div
          className="mt-5 rounded-xl border border-[#d9e5de] bg-[#f7fbf8] px-4 py-3 text-sm text-[#245448]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-[#b7cfc2] border-t-[#245448]"
              aria-hidden="true"
            />
            <span>{busyLabel} This may take a few seconds.</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dcebe2]">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#5d9a78]" />
          </div>
        </div>
      ) : null}
      {publishIssues.length ? (
        <section data-upload-message className="mt-5 rounded-xl border border-red-200 bg-[#fff1f1] px-4 py-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">Fix these issues before publishing:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {publishIssues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
          </ul>
        </section>
      ) : null}
      {message ? (
        <p data-upload-message className={`mt-3 rounded-xl px-3 py-2.5 text-sm leading-5 sm:mt-5 sm:px-4 sm:py-3 ${Object.keys(validationErrors).length || Object.keys(colorValidationErrors).length || publishIssues.length ? "bg-[#fff1f1] text-red-700" : "bg-[#eef8f1] text-[#245448]"}`} role={Object.keys(validationErrors).length || Object.keys(colorValidationErrors).length || publishIssues.length ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
      <div className={`mt-4 grid gap-3 sm:mt-6 sm:gap-6 ${drafts.length === 1 ? "grid-cols-1" : "lg:grid-cols-2"}`}>
        {drafts.map((draft, index) => (
          <article
            key={draft.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files, draft.id);
              else move(event.dataTransfer.getData("photo-id"), draft.id);
            }}
            className={`rounded-2xl border bg-white p-3 shadow-[0_8px_24px_-22px_rgba(20,35,29,0.45)] sm:p-4 ${validationErrors[draft.id]?.length ? "border-red-400" : "border-line"}`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-deep sm:text-xs sm:tracking-[0.14em]">
                Product {index + 1}
                {draft.aiGenerated && draft.confidence != null && draft.confidence > 0
                  ? ` · AI confidence ${Math.round(draft.confidence * 100)}%`
                  : ""}
                {draft.generationStatus === "failed"
                  ? " · AI failed"
                  : draft.needsReview
                    ? " · Review grouping"
                    : ""}
              </p>
              <label className="mt-1 block">
                <span className="sr-only">Product name</span>
                <input
                  value={draft.title}
                  onChange={(event) => patch(draft.id, { title: event.target.value, aiGenerated: false, generationStatus: "manual", failureReason: undefined })}
                  aria-invalid={hasValidationError(draft.id, "product name")}
                  className={`w-full min-w-0 border-b bg-transparent py-1 font-display text-xl leading-tight text-ink outline-none placeholder:text-[#89938e] ${hasValidationError(draft.id, "product name") ? "border-red-400" : "border-transparent focus:border-[#9cb9aa]"}`}
                  placeholder="Add product name"
                />
              </label>
              </div>
              <details className="relative shrink-0">
                <summary aria-label={`Product ${index + 1} actions`} className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg text-[#596760] hover:bg-[#f3f6f4]">
                  <PortalIcon name="more" className="h-5 w-5" />
                </summary>
                <div className="absolute right-0 top-full z-20 mt-1 min-w-40 rounded-xl border border-line bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete Product ${index + 1} and its photos?`)) {
                        draft.photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
                        setDrafts((current) => current.filter((item) => item.id !== draft.id));
                      }
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <PortalIcon name="trash" className="h-4 w-4" /> Delete product
                  </button>
                </div>
              </details>
            </div>
            {draft.generationStatus === "failed" ||
            (!draft.aiGenerated && !draft.title.trim() && draft.photos.length > 0) ? (
              <div className="mt-3 rounded-lg border border-[#e7c7d4] bg-[#fff7fa] px-3 py-2 text-xs text-[#7b3e55]">
                <p className="font-semibold">AI details couldn&apos;t be generated.</p>
                <p className="mt-1">
                  Add a product name manually, or use Retry AI analysis above.
                </p>
              </div>
            ) : null}
            {draft.photos.length ? (
              <PhotoStack
                draft={draft}
                draftIndex={index}
                onMakeCover={(photoId) => makeCover(draft.id, photoId)}
                onSplit={(photoId) => split(draft.id, photoId)}
                onMove={move}
                showCoach={showCoach && index === 0}
                onDismissCoach={() => {
                  window.localStorage.setItem("morni.bulk-upload-coach-dismissed", "1");
                  setShowCoach(false);
                }}
                otherDrafts={drafts
                  .filter((item) => item.id !== draft.id)
                  .map((item) => ({ id: item.id, label: `Product ${drafts.indexOf(item) + 1}` }))}
              />
            ) : null}
            {!draft.photos.length ? (
              <div className={`mt-3 rounded-xl border border-dashed bg-[#f8fbf9] py-6 text-center text-sm ${hasValidationError(draft.id, "photos") ? "border-red-400 text-red-600" : "border-line text-muted"}`}>
                <span>No photos yet.</span>
                <button type="button" onClick={() => openPhotoPicker(draft.id)} className="mt-2 min-h-11 rounded-lg border border-[#245448] px-4 text-sm font-semibold text-[#245448]">Add photos to this product</button>
              </div>
            ) : null}
            <section className="mt-3 rounded-xl border border-[#dfe8e3] bg-[#fbfcfb] px-3 pb-3 sm:px-4 sm:pb-4" aria-label="Product details, colours and inventory">
              <h3 className="py-3 text-sm font-semibold text-[#34594d]">
                Product details, colours & inventory
              </h3>
            {draft.photos.length ? <ColorGroupingPanel draft={draft} noSize={noSizes(draft.categorySlug)} onAssign={(photoId, colorId) => assignColor(draft.id, photoId, colorId)} onRename={(colorId, name, hex) => renameColor(draft.id, colorId, name, hex)} onAdd={() => addColor(draft.id)} onRemove={(colorId) => removeColor(draft.id, colorId)} onUnassign={(photoId) => unassignColor(draft.id, photoId)} onDeletePhoto={(photoId) => deletePhoto(draft.id, photoId)} onStockChange={(colorId, sizes, sizeStock, stock) => updateColorStock(draft.id, colorId, sizes, sizeStock, stock)} colorValidationErrors={colorValidationErrors} /> : null}
            <div className="mt-3 grid gap-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#596760]">
                Product tag
                <input
                  value={draft.productTag}
                  onChange={(event) =>
                    patch(draft.id, { productTag: event.target.value })
                  }
                  aria-invalid={hasProductTagError(draft.id)}
                  className={`mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2.5 text-base normal-case tracking-normal sm:text-sm ${hasProductTagError(draft.id) ? "border-red-400" : "border-line"}`}
                  placeholder="e.g. LUME-001"
                />
              </label>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  patch(draft.id, { description: event.target.value })
                }
                className="min-h-20 rounded-lg border border-line bg-background p-3 text-base sm:text-sm"
                rows={2}
                placeholder="Description"
              />
              <div className={`grid grid-cols-1 gap-2 ${noSizes(draft.categorySlug) && !draft.colors.length ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <select
                  value={draft.categorySlug}
                  onChange={(event) =>
                    patch(draft.id, {
                      categorySlug: event.target.value,
                      sizes: noSizes(event.target.value)
                        ? []
                        : draft.sizes.length
                          ? draft.sizes
                          : ["S", "M", "L"],
                      ...(noSizes(event.target.value)
                        ? { customization: { ...draft.customization, enabled: false, fields: [] } }
                        : {}),
                    })
                  }
                  aria-invalid={hasValidationError(draft.id, "category")}
                  className={`min-h-11 rounded-lg border bg-background px-3 py-2.5 text-base sm:text-sm ${hasValidationError(draft.id, "category") ? "border-red-400" : "border-line"}`}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.priceAed}
                  onChange={(event) =>
                    patch(draft.id, { priceAed: event.target.value })
                  }
                  aria-invalid={hasValidationError(draft.id, "price")}
                  className={`min-h-11 rounded-lg border bg-background px-3 py-2.5 text-base sm:text-sm ${hasValidationError(draft.id, "price") ? "border-red-400" : "border-line"}`}
                  placeholder="Price"
                />
                {noSizes(draft.categorySlug) && !draft.colors.length ? (
                  <label className="text-[10px] font-semibold text-muted">
                    Stock
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.stock}
                      onChange={(event) => patch(draft.id, { stock: event.target.value })}
                      aria-invalid={hasValidationError(draft.id, "stock")}
                      className={`mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm font-normal ${hasValidationError(draft.id, "stock") ? "border-red-400" : "border-line"}`}
                    />
                  </label>
                ) : null}
              </div>
              {hasValidationError(draft.id, "stock") ? (
                <p className="text-xs font-medium text-red-700" role="alert">
                  {noSizes(draft.categorySlug) && !draft.colors.length
                    ? "Enter at least 1 unit of stock."
                    : "Enter at least 1 unit in a selected size or colour below."}
                </p>
              ) : null}
              {!noSizes(draft.categorySlug) ? (
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#596760]">
                  Fabric / material
                  <select value={draft.fabric} onChange={(event) => patch(draft.id, { fabric: event.target.value })} className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2 text-sm font-normal normal-case tracking-normal">
                    <option value="">Select material</option>
                    {PRODUCT_FABRICS.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
                  </select>
                </label>
              ) : null}
              {!noSizes(draft.categorySlug) && !draft.colors.length ? (
                <>
                <SizeInventoryEditor
                  sizes={draft.sizes}
                  sizeStock={draft.sizeStock}
                  onChange={(sizes, sizeStock) => patch(draft.id, { sizes, sizeStock, stock: String(Object.values(sizeStock).reduce((sum, quantity) => sum + quantity, 0)) })}
                  disabled={busy}
                />
                <div className="hidden flex-wrap gap-2">
                  {PRODUCT_SIZES.map((size) => (
                    <button
                      type="button"
                      key={size}
                      onClick={() =>
                        patch(draft.id, {
                          sizes: draft.sizes.includes(size)
                            ? draft.sizes.filter((value) => value !== size)
                            : [...draft.sizes, size],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${draft.sizes.includes(size) ? "border-ink bg-ink text-white" : "border-line text-muted"}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                </>
              ) : draft.colors.length ? (
                <p className="rounded-lg bg-[#eef8f1] px-3 py-2 text-xs text-[#245448]">Inventory is managed per colour above.</p>
              ) : (
                <p className="text-xs text-muted">
                  No clothing sizes for this category.
                </p>
              )}
              {!noSizes(draft.categorySlug) ? (
                <CustomizationEditor
                  compact
                  value={draft.customization}
                  onChange={(customization) => patch(draft.id, { customization })}
                />
              ) : null}
            </div>
            </section>
          </article>
        ))}
      </div>
      {drafts.length ? (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-[#d5dfd9] bg-white/95 px-4 py-2.5 shadow-[0_-8px_24px_-20px_rgba(20,35,29,0.5)] backdrop-blur lg:sticky lg:bottom-0 lg:z-30 lg:mt-6 lg:border lg:border-line lg:px-4 lg:py-3">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <span className="min-w-0 flex-1 text-xs leading-4 text-muted sm:text-sm">
              <span className="block font-semibold text-ink">{drafts.length} products · {photoCount} photos</span>
              <span className="block text-xs leading-4">{readinessHint}</span>
            </span>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={!canPublish}
              className="min-h-11 shrink-0 rounded-lg bg-[#173d34] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245448] disabled:cursor-not-allowed disabled:bg-[#aab7b0] disabled:text-white/90 disabled:shadow-none sm:px-6"
            >
              {busy ? "Publishing…" : `Publish ${drafts.length} products`}
            </button>
          </div>
        </div>
      ) : null}
      <section className="mt-8 border-t border-line pt-6 lg:mt-12">
        <h2 className="font-display text-2xl text-ink">Import history</h2>
        {history.length ? (
          <div className="mt-3 divide-y divide-line">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span>{new Date(item.created_at).toLocaleString()}</span>
                <span className="text-muted">
                  {item.status} · {item.successful_items}/{item.total_items}{" "}
                  published
                  {item.failed_items ? ` · ${item.failed_items} failed` : ""}
                </span>
                {item.failed_items > 0 ? (
                  <button
                    type="button"
                    onClick={() => void retryImport(item.id)}
                    disabled={busy}
                    className="border border-line px-3 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    Retry failed
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No imports yet.</p>
        )}
      </section>
      {busy ? (
        <SimpleAiProcessingOverlay
          phase={busyPhase === "idle" ? "reading" : busyPhase}
          photoCount={drafts.reduce((sum, draft) => sum + draft.photos.length, 0)}
          productCount={drafts.length}
          uploadProgress={publishProgress}
        />
      ) : null}
    </div>
  );
}
