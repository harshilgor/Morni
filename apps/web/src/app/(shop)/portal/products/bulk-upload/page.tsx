"use client";

import { useEffect, useState } from "react";
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

type Photo = { id: string; file: File; preview: string };
type ColorGroup = {
  id: string;
  colorName: string;
  colorHex?: string;
  photos: Photo[];
  confidence?: number;
  needsReview?: boolean;
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
  confidence?: number;
  needsReview?: boolean;
  colors: ColorGroup[];
};

const BULK_UPLOAD_MAX_PHOTOS = 500;
const AI_ANALYSIS_MAX_PHOTOS = 30;
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

function createColorGroup(colorName = "") : ColorGroup {
  return { id: uid(), colorName, photos: [], sizeStock: { S: 0, M: 0, L: 0 }, stock: "0", needsReview: true };
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
}: {
  draft: Draft;
  draftIndex: number;
  onMakeCover: (photoId: string) => void;
  onSplit: (photoId: string) => void;
  onMove: (photoId: string, targetId: string) => void;
  otherDrafts: Array<{ id: string; label: string }>;
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

      <div className="relative h-48 overflow-hidden rounded-xl bg-[#e8f0eb] p-2 sm:h-56">
        <img
          src={cover.preview}
          alt={`Product ${draftIndex + 1} cover`}
          className="h-full w-full rounded-lg object-cover shadow-sm transition duration-500"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        <span className="absolute left-4 top-4 rounded-full bg-ink/90 px-2.5 py-1 text-[10px] font-bold text-white">
          Cover photo
        </span>
        <span className="absolute bottom-4 left-4 text-xs font-semibold text-white drop-shadow">
          {expanded ? "Choose a photo below to change the cover" : draft.confidence && draft.confidence > 0 ? "AI-selected cover" : "Selected cover"}
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
            <img src={photo.preview} alt={`Photo ${photoIndex + 1}`} className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[9px] font-bold text-white">
              {photoIndex === 0 ? "Cover" : photoIndex + 1}
            </span>
          </button>
        ))}
      </div>

      <details className="mt-2 rounded-lg border border-[#dfe8e3] bg-white/70 px-3 py-2">
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
  onStockChange,
  noSize,
  colorValidationErrors,
}: {
  draft: Draft;
  onAssign: (photoId: string, colorId: string) => void;
  onRename: (colorId: string, colorName: string, colorHex?: string) => void;
  onAdd: () => void;
  onRemove: (colorId: string) => void;
  onStockChange: (colorId: string, sizeStock: Record<string, number>, stock: string) => void;
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
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {color.photos.map((photo) => (
                <div key={photo.id} draggable onDragStart={(event) => { event.dataTransfer.setData("photo-id", photo.id); event.dataTransfer.effectAllowed = "move"; }} className="group relative aspect-square cursor-grab overflow-hidden rounded-lg bg-[#edf3ef] active:cursor-grabbing">
                  <img src={photo.preview} alt={`${color.colorName || "Colour"} product photo`} className="h-full w-full object-cover" />
                  <select aria-label={`Assign photo to colour`} value={color.id} onChange={(event) => onAssign(photo.id, event.target.value)} className="absolute inset-x-1 bottom-1 min-w-0 rounded bg-white/95 px-1 py-1 text-[10px] text-ink opacity-100 shadow transition sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                    {colors.map((option) => <option key={option.id} value={option.id}>{option.colorName || "Unnamed"}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {noSize ? <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Colour stock<input type="number" min="0" value={color.stock} onChange={(event) => onStockChange(color.id, color.sizeStock, event.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm font-normal normal-case tracking-normal" /></label> : <div className="mt-3"><SizeInventoryEditor sizes={draft.sizes} sizeStock={color.sizeStock} onChange={(_, stock) => onStockChange(color.id, stock, color.stock)} /></div>}
            <p className={`mt-2 text-[11px] ${colorErrors.includes("photos") ? "font-semibold text-red-600" : "text-muted"}`}>{color.photos.length} image{color.photos.length === 1 ? "" : "s"} · quantities can be entered before publishing</p>
            {hasColorError ? <p className="mt-2 text-xs font-medium text-red-600">Fix: {colorErrors.join(", ")}.</p> : null}
          </div>
        )})}
      </div>
      {unassignedPhotos.length && colors.length ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#d6b46a] bg-[#fffaf0] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b641f]">Unassigned photos</p>
          <p className="mt-1 text-xs text-[#8b641f]">Click a photo, then choose the colour group it belongs to.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {unassignedPhotos.map((photo) => (
              <div key={photo.id} draggable onDragStart={(event) => { event.dataTransfer.setData("photo-id", photo.id); event.dataTransfer.effectAllowed = "move"; }} className="overflow-hidden rounded-lg border border-[#ead8a8] bg-white">
                <img src={photo.preview} alt="Unassigned product photo" className="aspect-square w-full cursor-grab object-cover active:cursor-grabbing" />
                <select aria-label="Assign unassigned photo to colour" defaultValue="" onChange={(event) => { if (event.target.value) onAssign(photo.id, event.target.value); }} className="w-full border-t border-[#ead8a8] bg-white px-2 py-2 text-xs text-ink">
                  <option value="">Choose colour…</option>
                  {colors.map((color) => <option key={color.id} value={color.id}>{color.colorName || "Unnamed colour"}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AiProcessingOverlay({
  phase,
  photoCount,
  productCount,
}: {
  phase: "reading" | "analyzing" | "publishing";
  photoCount: number;
  productCount: number;
}) {
  const copy = phase === "reading"
    ? { eyebrow: "Step 1 of 3", title: "Preparing your photos", detail: "Optimizing image previews securely before AI reviews them." }
    : phase === "analyzing"
      ? { eyebrow: "Step 2 of 3", title: "AI is building your catalogue", detail: "Matching product views, writing descriptions, and suggesting categories." }
      : { eyebrow: "Step 3 of 3", title: "Publishing your products", detail: "Uploading approved images and saving each product safely." };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#14251f]/45 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="ai-processing-title" aria-describedby="ai-processing-detail">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/60 bg-[#f7fbf8]/95 p-6 shadow-[0_30px_100px_-35px_rgba(12,35,28,0.8)] sm:p-9">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[#75c6a5]/25 blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-[#6d91ff]/20 blur-3xl animate-[pulse_5s_ease-in-out_infinite]" />
          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#4f9c80]/20 animate-[spin_14s_linear_infinite]" />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#547fef]/25 animate-[spin_9s_linear_infinite_reverse]" />
        </div>
        <div className="relative">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/80 shadow-[0_0_0_10px_rgba(78,148,120,0.08),0_0_45px_rgba(84,125,255,0.28)]">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#5fc6a1] via-[#467eea] to-[#273f9b] shadow-[0_0_25px_rgba(70,126,234,0.65)] animate-[pulse_2.2s_ease-in-out_infinite]">
              <PortalIcon name="sparkle" className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#4b806d]">{copy.eyebrow}</p>
          <h2 id="ai-processing-title" className="mt-2 text-center font-display text-3xl tracking-[-0.035em] text-[#17362b]">{copy.title}</h2>
          <p id="ai-processing-detail" className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-[#60746b]">{copy.detail} This can take a few seconds—keep this window open.</p>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[#6c7f76]">
            <div className={`rounded-xl px-2 py-2.5 ${phase === "reading" ? "bg-[#e0f2e9] text-[#2f765e]" : "bg-[#edf4ef]"}`}>Read photos</div>
            <div className={`rounded-xl px-2 py-2.5 ${phase === "analyzing" ? "bg-[#e0e9ff] text-[#3c5caf]" : "bg-[#edf4ef]"}`}>Understand styles</div>
            <div className={`rounded-xl px-2 py-2.5 ${phase === "publishing" ? "bg-[#e0f2e9] text-[#2f765e]" : "bg-[#edf4ef]"}`}>Save products</div>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs text-[#71837a]">
            <span>{photoCount} photo{photoCount === 1 ? "" : "s"} in this batch</span>
            <span>{productCount} candidate{productCount === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dcebe2]"><div className={`h-full rounded-full bg-gradient-to-r from-[#5bb98f] to-[#4d78ed] transition-all duration-500 ${phase === "reading" ? "w-1/3" : phase === "analyzing" ? "w-2/3" : "w-full"}`} /></div>
        </div>
      </div>
    </div>
  );
}
const noSizes = (slug: string) =>
  ["gifting", "hamper", "hampers"].includes(slug);
const uid = () => crypto.randomUUID();
const productKey = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/(?:[-_\s]+)(?:view|image|img|photo)?[-_\s]*\d+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase();

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
  const [showCoach, setShowCoach] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadCelebrationKey, setUploadCelebrationKey] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [colorValidationErrors, setColorValidationErrors] = useState<Record<string, string[]>>({});
  const [draftsRestored, setDraftsRestored] = useState(false);
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
        setMessage("Recovered your saved bulk-upload draft. You can continue where you left off.");
      }
      setDraftsRestored(true);
    });
    return () => { active = false; };
  }, [store]);
  useEffect(() => {
    if (!store || !draftsRestored) return;
    void saveBulkDraft(store.id, drafts);
  }, [drafts, draftsRestored, store]);
  function addFiles(list: FileList | File[]) {
    const valid = Array.from(list).filter((file) => {
      if (!validateImageFile(file)) return true;
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
    const grouped = new Map<string, Photo[]>();
    accepted.forEach((file) => {
      const photo = { id: uid(), file, preview: URL.createObjectURL(file) };
      const key = productKey(file.name) || file.name;
      grouped.set(key, [...(grouped.get(key) ?? []), photo]);
    });
    const nextDrafts = [
      ...drafts,
      ...Array.from(grouped, ([key, photos]) => ({
        id: uid(),
        photos,
        title: key.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        productTag: "",
        description: "",
        fabric: "",
        categorySlug: "",
        colorName: "",
        priceAed: "",
        stock: "",
        sizes: ["S", "M", "L"],
        sizeStock: { S: 0, M: 0, L: 0 },
        colors: [{ ...createColorGroup("Unassigned colour"), photos }],
      })),
    ];
    setDrafts(nextDrafts);
    setMessage("AI is grouping these photos by product… Your draft is saved locally while you work.");
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
      if (draft.colors.length) {
        return { ...draft, colors: [...draft.colors, createColorGroup()] };
      }
      return {
        ...draft,
        colors: [{ ...createColorGroup(), photos: draft.photos }],
      };
    }));
  }
  function removeColor(draftId: string, colorId: string) {
    setDrafts((current) => current.map((draft) => draft.id === draftId ? { ...draft, colors: draft.colors.filter((color) => color.id !== colorId) } : draft));
  }
  function updateColorStock(draftId: string, colorId: string, sizeStock: Record<string, number>, stock: string) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId) return draft;
      const colors = draft.colors.map((color) => color.id === colorId ? { ...color, sizeStock, stock } : color);
      const total = noSizes(draft.categorySlug) ? colors.reduce((sum, color) => sum + Number(color.stock || 0), 0) : colors.reduce((sum, color) => sum + Object.values(color.sizeStock).reduce((inner, quantity) => inner + quantity, 0), 0);
      return { ...draft, colors, stock: String(total), sizeStock: draft.sizes.reduce((result, size) => ({ ...result, [size]: colors.reduce((sum, color) => sum + Number(color.sizeStock[size] || 0), 0) }), {}) };
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
                ...item,
                id: uid(),
                photos: [photo],
                title: `${item.title} (new)`,
              },
            ],
      ),
    );
  }
  function addRow() {
    setDrafts((current) => [
      ...current,
      {
        id: uid(),
        photos: [],
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
        colors: [createColorGroup()],
      },
    ]);
  }
  async function analyze(draftsToAnalyze: Draft[] = drafts) {
    if (!store || !draftsToAnalyze.length || busy) return;
    setBusy(true);
    setBusyPhase("reading");
    setMessage("Preparing photos securely…");
    try {
      const images = await Promise.all(
        draftsToAnalyze.flatMap((draft) =>
          draft.photos.map(async (photo) => ({
            id: photo.id,
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
      const batches = Array.from(
        { length: Math.ceil(images.length / AI_ANALYSIS_MAX_PHOTOS) },
        (_, index) => images.slice(index * AI_ANALYSIS_MAX_PHOTOS, (index + 1) * AI_ANALYSIS_MAX_PHOTOS),
      );
      const grouped: Draft[] = [];
      const warnings: string[] = [];
      for (const [batchIndex, batch] of batches.entries()) {
        setBusyPhase("analyzing");
        setMessage(
          batches.length > 1
            ? `Analyzing batch ${batchIndex + 1} of ${batches.length} (${batch.length} photos)…`
            : `Analyzing ${batch.length} photos and grouping matching product views…`,
        );
        const response = await fetch("/api/portal/products/bulk-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60_000),
          body: JSON.stringify({ storeId: store.id, images: batch }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "AI grouping failed. You can continue manually.",
          );
        if (result.warning) warnings.push(result.warning);
        grouped.push(
          ...result.groups.map(
          (group: {
            imageIds: string[];
            title: string;
            description: string;
            categorySlug: string | null;
            colorName: string;
            confidence: number;
            needsReview: boolean;
            colorGroups?: Array<{ imageIds: string[]; colorName: string; confidence: number; needsReview: boolean }>;
          }) => ({
            id: uid(),
            photos: group.imageIds
              .map((imageId) => photoMap.get(imageId))
              .filter(Boolean),
            title: group.title,
            description: group.description,
            fabric: "",
            categorySlug: group.categorySlug ?? "",
            colorName: group.colorName ?? "",
            productTag: "",
            priceAed: "",
            stock: "",
            sizes: ["S", "M", "L"],
            sizeStock: { S: 0, M: 0, L: 0 },
            confidence: group.confidence,
            needsReview: group.needsReview,
            // Colourways are intentionally manual; AI only groups photos into products.
            colors: [],
          }),
          ).filter((draft: Draft) => draft.photos.length),
        );
      }
      const safeGroups = grouped.map((draft) => ({
        ...draft,
        needsReview: draft.needsReview || draft.colors.some((color) => color.needsReview),
      }));
      setDrafts(safeGroups);
      setMessage(
        `${warnings[0] ? `${warnings[0]} ` : ""}AI grouped ${images.length} photos into ${safeGroups.length} product candidates.${batches.length > 1 ? " Photos were analyzed in separate batches, so review any matching product views that landed in different batches." : ""} Review flagged groups before publishing.`,
      );
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
    const missingByDraft = Object.fromEntries(
      drafts
        .map((draft) => {
          const missing = [
            !draft.photos.length ? "photos" : null,
            !draft.title.trim() ? "product name" : null,
            !draft.categorySlug ? "category" : null,
            !draft.priceAed ? "price" : null,
            draft.stock === "" && Object.values(draft.sizeStock).every((quantity) => !quantity) ? "stock" : null,
          ].filter((field): field is string => Boolean(field));
          return [draft.id, missing] as const;
        })
        .filter(([, missing]) => missing.length),
    ) as Record<string, string[]>;
    const nextColorValidationErrors: Record<string, string[]> = {};
    drafts.forEach((draft) => {
      draft.colors.forEach((color) => {
        const errors = [
          !color.colorName.trim() ? "colour name" : null,
          !color.photos.length ? "at least one photo" : null,
        ].filter((error): error is string => Boolean(error));
        if (errors.length) nextColorValidationErrors[color.id] = errors;
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
      const productSummary = Object.entries(missingByDraft)
        .map(([draftId, fields]) => `Product ${drafts.findIndex((draft) => draft.id === draftId) + 1}: ${fields.join(", ")}`)
        .join(" · ");
      const colorSummary = drafts
        .flatMap((draft, draftIndex) => draft.colors.map((color, colorIndex) => ({ draftIndex, colorIndex, errors: nextColorValidationErrors[color.id] })))
        .filter((color): color is { draftIndex: number; colorIndex: number; errors: string[] } => Boolean(color.errors))
        .map((color) => `Product ${color.draftIndex + 1}, colour ${color.colorIndex + 1}: ${color.errors.join(", ")}`)
        .join(" · ");
      setMessage(`Fix the highlighted fields before publishing. ${[productSummary, colorSummary].filter(Boolean).join(" · ")}`);
      window.setTimeout(() => document.querySelector("[data-upload-message]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    setValidationErrors({});
    setColorValidationErrors({});
    setBusy(true);
    setBusyPhase("publishing");
    setMessage(null);
    const uploadedUrls: string[] = [];
    try {
      const items = [];
      for (const draft of drafts) {
        if (
          !draft.photos.length ||
          !draft.title.trim() ||
          !draft.categorySlug ||
          !draft.priceAed ||
          draft.stock === ""
        )
          throw new Error(
            `Complete the photos, name, category, price, and stock for ${draft.title || "a draft"}.`,
          );
        const sourceColors = draft.colors.length ? draft.colors : [{ ...createColorGroup(draft.colorName || "Default"), photos: draft.photos, sizeStock: draft.sizeStock, stock: draft.stock }];
        const assignedPhotoIds = new Set(sourceColors.flatMap((color) => color.photos.map((photo) => photo.id)));
        const unassignedPhotos = draft.photos.filter((photo) => !assignedPhotoIds.has(photo.id));
        const colors = sourceColors.map((color, colorIndex) => ({
          ...color,
          colorName: color.colorName.trim() || (colorIndex === 0 ? draft.colorName.trim() : "Default"),
          photos: colorIndex === 0 ? [...color.photos, ...unassignedPhotos] : color.photos,
        }));
        if (colors.some((color) => !color.photos.length || !color.colorName)) throw new Error(`Assign every photo and name each colour for ${draft.title}.`);
        const aggregateSizeStock = noSizes(draft.categorySlug) ? {} : aggregateBulkSizeStock(colors, draft.sizes);
        const variants = [];
        for (const color of colors) {
          setMessage(`Uploading images for ${draft.title}…`);
          const images = await uploadProductImages({ storeId: store.id, files: color.photos.map((photo) => photo.file) });
          uploadedUrls.push(...images);
          const colorStock = noSizes(draft.categorySlug) ? Number(color.stock || 0) : Object.values(color.sizeStock).reduce((sum, quantity) => sum + quantity, 0);
          variants.push({ colorName: color.colorName.trim(), colorHex: color.colorHex ?? null, sizes: noSizes(draft.categorySlug) ? [] : draft.sizes, sizeStock: noSizes(draft.categorySlug) ? {} : color.sizeStock, stock: colorStock, images });
        }
        items.push({
          title: draft.title,
          productTag: draft.productTag,
          description: draft.description,
          fabric: draft.fabric || null,
          categorySlug: draft.categorySlug,
          priceAed: Number(draft.priceAed),
          stock: Number(draft.stock),
          sizes: noSizes(draft.categorySlug) ? [] : draft.sizes,
          sizeStock: aggregateSizeStock,
          images: variants.flatMap((variant) => variant.images).slice(0, 5),
          variants,
        });
      }
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
      if (!response.ok) throw new Error(result.error ?? "Bulk publish failed.");
      if (result.failed) {
        if (result.created > 0) setUploadCelebrationKey(Date.now());
        const failures = (result.results ?? [])
          .filter((item: { ok: boolean }) => !item.ok)
          .map((item: { title: string; error?: string }) => `${item.title}: ${item.error ?? "could not be published"}`)
          .join(" · ");
        setMessage(`${result.created} products published, ${result.failed} failed. ${failures}`);
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
      if (uploadedUrls.length && store)
        void fetch("/api/portal/products/bulk-cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: store.id, urls: uploadedUrls }),
        });
      setMessage(
        error instanceof Error ? error.message : "Bulk publish failed.",
      );
    } finally {
      setBusy(false);
      setBusyPhase("idle");
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
      if (!response.ok) throw new Error(result.error ?? "Retry failed.");
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
      setMessage(error instanceof Error ? error.message : "Retry failed.");
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
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <UploadSuccessConfetti celebrationKey={uploadCelebrationKey} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">
            Store owner portal
          </p>
          <h1 className="mt-2 font-display text-4xl text-ink">
            Bulk upload studio
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            AI suggestions are advisory. Drag photos between products, split
            groups, or create a new row before publishing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/portal/products")}
          className="border border-line px-4 py-2 text-sm font-semibold"
        >
          Back to products
        </button>
      </div>
      <label
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
        className={`mt-8 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center ${dragging ? "border-accent bg-[#fff0f4]" : "border-line bg-surface"}`}
      >
        <span className="text-3xl text-accent-deep">+</span>
        <span className="mt-2 font-semibold text-ink">
          Drop product photos here
        </span>
        <span className="mt-1 text-sm text-muted">
          JPG, PNG or WebP · up to 30 images for AI analysis
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addRow}
          className="border border-line px-4 py-2 text-sm font-semibold"
        >
          + New product row
        </button>
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
      {message ? (
        <p data-upload-message className={`mt-5 rounded-xl px-4 py-3 text-sm ${Object.keys(validationErrors).length || Object.keys(colorValidationErrors).length ? "bg-[#fff1f1] text-red-700" : "bg-[#eef8f1] text-[#245448]"}`} role={Object.keys(validationErrors).length || Object.keys(colorValidationErrors).length ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
      {showCoach && drafts.length ? (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-[#e7c7d4] bg-[#fff7fa] px-4 py-3 text-sm text-[#7b3e55] shadow-[0_12px_30px_-22px_rgba(123,62,85,0.7)] animate-[rise_0.6s_ease_both]">
          <p>
            <span className="font-semibold">Tip:</span> drag a photo onto
            another product to regroup it. Use Split when an image belongs to a
            different product.
          </p>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(
                "morni.bulk-upload-coach-dismissed",
                "1",
              );
              setShowCoach(false);
            }}
            className="shrink-0 text-xs font-semibold underline underline-offset-4"
          >
            Got it
          </button>
        </div>
      ) : null}
      <div className={`mt-8 grid gap-6 ${drafts.length === 1 ? "grid-cols-1" : "lg:grid-cols-2"}`}>
        {drafts.map((draft, index) => (
          <article
            key={draft.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              move(event.dataTransfer.getData("photo-id"), draft.id);
            }}
            className={`rounded-2xl border bg-surface p-4 ${hasValidationError(draft.id, "photos") ? "border-red-400" : "border-line"}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
                Product {index + 1}
                {draft.confidence != null && draft.confidence > 0
                  ? ` · AI confidence ${Math.round(draft.confidence * 100)}%`
                  : ""}
                {draft.needsReview ? " · Review grouping" : ""}
              </p>
              <button
                type="button"
                onClick={() =>
                  setDrafts((current) =>
                    current.filter((item) => item.id !== draft.id),
                  )
                }
                className="text-xs text-accent-deep"
              >
                <span className="inline-flex items-center gap-1.5"><PortalIcon name="trash" className="h-3.5 w-3.5" /><span>Delete product</span></span>
              </button>
            </div>
            {draft.photos.length ? (
              <PhotoStack
                draft={draft}
                draftIndex={index}
                onMakeCover={(photoId) => makeCover(draft.id, photoId)}
                onSplit={(photoId) => split(draft.id, photoId)}
                onMove={move}
                otherDrafts={drafts
                  .filter((item) => item.id !== draft.id)
                  .map((item) => ({ id: item.id, label: `Product ${drafts.indexOf(item) + 1}` }))}
              />
            ) : null}
            {!draft.photos.length ? (
              <div className={`mt-3 rounded-xl border border-dashed bg-[#f8fbf9] py-6 text-center text-sm ${hasValidationError(draft.id, "photos") ? "border-red-400 text-red-600" : "border-line text-muted"}`}>
                Drop a photo here.
              </div>
            ) : null}
            {draft.photos.length ? <ColorGroupingPanel draft={draft} noSize={noSizes(draft.categorySlug)} onAssign={(photoId, colorId) => assignColor(draft.id, photoId, colorId)} onRename={(colorId, name, hex) => renameColor(draft.id, colorId, name, hex)} onAdd={() => addColor(draft.id)} onRemove={(colorId) => removeColor(draft.id, colorId)} onStockChange={(colorId, sizeStock, stock) => updateColorStock(draft.id, colorId, sizeStock, stock)} colorValidationErrors={colorValidationErrors} /> : null}
            <div className="mt-4 grid gap-3">
              <label className={`flex items-center gap-2 border-b py-2 ${hasValidationError(draft.id, "product name") ? "border-red-400" : "border-line"}`}>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    patch(draft.id, { title: event.target.value })
                  }
                  aria-invalid={hasValidationError(draft.id, "product name")}
                  className={`min-w-0 flex-1 bg-transparent font-display text-xl outline-none ${hasValidationError(draft.id, "product name") ? "placeholder:text-red-400" : ""}`}
                  placeholder="Product name"
                />
                <PortalIcon
                  name="edit"
                  className="h-4 w-4 text-accent-deep"
                  aria-hidden="true"
                />
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Product tag
                <input
                  value={draft.productTag}
                  onChange={(event) =>
                    patch(draft.id, { productTag: event.target.value })
                  }
                  aria-invalid={hasProductTagError(draft.id)}
                  className={`mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm normal-case tracking-normal ${hasProductTagError(draft.id) ? "border-red-400" : "border-line"}`}
                  placeholder="e.g. LUME-001"
                />
              </label>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  patch(draft.id, { description: event.target.value })
                }
                className="rounded-lg border border-line bg-background p-2 text-sm"
                rows={2}
                placeholder="Description"
              />
              <div className="grid grid-cols-3 gap-2">
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
                    })
                  }
                  aria-invalid={hasValidationError(draft.id, "category")}
                  className={`rounded-lg border bg-background px-2 py-2 text-sm ${hasValidationError(draft.id, "category") ? "border-red-400" : "border-line"}`}
                >
                  <option value="">Category</option>
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
                  className={`rounded-lg border bg-background px-2 py-2 text-sm ${hasValidationError(draft.id, "price") ? "border-red-400" : "border-line"}`}
                  placeholder="Price"
                />
                <label className="text-[10px] font-semibold text-muted">
                  <input
                    type="number"
                    min="0"
                    value={draft.stock}
                    onChange={(event) => patch(draft.id, { stock: event.target.value })}
                    readOnly={draft.colors.length > 1}
                    aria-invalid={hasValidationError(draft.id, "stock")}
                    className={`mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm font-normal ${hasValidationError(draft.id, "stock") ? "border-red-400" : "border-line"}`}
                    placeholder="Stock"
                  />
                </label>
              </div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Fabric / material
                <select value={draft.fabric} onChange={(event) => patch(draft.id, { fabric: event.target.value })} className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2 text-sm font-normal normal-case tracking-normal">
                  <option value="">Select material</option>
                  {PRODUCT_FABRICS.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
                </select>
              </label>
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
            </div>
          </article>
        ))}
      </div>
      {drafts.length ? (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mt-8 flex items-center justify-between gap-4 border-t border-line bg-background/95 py-4 backdrop-blur lg:bottom-0">
          <span className="text-sm text-muted">
            {drafts.length} products ·{" "}
            {drafts.reduce((sum, draft) => sum + draft.photos.length, 0)} photos
          </span>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy}
            className="bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish all products"}
          </button>
        </div>
      ) : null}
      <section className="mt-12 border-t border-line pt-6">
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
        />
      ) : null}
    </main>
  );
}
