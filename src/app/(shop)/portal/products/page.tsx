"use client";

/* Product thumbnails may originate from seller-controlled Supabase storage URLs. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CustomizationEditor } from "@/components/customization-editor";
import { ColorVariantEditor } from "@/components/color-variant-editor";
import { QuickProductFields } from "@/components/quick-product-fields";
import type { CategoryOption } from "@/components/product-form-fields";
import {
  ImagePreviewDialog,
  type PreviewImage,
} from "@/components/image-preview-dialog";
import { PortalIcon } from "@/components/portal-icons";
import {
  PortalEmpty,
  PortalMetric,
  PortalPageHeader,
  StatusBadge,
} from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed } from "@/lib/format";
import {
  aggregateFromColorDrafts,
  colorDraftFromProduct,
  colorDraftFromVariant,
  createColorDraft,
  validateColorDrafts,
  type ColorDraft,
} from "@/lib/product-variants";
import { replaceProductVariants } from "@/lib/save-product-variants";
import { revalidatePublicCatalog } from "@/lib/revalidate-catalog";
import {
  ensureStoreCategory,
  loadBrowseCategoryOptions,
} from "@/lib/store-category";
import type { Product, ProductVariant } from "@/lib/types";
import {
  customizationConfigFromProduct,
  defaultCustomizationConfig,
  type ProductCustomizationConfig,
} from "@/lib/product-customization";
import { PRODUCT_FABRICS } from "@/lib/product-fabrics";
import { UploadSuccessConfetti } from "@/components/upload-success-confetti";
import { AiProcessingOverlay } from "@/components/ai-processing-overlay";
import { useRecentlyViewed } from "@/lib/recently-viewed";

type ProductWithVariants = Product & {
  product_variants?: ProductVariant[] | null;
  categories?: { name: string; slug: string } | null;
};

type ProductDraft = {
  title: string;
  product_tag: string;
  description: string;
  price_aed: string;
  categorySlug: string;
  fabric: string;
  customization: ProductCustomizationConfig;
};

type CreateStep = 1 | 2;

type ProductListingSuggestion = {
  title: string;
  description: string;
  categorySlug: string | null;
  colorName: string | null;
};

function categoryHasSizes(categorySlug: string) {
  return categorySlug !== "gifting";
}

async function compressImageForListing(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();

    // Keep listing originals detailed enough for large desktop cards and retina screens.
    const maxDimension = 3000;
    const scale = Math.min(
      1,
      maxDimension / Math.max(image.width, image.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the product photo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.94);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function draftsFromVariants(product: ProductWithVariants): ColorDraft[] {
  if (product.product_variants?.length) {
    return [...product.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(colorDraftFromVariant);
  }
  return [colorDraftFromProduct(product)];
}

function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-[#d5ddd9] bg-white/95 px-4 pt-3 backdrop-blur sm:-mx-5 sm:px-5"
      style={{
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>
  );
}

function SheetShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#eef2f0]">
      <div
        className="flex items-center gap-3 border-b border-[#c6d0cb] bg-white px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-xl border border-[#aebdb6] bg-white text-[#3e514a]"
          aria-label="Close"
        >
          <PortalIcon name="close" className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[#17231f]">
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-xs text-[#7b8882]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {children}
      </div>
    </div>
  );
}

function ListingGenerationOverlay({ organizing }: { organizing: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#14251f]/45 p-4 backdrop-blur-sm" role="status" aria-live="polite" aria-label="Generating product listing">
      <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-[#f7fbf8] p-8 text-center shadow-[0_30px_100px_-35px_rgba(12,35,28,0.8)]">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#dceee7]">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#b6d7c8] border-t-[#2f6f66]" />
        </div>
        <h2 className="mt-6 font-display text-3xl tracking-tight text-[#17362b]">Generating your listing</h2>
        <p className="mt-2 text-sm leading-6 text-[#60746b]">{organizing ? "Sorting your photos into colour groups…" : "Writing the title and description from your photos…"}</p>
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true">{[0, 1, 2].map((item) => <span key={item} className="h-2 w-2 animate-bounce rounded-full bg-[#5d9a78]" style={{ animationDelay: `${item * 150}ms` }} />)}</div>
      </div>
    </div>
  );
}

function ColorTour({ step, onNext, onSkip }: { step: 1 | 2; onNext: () => void; onSkip: () => void }) {
  const addColor = step === 1;
  const [target, setTarget] = useState<DOMRect | null>(null);
  useEffect(() => {
    const update = () => setTarget(document.querySelector(`[data-tour="${addColor ? "add-color" : "move-photo"}"]`)?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [addColor]);
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const bubbleWidth = Math.min(288, viewportWidth - 32);
  const top = target ? (target.bottom + 16 + 170 < viewportHeight ? target.bottom + 16 : Math.max(16, target.top - 186)) : 24;
  const left = target ? Math.max(16, Math.min(target.left + target.width / 2 - bubbleWidth / 2, viewportWidth - bubbleWidth - 16)) : 16;
  const arrowLeft = target ? Math.max(20, Math.min(target.left + target.width / 2 - left - 9, bubbleWidth - 28)) : 32;
  return <div className="hidden fixed inset-0 z-[90] bg-[#14251f]/25 sm:block" role="dialog" aria-label="Colour options guide">
    <div className="fixed rounded-2xl border border-[#e6b4c2] bg-white/95 p-4 text-sm text-[#21463b] shadow-xl" style={{ top, left, width: bubbleWidth }}>
      <div className="absolute -top-3 h-6 w-6 rotate-45 border-l border-t border-[#e6b4c2] bg-white/95" style={{ left: arrowLeft }} />
      <p className="relative font-semibold">{addColor ? "Create a colour variant" : "Organise your photos"}</p>
      <p className="relative mt-1 leading-5 text-muted">{addColor ? "Click Add color to create another colour for this product." : "Drag a product photo from one colour section to another to organise it."}</p>
      <div className="relative mt-3 flex items-center justify-between gap-2"><button type="button" onClick={onSkip} className="text-xs text-muted underline">Skip</button><button type="button" onClick={onNext} className="rounded-full bg-[#21342e] px-3 py-1.5 text-xs font-semibold text-white">{addColor ? "Next" : "Done"}</button></div>
    </div>
  </div>;
}

export default function PortalProductsPage() {
  const searchParams = useSearchParams();
  const requestedEditId = searchParams.get("edit");
  const { store, loading, error } = useOwnerStore();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    product_tag: "",
    description: "",
    fabric: "",
    price_aed: "",
    categorySlug: "",
    customization: defaultCustomizationConfig(),
  });
  const [createColors, setCreateColors] = useState<ColorDraft[]>([
    createColorDraft({ color_name: "Default" }),
  ]);
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ title: string; description: string } | null>(null);
  const [query, setQuery] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    "newest" | "price_desc" | "price_asc" | "stock_asc"
  >("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStock, setBulkStock] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft | null>(null);
  const [editColors, setEditColors] = useState<ColorDraft[]>([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    title: string;
  } | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [colorTourStep, setColorTourStep] = useState(0);
  const [uploadCelebrationKey, setUploadCelebrationKey] = useState(0);

  async function loadProducts(storeId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*, product_variants(*), categories(name, slug)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setProducts((data as ProductWithVariants[]) ?? []);
  }

  useEffect(() => {
    void loadBrowseCategoryOptions().then(setCategories);
  }, []);

  useEffect(() => {
    if (!requestedEditId || editingProductId || !products.length) return;
    const product = products.find((item) => item.id === requestedEditId);
    if (product) openEdit(product);
  }, [requestedEditId, products, editingProductId]);

  useEffect(() => {
    if (!store) return;
    const run = () => {
      void loadProducts(store.id);
    };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else window.setTimeout(run, 0);
  }, [store]);

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedQuery = params.get("q");
      if (requestedQuery) setQuery(requestedQuery);
      if (params.get("new") === "1") {
        openCreate();
      }
    };
    if (typeof queueMicrotask === "function") queueMicrotask(syncFromUrl);
    else window.setTimeout(syncFromUrl, 0);
  }, []);

  useEffect(() => {
    if (!addProductOpen && !editingProductId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [addProductOpen, editingProductId]);

  const visibleProducts = [...products]
    .filter((product) => {
      if (showHiddenOnly && product.is_available) return false;
      if (showLowStock && product.stock > 5) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        product.title.toLowerCase().includes(q) ||
        (product.description ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "price_desc") return b.price_aed - a.price_aed;
      if (sortBy === "price_asc") return a.price_aed - b.price_aed;
      if (sortBy === "stock_asc") return a.stock - b.stock;
      return 0;
    });

  const editingProduct =
    products.find((product) => product.id === editingProductId) ?? null;

  function openCreate() {
    setCreateStep(1);
    setMessage(null);
    setForm({
      title: "",
      product_tag: "",
      description: "",
      fabric: "",
      price_aed: "",
      categorySlug: "",
      customization: defaultCustomizationConfig(),
    });
    setCreateColors([createColorDraft({ color_name: "Default" })]);
    setAiGenerated(false);
    setAiSuggestions(null);
    setColorTourStep(0);
    setAddProductOpen(true);
  }

  function closeCreate() {
    setAddProductOpen(false);
    setCreateStep(1);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("new")) {
        url.searchParams.delete("new");
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      }
    }
  }

  function updatePrimaryColorDraft(next: ColorDraft) {
    setCreateColors((current) =>
      current.length > 0 ? [next, ...current.slice(1)] : [next],
    );
  }

  async function generateListing() {
    if (!store) return;
    // AI generation is intentionally paused while the OpenAI project is out
    // of credits. Keep the AI routes/components in place for re-enabling it
    // later, but let sellers finish a listing with a local draft for now.
    const primary = createColors[0];
    if (!primary || primary.images.length === 0) {
      setMessage("Add at least one product photo to generate a listing.");
      return;
    }
    if (!form.price_aed.trim() || Number(form.price_aed) < 0) {
      setMessage("Enter a valid price before generating the listing.");
      return;
    }
    // Size selection happens on the review step. Do not block the seller
    // from reaching it just because no sizes are selected yet.
    const stock = Number(primary.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      setMessage("Enter a valid stock count.");
      return;
    }

    setGenerating(true);
    setMessage("Preparing your listing…");

    try {
      setForm((current) => ({
        ...current,
        title: current.title,
        description: current.description || "Please add a product description.",
      }));
      setAiSuggestions(null);
      setAiGenerated(false);
      setMessage("Review your listing, then publish when it looks right.");
      setCreateStep(2);
      setColorTourStep(1);
      setColorTourStep(1);
    } finally {
      setGenerating(false);
    }
  }

  async function organizeCreatePhotos() {
    if (!store) return;
    const photos = createColors.flatMap((color) => color.images.filter((image) => image.file));
    if (!photos.length) { setMessage("Add product photos first."); return; }
    setOrganizing(true);
    setMessage("AI is grouping your photos by colour…");
    try {
      const images = await Promise.all(photos.map(async (image) => ({ id: image.id, name: image.file?.name ?? "product-photo", data: await compressImageForListing(image.file!) })));
      const response = await fetch("/api/portal/products/bulk-analyze", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000), body: JSON.stringify({ storeId: store.id, images }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not group the photos.");
      const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
      const groups = (payload.groups ?? []).flatMap((group: { imageIds: string[]; colorName?: string; colorGroups?: Array<{ imageIds: string[]; colorName?: string }> }) => group.colorGroups?.length ? group.colorGroups : [{ imageIds: group.imageIds, colorName: group.colorName }]);
      const next: ColorDraft[] = groups.map((group: { imageIds: string[]; colorName?: string }) => createColorDraft({ color_name: group.colorName?.trim() || "Unassigned colour", images: group.imageIds.map((id) => photoMap.get(id)).filter((photo): photo is ColorDraft["images"][number] => Boolean(photo)) }));
      const assigned = new Set(next.flatMap((color) => color.images.map((image) => image.id)));
      const remainder = photos.filter((photo) => !assigned.has(photo.id));
      if (remainder.length) next.push(createColorDraft({ color_name: "Unassigned colour", images: remainder }));
      if (!next.length) throw new Error("AI could not group these photos. You can continue manually.");
      setCreateColors(next);
      setMessage(`${photos.length} photos grouped into ${next.length} colour${next.length === 1 ? "" : "s"}. Review or drag any photo to another colour.`);
      return next;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not group the photos."); return createColors; }
    finally { setOrganizing(false); }
  }

  function openEdit(product: ProductWithVariants) {
    setEditingProductId(product.id);
    setEditDraft({
      title: product.title,
      product_tag: product.product_tag ?? "",
      description: product.description ?? "",
      price_aed: String(product.price_aed),
      categorySlug: product.categories?.slug ?? "",
      fabric: product.fabric ?? "",
      customization:
        product.categories?.slug === "gifting"
          ? defaultCustomizationConfig()
          : customizationConfigFromProduct(product),
    });
    setEditColors(draftsFromVariants(product));
    setEditMessage(null);
  }

  function closeEdit() {
    setEditingProductId(null);
    setEditDraft(null);
    setEditColors([]);
    setEditMessage(null);
  }

  async function onCreate(e?: FormEvent) {
    e?.preventDefault();
    if (!store) return;
    if (!form.title.trim()) {
      setMessage("Add a product name.");
      setCreateStep(1);
      return;
    }
    if (!form.price_aed.trim() || Number(form.price_aed) < 0) {
      setMessage("Enter a valid price.");
      setCreateStep(1);
      return;
    }
    if (!form.categorySlug) {
      setMessage("Choose a category for this product.");
      setCreateStep(1);
      return;
    }
    if (
      categoryHasSizes(form.categorySlug) &&
      form.customization.enabled &&
      form.customization.fields.length === 0
    ) {
      setMessage("Choose at least one measurement for custom sizing.");
      setCreateStep(2);
      return;
    }
    const hasSizes = categoryHasSizes(form.categorySlug);
    const colorError = validateColorDrafts(createColors, {
      requireSizes: hasSizes,
    });
    if (colorError) {
      setMessage(colorError);
      setCreateStep(2);
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const aggregate = aggregateFromColorDrafts(createColors, hasSizes);
    const listingDrafts = hasSizes
      ? createColors
      : createColors.map((draft) => ({ ...draft, sizes: [] }));
    const category = categories.find((item) => item.slug === form.categorySlug);

    let categoryId: string;
    try {
      categoryId = await ensureStoreCategory({
        storeId: store.id,
        categorySlug: form.categorySlug,
        categoryName: category?.name,
      });
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not save the category.",
      );
      setSaving(false);
      return;
    }

    const { data: created, error: insertError } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        category_id: categoryId,
        title: form.title,
        product_tag: form.product_tag.trim().toUpperCase() || null,
        description: form.description || null,
        fabric: form.fabric || null,
        price_aed: Number(form.price_aed),
        stock: aggregate.stock,
        sizes: aggregate.sizes,
        size_stock: hasSizes ? aggregate.size_stock : {},
        customization_enabled:
          categoryHasSizes(form.categorySlug) && form.customization.enabled,
        customization_instructions:
          categoryHasSizes(form.categorySlug) && form.customization.enabled
            ? form.customization.instructions.trim()
            : null,
        customization_fields:
          categoryHasSizes(form.categorySlug) && form.customization.enabled
            ? form.customization.fields
            : [],
        is_available: true,
        image_urls: [],
      })
      .select("*")
      .single();

    if (insertError || !created) {
      setMessage(insertError?.message ?? "Could not create product.");
      setSaving(false);
      return;
    }

    try {
      await replaceProductVariants({
        storeId: store.id,
        productId: created.id,
        drafts: listingDrafts,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save product inventory.");
      setSaving(false);
      return;
    }

    setForm({
      title: "",
      product_tag: "",
      description: "",
      fabric: "",
      price_aed: "",
      categorySlug: "",
      customization: defaultCustomizationConfig(),
    });
    setCreateColors([createColorDraft({ color_name: "Default" })]);
    setSaving(false);
    setMessage("Product added with size inventory.");
    setUploadCelebrationKey(Date.now());
    closeCreate();
    void revalidatePublicCatalog();
    await loadProducts(store.id);
  }

  async function saveEdit() {
    if (!store || !editingProduct || !editDraft) return;
    const price = Number(editDraft.price_aed);
    if (!editDraft.title.trim()) {
      setEditMessage("Every product needs a name.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setEditMessage("Enter a valid price.");
      return;
    }
    if (!editDraft.categorySlug) {
      setEditMessage("Choose a category for this product.");
      return;
    }
    if (
      categoryHasSizes(editDraft.categorySlug) &&
      editDraft.customization.enabled &&
      editDraft.customization.fields.length === 0
    ) {
      setEditMessage("Choose at least one measurement for custom sizing.");
      return;
    }
    const hasSizes = categoryHasSizes(editDraft.categorySlug);
    const colorError = validateColorDrafts(editColors, {
      requireSizes: hasSizes,
    });
    if (colorError) {
      setEditMessage(colorError);
      return;
    }

    setSavingEdits(true);
    setEditMessage(null);
    const supabase = createClient();
    const aggregate = aggregateFromColorDrafts(editColors, hasSizes);
    const category = categories.find(
      (item) => item.slug === editDraft.categorySlug,
    );
    let categoryId: string;
    try {
      categoryId = await ensureStoreCategory({
        storeId: store.id,
        categorySlug: editDraft.categorySlug,
        categoryName: category?.name,
      });
    } catch (err) {
      setEditMessage(
        err instanceof Error ? err.message : "Could not save the category.",
      );
      setSavingEdits(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("products")
      .update({
        category_id: categoryId,
        fabric: editDraft.fabric || null,
        title: editDraft.title.trim(),
        product_tag: editDraft.product_tag.trim().toUpperCase() || null,
        description: editDraft.description.trim() || null,
        price_aed: price,
        stock: aggregate.stock,
        sizes: hasSizes ? aggregate.sizes : [],
        size_stock: hasSizes ? aggregate.size_stock : {},
        customization_enabled:
          categoryHasSizes(editDraft.categorySlug) &&
          editDraft.customization.enabled,
        customization_instructions:
          categoryHasSizes(editDraft.categorySlug) &&
          editDraft.customization.enabled
            ? editDraft.customization.instructions.trim()
            : null,
        customization_fields:
          categoryHasSizes(editDraft.categorySlug) &&
          editDraft.customization.enabled
            ? editDraft.customization.fields
            : [],
        is_available: aggregate.stock > 0 ? editingProduct.is_available : false,
      })
      .eq("id", editingProduct.id)
      .eq("store_id", store.id);

    if (updateError) {
      setEditMessage(updateError.message);
      setSavingEdits(false);
      return;
    }

    try {
      await replaceProductVariants({
        storeId: store.id,
        productId: editingProduct.id,
        drafts: hasSizes
          ? editColors
          : editColors.map((draft) => ({ ...draft, sizes: [] })),
      });
    } catch (err) {
      setEditMessage(
        err instanceof Error ? err.message : "Could not update product inventory.",
      );
      setSavingEdits(false);
      return;
    }

    if (hasSizes) {
      await supabase
        .from("store_inventory_notifications")
        .update({ status: "accepted", resolved_at: new Date().toISOString() })
        .eq("product_id", editingProduct.id)
        .eq("kind", "legacy_size_inventory")
        .eq("status", "pending");
    }

    await loadProducts(store.id);
    setSavingEdits(false);
    closeEdit();
    setMessage("Product updated.");
    void revalidatePublicCatalog();
  }

  async function toggleAvailable(product: Product) {
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ is_available: !product.is_available })
      .eq("id", product.id);
    void revalidatePublicCatalog();
    if (store) await loadProducts(store.id);
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`))
      return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    useRecentlyViewed.getState().removeMany([product.id]);
    void revalidatePublicCatalog();
    if (editingProductId === product.id) closeEdit();
    if (store) await loadProducts(store.id);
  }

  function toggleSelected(productId: string) {
    setSelectedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  }

  async function bulkSetAvailability(isAvailable: boolean) {
    if (!selectedIds.length) return;
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ is_available: isAvailable })
      .in("id", selectedIds);
    setSelectedIds([]);
    void revalidatePublicCatalog();
    if (store) await loadProducts(store.id);
  }

  async function bulkDeleteProducts() {
    if (!selectedIds.length) return;
    const count = selectedIds.length;
    if (!window.confirm(`Delete ${count} selected product${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .in("id", selectedIds);
    if (deleteError) {
      setMessage("Some products could not be deleted. Please try again.");
      return;
    }
    setSelectedIds([]);
    setMessage(`${count} product${count === 1 ? "" : "s"} deleted.`);
    void revalidatePublicCatalog();
    if (store) await loadProducts(store.id);
  }

  async function bulkSetStock() {
    if (!selectedIds.length || !bulkStock.trim() || !store) return;
    const stock = Number(bulkStock);
    if (Number.isNaN(stock) || stock < 0) return;
    const supabase = createClient();

    for (const productId of selectedIds) {
      const product = products.find((item) => item.id === productId);
      if (!product) continue;
      const variants = product.product_variants ?? [];
      if (variants.length > 0) {
        await supabase
          .from("product_variants")
          .update({ stock })
          .eq("product_id", productId);
        await supabase.from("products").update({ is_available: stock > 0 ? product.is_available : false }).eq("id", productId);
      } else {
        await supabase.from("products").update({ stock, is_available: stock > 0 ? product.is_available : false }).eq("id", productId);
      }
    }

    setSelectedIds([]);
    setBulkStock("");
    void revalidatePublicCatalog();
    await loadProducts(store.id);
  }

  if (error === "unauthenticated") {
    return (
      <PortalEmpty
        icon="products"
        title="Sign in to manage your catalog"
        description="Use the owner account linked to your Morni store."
        action={{ label: "Sign in", href: "/auth?next=/portal/products" }}
      />
    );
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) {
    return (
      <PortalEmpty
        icon="store"
        title="Set up your first store"
        description="Create a store before adding products to your marketplace catalog."
        action={{ label: "Start store setup", href: "/sell/setup" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <UploadSuccessConfetti celebrationKey={uploadCelebrationKey} />
      <PortalPageHeader
        eyebrow="Catalog"
        title="Products"
        description={`Manage the live catalog, stock levels, options, and availability for ${store.name}.`}
      >
        <Link
          href="/portal/products/bulk-upload"
          className="portal-button-secondary bulk-upload-button"
        >
          Bulk upload
        </Link>
        <button
          type="button"
          onClick={openCreate}
          className="portal-button-primary"
        >
          <PortalIcon name="plus" className="h-4 w-4" />
          Add product
        </button>
      </PortalPageHeader>

      <section className="sm:hidden" aria-label="Catalog summary">
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_8px_24px_rgba(28,48,40,0.05)]">
          <button
            type="button"
            onClick={() => {
              setShowLowStock(false);
              setShowHiddenOnly(false);
            }}
            aria-pressed={!showLowStock && !showHiddenOnly}
            className={`min-w-0 px-2.5 py-3 text-left transition ${!showLowStock && !showHiddenOnly ? "bg-[#f3f8f5]" : "hover:bg-[#f8faf9]"}`}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#60706a]">
              <PortalIcon name="products" className="h-3.5 w-3.5" />
              Live
            </span>
            <span className="mt-1 block text-xl font-semibold tracking-[-0.04em] text-[#17231f]">
              {products.filter((product) => product.is_available).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLowStock(true);
              setShowHiddenOnly(false);
            }}
            aria-pressed={showLowStock && !showHiddenOnly}
            className={`min-w-0 border-x border-[#edf1ef] px-2.5 py-3 text-left transition ${showLowStock && !showHiddenOnly ? "bg-[#fff8f1]" : "hover:bg-[#f8faf9]"}`}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#60706a]">
              <PortalIcon name="warning" className="h-3.5 w-3.5" />
              Low stock
            </span>
            <span
              className={`mt-1 block text-xl font-semibold tracking-[-0.04em] ${products.some((product) => product.stock <= 5) ? "text-[#b55a36]" : "text-[#17231f]"}`}
            >
              {products.filter((product) => product.stock <= 5).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLowStock(false);
              setShowHiddenOnly(true);
            }}
            aria-pressed={showHiddenOnly && !showLowStock}
            className={`min-w-0 px-2.5 py-3 text-left transition ${showHiddenOnly && !showLowStock ? "bg-[#f3f8f5]" : "hover:bg-[#f8faf9]"}`}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#60706a]">
              <PortalIcon name="eye" className="h-3.5 w-3.5" />
              Hidden
            </span>
            <span className="mt-1 block text-xl font-semibold tracking-[-0.04em] text-[#17231f]">
              {products.filter((product) => !product.is_available).length}
            </span>
          </button>
        </div>
      </section>

      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        <PortalMetric
          label="Live products"
          value={String(
            products.filter((product) => product.is_available).length,
          )}
          detail={`${products.length} in catalog`}
          icon="products"
        />
        <PortalMetric
          label="Low stock"
          value={String(
            products.filter((product) => product.stock <= 5).length,
          )}
          detail="Items with 5 units or fewer"
          icon="warning"
          tone={
            products.some((product) => product.stock <= 5)
              ? "urgent"
              : "default"
          }
        />
        <PortalMetric
          label="Hidden products"
          value={String(
            products.filter((product) => !product.is_available).length,
          )}
          detail="Not visible to shoppers"
          icon="eye"
        />
      </div>

      {message ? (
        <p className="rounded-xl bg-[#edf7f3] px-4 py-3 text-sm text-[#1f594f]">
          {message}
        </p>
      ) : null}

      <div className="portal-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="portal-input"
        placeholder="Search title or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="portal-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="newest">Sort: Newest</option>
            <option value="price_desc">Sort: Price high to low</option>
            <option value="price_asc">Sort: Price low to high</option>
            <option value="stock_asc">Sort: Stock low to high</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-[#dce5e0] bg-[#fbfdfc] px-3 py-2.5 text-sm text-[#52635c]">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
            />
            Low stock only (≤5)
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#dce5e0] bg-[#fbfdfc] px-3 py-2.5 text-sm text-[#52635c]">
            <input
              type="checkbox"
              checked={showHiddenOnly}
              onChange={(e) => setShowHiddenOnly(e.target.checked)}
            />
            Hidden only
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds((current) => current.length === visibleProducts.length ? [] : visibleProducts.map((p) => p.id))}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            {selectedIds.length === visibleProducts.length && visibleProducts.length > 0 ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={() => bulkSetAvailability(false)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Hide selected
          </button>
          <button
            type="button"
            onClick={() => bulkSetAvailability(true)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Show selected
          </button>
          <button
            type="button"
            onClick={() => void bulkDeleteProducts()}
            disabled={selectedIds.length === 0}
            className="rounded-full border border-[#e7b8b8] px-3 py-1.5 text-xs text-[#a34242] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete selected
          </button>
          <input
            type="number"
            min="0"
            placeholder="Bulk stock"
            value={bulkStock}
            onChange={(e) => setBulkStock(e.target.value)}
            className="w-28 rounded-lg border border-line bg-background px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={bulkSetStock}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Update stock
          </button>
        </div>
      </div>

      <CatalogCards
        products={visibleProducts}
        selectedIds={selectedIds}
        onSelect={toggleSelected}
        onPreview={(product) =>
          setPreview({
            images: product.image_urls.map((url, imageIndex) => ({
              url,
              label: `${product.title} photo ${imageIndex + 1}`,
            })),
            title: product.title,
          })
        }
        onToggle={toggleAvailable}
        onDelete={removeProduct}
        onEdit={openEdit}
        className="lg:hidden"
      />

      <div className="hidden lg:block">
        <CatalogTable
          products={visibleProducts}
          selectedIds={selectedIds}
          onSelect={toggleSelected}
          onPreview={(product) =>
            setPreview({
              images: product.image_urls.map((url, imageIndex) => ({
                url,
                label: `${product.title} photo ${imageIndex + 1}`,
              })),
              title: product.title,
            })
          }
          onToggle={toggleAvailable}
          onDelete={removeProduct}
          onEdit={openEdit}
        />
      </div>

      {!editingProductId && !addProductOpen ? (
        <button
          type="button"
          onClick={openCreate}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#21342e] text-white shadow-[0_16px_40px_-18px_rgba(20,35,29,0.65)] lg:hidden"
          aria-label="Add product"
        >
          <PortalIcon name="plus" className="h-6 w-6" />
        </button>
      ) : null}

      {addProductOpen ? (
        <SheetShell
          title="Add product"
          subtitle={
            createStep === 1
              ? "Step 1 of 2 · Photos & stock"
              : "Step 2 of 2 · Review listing"
          }
          onClose={closeCreate}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (createStep === 1) {
                void generateListing();
                return;
              }
              void onCreate();
            }}
            className="mx-auto flex min-h-full w-full max-w-5xl flex-col"
          >
            {createStep === 2 && (colorTourStep === 1 || colorTourStep === 2) ? <ColorTour step={colorTourStep as 1 | 2} onNext={() => setColorTourStep((current) => current === 1 ? 2 : 0)} onSkip={() => setColorTourStep(0)} /> : null}
            <div className="mb-4 flex gap-2">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full ${
                    createStep >= step ? "bg-[#2f6f66]" : "bg-[#d5ddd9]"
                  }`}
                />
              ))}
            </div>

            {createStep === 1 ? (
              <>
              <QuickProductFields
                draft={
                  createColors[0] ?? createColorDraft({ color_name: "Default" })
                }
                priceAed={form.price_aed}
                onPriceChange={(price_aed) =>
                  setForm((current) => ({ ...current, price_aed }))
                }
                onChange={updatePrimaryColorDraft}
                disabled={generating || saving}
              />
              </>
            ) : (
              <div className="space-y-4">
                {aiGenerated ? (
                  <div className="rounded-2xl border border-[#c9ddd4] bg-[#f4faf7] p-4">
                    <p className="text-sm font-semibold text-[#21463b]">
                      AI draft ready for review
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#54756b]">
                      Check every suggestion before publishing. You can edit
                      anything below.
                    </p>
                  </div>
                ) : null}

                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Title *</span>
                  <input
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="Product name"
                    value={form.title}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        title: e.target.value,
                      }))
                    }
                    required
                    autoFocus
                  />
                </label>
                {aiSuggestions ? <div className="-mt-2 rounded-xl border border-[#c9ddd4] bg-[#f4faf7] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2f6f66]">AI-generated title</span><div className="flex gap-2"><button type="button" onClick={() => { setForm((current) => ({ ...current, title: aiSuggestions.title })); setAiSuggestions((current) => current ? { ...current, title: "" } : current); }} className="rounded-full bg-[#2f6f66] px-3 py-1 text-[11px] font-semibold text-white">Accept</button><button type="button" onClick={() => setAiSuggestions((current) => current ? { ...current, title: "" } : current)} className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold text-ink">Deny</button></div></div>{aiSuggestions.title ? <p className="mt-2 text-sm text-[#21463b]">{aiSuggestions.title}</p> : <p className="mt-2 text-xs text-muted">Suggestion denied. You can write your own title.</p>}</div> : null}
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">
                    Product tag
                  </span>
                  <input
                    maxLength={40}
                    pattern="[A-Za-z][A-Za-z0-9-]*"
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm uppercase"
                    placeholder="e.g. VH102"
                    value={form.product_tag}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        product_tag: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                  <span className="text-xs text-muted">
                    Internal inventory reference. Shoppers will not see this.
                  </span>
                </label>
                {aiSuggestions ? <div className="-mt-2 rounded-xl border border-[#c9ddd4] bg-[#f4faf7] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2f6f66]">AI-generated description</span><div className="flex gap-2"><button type="button" onClick={() => { setForm((current) => ({ ...current, description: aiSuggestions.description })); setAiSuggestions((current) => current ? { ...current, description: "" } : current); }} className="rounded-full bg-[#2f6f66] px-3 py-1 text-[11px] font-semibold text-white">Accept</button><button type="button" onClick={() => setAiSuggestions((current) => current ? { ...current, description: "" } : current)} className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold text-ink">Deny</button></div></div>{aiSuggestions.description ? <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#21463b]">{aiSuggestions.description}</p> : <p className="mt-2 text-xs text-muted">Suggestion denied. You can write your own description.</p>}</div> : null}
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Category *</span>
                  <select
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    value={form.categorySlug}
                    onChange={(event) => {
                      const categorySlug = event.target.value;
                      setForm((current) => ({
                        ...current,
                        categorySlug,
                        ...(categorySlug === "gifting"
                          ? { customization: defaultCustomizationConfig() }
                          : {}),
                      }));
                      if (!categoryHasSizes(categorySlug)) {
                        setCreateColors((current) =>
                          current.map((draft) => ({ ...draft, sizes: [] })),
                        );
                      }
                    }}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Fabric / material</span>
                  <select className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm" value={form.fabric} onChange={(e) => setForm((current) => ({ ...current, fabric: e.target.value }))}>
                    <option value="">Select material</option>
                    {PRODUCT_FABRICS.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">
                    Description *
                  </span>
                  <textarea
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="Describe what shoppers should know"
                    rows={5}
                    value={form.description}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        description: e.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <ColorVariantEditor
                  value={createColors}
                  onChange={setCreateColors}
                  highlightAddColor={colorTourStep === 1}
                  disabled={saving || generating || organizing}
                  showSizes={categoryHasSizes(form.categorySlug)}
                />

                {categoryHasSizes(form.categorySlug) ? <CustomizationEditor value={form.customization} onChange={(customization) => setForm((current) => ({ ...current, customization }))} /> : null}
              </div>
            )}

            {message ? (
              <p className="mt-3 text-sm text-accent-deep">{message}</p>
            ) : null}

            <StickyActionBar>
              <div className="flex gap-2">
                {createStep === 2 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    disabled={saving}
                    className="portal-button-secondary flex-1 disabled:opacity-50"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeCreate}
                    className="portal-button-secondary flex-1"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || generating}
                  className="portal-button-primary flex-[1.4] disabled:opacity-50"
                >
                  {createStep === 1
                    ? generating || organizing
                      ? organizing ? "Grouping photos…" : "Creating draft…"
                      : "Generate listing"
                    : saving
                      ? "Publishing…"
                      : "Publish product"}
                </button>
              </div>
            </StickyActionBar>
          </form>
        </SheetShell>
      ) : null}

      {editingProduct && editDraft ? (
        <SheetShell
          title="Edit product"
          subtitle={editingProduct.title}
          onClose={closeEdit}
        >
          <div className="mx-auto flex min-h-full max-w-2xl flex-col">
            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#40534d]">Title</span>
                <input
                  type="text"
                  value={editDraft.title}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? { ...current, title: event.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#40534d]">Product tag</span>
                <input
                  maxLength={40}
                  pattern="[A-Za-z][A-Za-z0-9-]*"
                  className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm uppercase"
                  placeholder="e.g. VH102"
                  value={editDraft.product_tag}
                  onChange={(e) =>
                    setEditDraft((current) =>
                      current
                        ? {
                            ...current,
                            product_tag: e.target.value.toUpperCase(),
                          }
                        : current,
                    )
                  }
                />
                <span className="text-xs text-muted">
                  Internal inventory reference. Shoppers will not see this.
                </span>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#40534d]">Description</span>
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={editDraft.description}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? { ...current, description: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Describe the product for shoppers"
                  className="min-h-32 w-full resize-y rounded-xl border border-line bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-accent"
                />
                <span className="text-xs text-muted">Shown on the product page.</span>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#40534d]">Price (AED)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDraft.price_aed}
                  onChange={(event) =>
                    setEditDraft((current) =>
                      current
                        ? { ...current, price_aed: event.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#40534d]">
                  Category <span className="text-accent-deep">*</span>
                </span>
                <select
                  className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                  value={editDraft.categorySlug}
                  onChange={(event) => {
                    const categorySlug = event.target.value;
                    setEditDraft((current) =>
                      current
                        ? {
                            ...current,
                            categorySlug,
                            ...(categorySlug === "gifting"
                              ? { customization: defaultCustomizationConfig() }
                              : {}),
                          }
                        : current,
                    );
                    if (!categoryHasSizes(categorySlug)) {
                      setEditColors((current) =>
                        current.map((draft) => ({ ...draft, sizes: [] })),
                      );
                    }
                  }}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#40534d]">Fabric / material</span>
                <select className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm" value={editDraft.fabric} onChange={(e) => setEditDraft((current) => current ? { ...current, fabric: e.target.value } : current)}>
                  <option value="">Select material</option>
                  {PRODUCT_FABRICS.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
                </select>
              </label>
              <ColorVariantEditor
                value={editColors}
                onChange={setEditColors}
                disabled={savingEdits}
                showSizes={categoryHasSizes(editDraft.categorySlug)}
              />
              {categoryHasSizes(editDraft.categorySlug) ? <CustomizationEditor compact value={editDraft.customization} onChange={(customization) => setEditDraft((current) => current ? { ...current, customization } : current)} /> : null}
            </div>

            {editMessage ? (
              <p role="alert" className="mt-3 text-sm text-accent-deep">
                {editMessage}
              </p>
            ) : null}

            <StickyActionBar>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={savingEdits}
                  className="portal-button-secondary flex-1 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={savingEdits}
                  className="portal-button-primary flex-[1.4] disabled:opacity-50"
                >
                  {savingEdits ? "Saving…" : "Save changes"}
                </button>
              </div>
            </StickyActionBar>
          </div>
        </SheetShell>
      ) : null}

      {preview ? (
        <ImagePreviewDialog
          images={preview.images}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
      {addProductOpen && (organizing || generating) ? <AiProcessingOverlay phase={organizing ? "analyzing" : "reading"} photoCount={createColors.reduce((sum, color) => sum + color.images.length, 0)} productCount={createColors.length} /> : null}
    </div>
  );
}

function CatalogCards({
  products,
  selectedIds,
  onSelect,
  onPreview,
  onToggle,
  onDelete,
  onEdit,
  className = "",
}: {
  products: ProductWithVariants[];
  selectedIds: string[];
  onSelect: (productId: string) => void;
  onPreview: (product: ProductWithVariants) => void;
  onToggle: (product: Product) => void;
  onDelete: (product: Product) => void;
  onEdit: (product: ProductWithVariants) => void;
  className?: string;
}) {
  if (!products.length) {
    return (
      <div className={className}>
        <PortalEmpty
          icon="products"
          title="No products match these filters"
          description="Try a different search, or add a new product to start building your catalog."
          action={{ label: "Add product", href: "/portal/products?new=1" }}
        />
      </div>
    );
  }

  return (
    <ul className={`space-y-3 ${className}`}>
      {products.map((product) => {
        return (
          <li key={product.id} className="portal-card overflow-hidden p-4">
            <div className="flex gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedIds.includes(product.id)}
                onChange={() => onSelect(product.id)}
                aria-label={`Select ${product.title}`}
              />
              <button
                type="button"
                onClick={() => onPreview(product)}
                disabled={!product.image_urls.length}
                className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#edf3f0] disabled:cursor-default"
              >
                {product.image_urls.length ? (
                  <img
                    src={product.image_urls[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-[10px] text-[#7b8882]">
                    No photo
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#263530]">
                      {product.title}
                    </p>
                    <p className="mt-1 text-sm text-[#5b6a64]">
                      {formatAed(product.price_aed)} · {product.stock} in stock
                    </p>
                    <p className="mt-1 text-xs text-[#7b8882]">
                      {product.categories?.name ?? "Needs category"}
                    </p>
                  </div>
                  {product.is_available ? (
                    <StatusBadge status="live" />
                  ) : (
                    <StatusBadge status="paused" />
                  )}
                </div>
                {product.customization_enabled ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#edf7f3] px-2 py-1 text-[11px] font-semibold text-[#2f6f66]">
                    <PortalIcon name="sparkle" className="h-3 w-3" /> Custom
                    sizing
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="portal-button-primary px-2 py-2.5 text-xs"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onToggle(product)}
                className="portal-button-secondary px-2 py-2.5 text-xs"
              >
                {product.is_available ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(product)}
                className="rounded-lg px-2 py-2.5 text-xs font-semibold text-[#b34e4e] hover:bg-[#fdf1f1]"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CatalogTable({
  products,
  selectedIds,
  onSelect,
  onPreview,
  onToggle,
  onDelete,
  onEdit,
}: {
  products: ProductWithVariants[];
  selectedIds: string[];
  onSelect: (productId: string) => void;
  onPreview: (product: ProductWithVariants) => void;
  onToggle: (product: Product) => void;
  onDelete: (product: Product) => void;
  onEdit: (product: ProductWithVariants) => void;
}) {
  if (!products.length) {
    return (
      <PortalEmpty
        icon="products"
        title="No products match these filters"
        description="Try a different search, or add a new product to start building your catalog."
        action={{ label: "Add product", href: "/portal/products?new=1" }}
      />
    );
  }

  return (
    <div className="portal-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ef] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[#263530]">
            Catalog inventory
          </p>
          <p className="mt-1 text-xs text-[#7b8882]">
            {products.length} product{products.length === 1 ? "" : "s"} in this
            view
          </p>
        </div>
        <p className="text-xs text-[#7b8882]">
          Select products above to make bulk changes.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="portal-table w-full min-w-[860px] text-left">
          <thead className="bg-[#fbfdfc]">
            <tr>
              <th className="w-12 px-5 py-3">Select</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              return (
                <tr key={product.id} className="transition hover:bg-[#f8faf9]">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => onSelect(product.id)}
                      aria-label={`Select ${product.title}`}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onPreview(product)}
                        disabled={!product.image_urls.length}
                        className="group h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-[#edf3f0] disabled:cursor-default"
                      >
                        {product.image_urls.length ? (
                          <>
                            <img
                              src={product.image_urls[0]}
                              alt=""
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                            <span className="sr-only">Preview photos</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#7b8882]">
                            No photo
                          </span>
                        )}
                      </button>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#34423d]">
                          {product.title}
                        </span>
                        <span className="mt-1 block max-w-72 truncate text-xs text-[#7b8882]">
                          Category:{" "}
                          {product.categories?.name ?? "Needs category"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {product.is_available ? (
                      <StatusBadge status="live" />
                    ) : (
                      <StatusBadge status="paused" />
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        product.stock <= 5 ? "text-[#a56225]" : "text-[#40534d]"
                      }`}
                    >
                      {product.stock}
                    </span>
                    {product.stock <= 5 ? (
                      <span className="ml-2">
                        <StatusBadge status="low_stock" />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-[#263530]">
                    {formatAed(product.price_aed)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(product)}
                        className="portal-button-primary px-3 py-1.5 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(product)}
                        className="portal-button-secondary px-3 py-1.5 text-xs"
                      >
                        {product.is_available ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(product)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#b34e4e] hover:bg-[#fdf1f1]"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
