"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadBrowseCategoryOptions } from "@/lib/store-category";
import { PRODUCT_SIZES } from "@/lib/product-sizes";
import { uploadProductImages, validateImageFile } from "@/lib/media-upload";
import { useOwnerStore } from "@/lib/use-owner-store";
import { PortalIcon } from "@/components/portal-icons";

type Photo = { id: string; file: File; preview: string };
type Draft = {
  id: string;
  photos: Photo[];
  title: string;
  productTag: string;
  description: string;
  categorySlug: string;
  priceAed: string;
  stock: string;
  sizes: string[];
  confidence?: number;
  needsReview?: boolean;
};
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
    // Keep each data URL comfortably below the server validation limit.
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:image\/jpg;/i, "data:image/jpeg;"));
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
  function addFiles(list: FileList | File[]) {
    const valid = Array.from(list).filter((file) => {
      if (!validateImageFile(file)) return true;
      // Some mobile browsers leave File.type empty or report image/jpg.
      const extension = file.name.split(".").pop()?.toLowerCase();
      return Boolean(extension && ["jpg", "jpeg", "png", "webp"].includes(extension) && file.size <= 8 * 1024 * 1024);
    });
    if (!valid.length) {
      setMessage("Upload up to 30 valid JPG, PNG, or WebP images.");
      return;
    }
    const grouped = new Map<string, Photo[]>();
    valid.forEach((file) => {
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
        categorySlug: "",
        priceAed: "",
        stock: "",
        sizes: ["S", "M", "L"],
      })),
    ];
    setDrafts(nextDrafts);
    setMessage("AI is grouping these photos by product…");
    void analyze(nextDrafts);
  }
  function patch(draftId: string, changes: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId ? { ...draft, ...changes } : draft,
      ),
    );
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
  function movePhotoInDraft(
    draftId: string,
    photoId: string,
    direction: -1 | 1,
  ) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== draftId) return draft;
        const index = draft.photos.findIndex((photo) => photo.id === photoId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= draft.photos.length)
          return draft;
        const photos = [...draft.photos];
        const [picked] = photos.splice(index, 1);
        photos.splice(target, 0, picked);
        return { ...draft, photos };
      }),
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
        categorySlug: "",
        priceAed: "",
        stock: "",
        sizes: ["S", "M", "L"],
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
      setMessage(
        `Analyzing ${images.length} photos and grouping matching product views…`,
      );
      const response = await fetch("/api/portal/products/bulk-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, images }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "AI grouping failed. You can continue manually.");
      const photoMap = new Map(
        draftsToAnalyze.flatMap((draft) =>
          draft.photos.map((photo) => [photo.id, photo]),
        ),
      );
      const grouped = result.groups
        .map(
          (group: {
            imageIds: string[];
            title: string;
            description: string;
            categorySlug: string | null;
            confidence: number;
            needsReview: boolean;
          }) => ({
            id: uid(),
            photos: group.imageIds
              .map((imageId) => photoMap.get(imageId))
              .filter(Boolean),
            title: group.title,
            description: group.description,
            categorySlug: group.categorySlug ?? "",
            productTag: "",
            priceAed: "",
            stock: "",
            sizes: ["S", "M", "L"],
            confidence: group.confidence,
            needsReview: group.needsReview,
          }),
        )
        .filter((draft: Draft) => draft.photos.length);
      setDrafts(grouped);
      setMessage(
        `AI grouped ${images.length} photos into ${grouped.length} product candidates. Review flagged groups before publishing.`,
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
    setBusy(true);
    setBusyPhase("publishing");
    setMessage(null);
    const uploadedUrls: string[] = [];
    try {
      const tags = drafts.map((draft) => draft.productTag.trim().toUpperCase());
      if (new Set(tags).size !== tags.length) {
        throw new Error("Each product must have a unique product tag.");
      }
      const items = [];
      for (const draft of drafts) {
        if (
          !draft.photos.length ||
          !draft.title.trim() ||
          !draft.productTag.trim() ||
          !draft.categorySlug ||
          !draft.priceAed ||
          draft.stock === ""
        )
          throw new Error(
            `Complete the photos, name, product tag, category, price, and stock for ${draft.title || "a draft"}.`,
          );
        const images = await uploadProductImages({
          storeId: store.id,
          files: draft.photos.map((photo) => photo.file),
        });
        uploadedUrls.push(...images);
        items.push({
          title: draft.title,
          productTag: draft.productTag,
          description: draft.description,
          categorySlug: draft.categorySlug,
          priceAed: Number(draft.priceAed),
          stock: Number(draft.stock),
          sizes: noSizes(draft.categorySlug) ? [] : draft.sizes,
          images,
        });
      }
      const response = await fetch("/api/portal/products/bulk-publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": uid(),
        },
        body: JSON.stringify({ storeId: store.id, items }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Bulk publish failed.");
      setMessage(
        `${result.created} products published${result.failed ? `, ${result.failed} failed` : ""}.`,
      );
      setDrafts([]);
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
        <p className="mt-5 rounded-xl bg-[#eef8f1] px-4 py-3 text-sm text-[#245448]">
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
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {drafts.map((draft, index) => (
          <article
            key={draft.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              move(event.dataTransfer.getData("photo-id"), draft.id);
            }}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
                Product {index + 1}
                {draft.confidence != null
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
                Remove
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.photos.map((photo) => (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("photo-id", photo.id)
                  }
                  className="group relative"
                >
                  <img
                    src={photo.preview}
                    alt={`Product ${index + 1} photo ${draft.photos.indexOf(photo) + 1}`}
                    className="h-28 w-20 rounded-lg object-cover"
                  />
                  {draft.photos.indexOf(photo) === 0 ? (
                    <span className="absolute left-1 top-1 rounded bg-ink/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      Cover
                    </span>
                  ) : null}
                  <div className="flex flex-wrap gap-1 bg-white p-1">
                    <button
                      type="button"
                      disabled={draft.photos.indexOf(photo) === 0}
                      onClick={() => movePhotoInDraft(draft.id, photo.id, -1)}
                      aria-label="Move photo earlier"
                      className="rounded border border-line px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={
                        draft.photos.indexOf(photo) === draft.photos.length - 1
                      }
                      onClick={() => movePhotoInDraft(draft.id, photo.id, 1)}
                      aria-label="Move photo later"
                      className="rounded border border-line px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      disabled={draft.photos.indexOf(photo) === 0}
                      onClick={() => makeCover(draft.id, photo.id)}
                      className="rounded border border-line px-1 text-[10px] disabled:opacity-40"
                    >
                      Cover
                    </button>
                    <button
                      type="button"
                      onClick={() => split(draft.id, photo.id)}
                      className="rounded bg-white/90 px-1 text-[10px]"
                    >
                      Split
                    </button>
                    <select
                      aria-label="Move photo"
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value)
                          move(photo.id, event.target.value);
                      }}
                      className="max-w-16 text-[10px]"
                    >
                      <option value="">Move</option>
                      {drafts
                        .filter((item) => item.id !== draft.id)
                        .map((item, itemIndex) => (
                          <option key={item.id} value={item.id}>
                            P{itemIndex + 1}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}
              {!draft.photos.length ? (
                <p className="py-6 text-sm text-muted">Drop a photo here.</p>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              <label className="flex items-center gap-2 border-b border-line py-2">
                <input
                  value={draft.title}
                  onChange={(event) =>
                    patch(draft.id, { title: event.target.value })
                  }
                  className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none"
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
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2 text-sm normal-case tracking-normal"
                  placeholder="e.g. LUME-001"
                  required
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
                  className="rounded-lg border border-line bg-background px-2 py-2 text-sm"
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
                  className="rounded-lg border border-line bg-background px-2 py-2 text-sm"
                  placeholder="Price"
                />
                <label className="text-[10px] font-semibold text-muted">
                  <input
                    type="number"
                    min="0"
                    value={draft.stock}
                    onChange={(event) =>
                      patch(draft.id, { stock: event.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2 text-sm font-normal"
                    placeholder="Stock"
                    required
                  />
                </label>
              </div>
              {!noSizes(draft.categorySlug) ? (
                <div className="flex flex-wrap gap-2">
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
        <div className="sticky bottom-0 mt-8 flex items-center justify-between border-t border-line bg-background/95 py-4 backdrop-blur">
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
    </main>
  );
}
