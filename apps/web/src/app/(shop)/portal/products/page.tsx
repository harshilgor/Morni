"use client";

/* Product thumbnails may originate from seller-controlled Supabase storage URLs. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { ColorVariantEditor } from "@/components/color-variant-editor";
import { CustomizationEditor } from "@/components/customization-editor";
import { QuickProductFields } from "@/components/quick-product-fields";
import type { CategoryOption } from "@/components/product-form-fields";
import {
  ImagePreviewDialog,
  type PreviewImage,
} from "@/components/image-preview-dialog";
import { PortalIcon } from "@/components/portal-icons";
import { PortalEmpty, PortalMetric, PortalPageHeader, StatusBadge } from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed } from "@/lib/format";
import {
  aggregateFromColorDrafts,
  colorDraftFromProduct,
  createColorDraft,
  validateColorDrafts,
  type ColorDraft,
} from "@/lib/product-variants";
import { replaceProductVariants } from "@/lib/save-product-variants";
import { revalidatePublicCatalog } from "@/lib/revalidate-catalog";
import { ensureStoreCategory, loadBrowseCategoryOptions } from "@/lib/store-category";
import type { Product, ProductVariant } from "@/lib/types";
import {
  customizationConfigFromProduct,
  defaultCustomizationConfig,
  type ProductCustomizationConfig,
} from "@/lib/product-customization";

type ProductWithVariants = Product & {
  product_variants?: ProductVariant[] | null;
  categories?: { name: string; slug: string } | null;
};

type ProductDraft = {
  title: string;
  price_aed: string;
  categorySlug: string;
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

    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the product photo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function draftsFromVariants(product: ProductWithVariants): ColorDraft[] {
  const variants = [...(product.product_variants ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (variants.length === 0) {
    return [colorDraftFromProduct(product)];
  }
  return variants.map((variant) =>
    createColorDraft({
      id: variant.id,
      key: variant.id,
      color_name: variant.color_name,
      color_hex: variant.color_hex ?? "#c45b7a",
      sizes: variant.sizes?.length ? [...variant.sizes] : ["S", "M", "L"],
      stock: String(variant.stock ?? 0),
      images: (variant.image_urls ?? []).map((url, index) => ({
        id: `${variant.id}-${index}`,
        url,
        existing: true,
      })),
    }),
  );
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
          <p className="truncate text-base font-semibold text-[#17231f]">{title}</p>
          {subtitle ? <p className="truncate text-xs text-[#7b8882]">{subtitle}</p> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
    </div>
  );
}

export default function PortalProductsPage() {
  const { store, loading, error } = useOwnerStore();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
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
  const [aiGenerated, setAiGenerated] = useState(false);
  const [query, setQuery] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "price_desc" | "price_asc" | "stock_asc">(
    "newest",
  );
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
        (product.description ?? "").toLowerCase().includes(q) ||
        (product.product_variants ?? []).some((variant) =>
          variant.color_name.toLowerCase().includes(q),
        )
      );
    })
    .sort((a, b) => {
      if (sortBy === "price_desc") return b.price_aed - a.price_aed;
      if (sortBy === "price_asc") return a.price_aed - b.price_aed;
      if (sortBy === "stock_asc") return a.stock - b.stock;
      return 0;
    });

  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;

  function openCreate() {
    setCreateStep(1);
    setMessage(null);
    setForm({
      title: "",
      description: "",
      price_aed: "",
      categorySlug: "",
      customization: defaultCustomizationConfig(),
    });
    setCreateColors([createColorDraft({ color_name: "Default" })]);
    setAiGenerated(false);
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
    const primary = createColors[0];
    if (!primary || primary.images.length === 0) {
      setMessage("Add at least one product photo to generate a listing.");
      return;
    }
    if (!form.price_aed.trim() || Number(form.price_aed) < 0) {
      setMessage("Enter a valid price before generating the listing.");
      return;
    }
    if (primary.sizes.length === 0 && categoryHasSizes(form.categorySlug)) {
      setMessage("Choose at least one available size.");
      return;
    }
    const stock = Number(primary.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      setMessage("Enter a valid stock count.");
      return;
    }

    setGenerating(true);
    setMessage("Creating a draft from your product photos…");

    try {
      const files = primary.images
        .map((image) => image.file)
        .filter((file): file is File => Boolean(file))
        .slice(0, 3);
      const images = await Promise.all(files.map(compressImageForListing));
      if (images.length === 0) {
        throw new Error("Please choose a new product photo to generate a listing.");
      }

      const response = await fetch("/api/portal/products/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          priceAed: Number(form.price_aed),
          stock,
          sizes: primary.sizes,
          images,
        }),
      });
      const payload = (await response.json()) as {
        suggestion?: ProductListingSuggestion;
        error?: string;
      };
      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error ?? "Could not generate a product draft.");
      }

      const suggestion = payload.suggestion;
      setForm((current) => ({
        ...current,
        title: suggestion.title,
        description: suggestion.description,
        categorySlug: suggestion.categorySlug ?? "",
      }));
      updatePrimaryColorDraft({
        ...primary,
        color_name: suggestion.colorName || "Default",
      });
      setAiGenerated(true);
      setMessage("Review the suggested listing, then publish when it looks right.");
      setCreateStep(2);
    } catch (error) {
      setAiGenerated(false);
      setMessage(
        error instanceof Error
          ? `${error.message} You can fill in the listing manually below.`
          : "AI listing generation is unavailable. You can fill in the listing manually below.",
      );
      setCreateStep(2);
    } finally {
      setGenerating(false);
    }
  }

  function openEdit(product: ProductWithVariants) {
    setEditingProductId(product.id);
    setEditDraft({
      title: product.title,
      price_aed: String(product.price_aed),
      categorySlug: product.categories?.slug ?? "",
      customization: customizationConfigFromProduct(product),
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
    if (form.customization.enabled && form.customization.fields.length === 0) {
      setMessage("Choose at least one measurement for custom sizing.");
      setCreateStep(2);
      return;
    }
    const hasSizes = categoryHasSizes(form.categorySlug);
    const colorError = validateColorDrafts(createColors, { requireSizes: hasSizes });
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
      setMessage(err instanceof Error ? err.message : "Could not save the category.");
      setSaving(false);
      return;
    }

    const { data: created, error: insertError } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        category_id: categoryId,
        title: form.title,
        description: form.description || null,
        price_aed: Number(form.price_aed),
        stock: aggregate.stock,
        sizes: aggregate.sizes,
        customization_enabled: form.customization.enabled,
        customization_instructions: form.customization.enabled
          ? form.customization.instructions.trim()
          : null,
        customization_fields: form.customization.enabled
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
      setMessage(err instanceof Error ? err.message : "Could not save colors.");
      setSaving(false);
      return;
    }

    setForm({
      title: "",
      description: "",
      price_aed: "",
      categorySlug: "",
      customization: defaultCustomizationConfig(),
    });
    setCreateColors([createColorDraft({ color_name: "Default" })]);
    setSaving(false);
    setMessage("Product added with color options.");
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
    if (editDraft.customization.enabled && editDraft.customization.fields.length === 0) {
      setEditMessage("Choose at least one measurement for custom sizing.");
      return;
    }
    const hasSizes = categoryHasSizes(editDraft.categorySlug);
    const colorError = validateColorDrafts(editColors, { requireSizes: hasSizes });
    if (colorError) {
      setEditMessage(colorError);
      return;
    }

    setSavingEdits(true);
    setEditMessage(null);
    const supabase = createClient();
    const category = categories.find((item) => item.slug === editDraft.categorySlug);
    let categoryId: string;
    try {
      categoryId = await ensureStoreCategory({
        storeId: store.id,
        categorySlug: editDraft.categorySlug,
        categoryName: category?.name,
      });
    } catch (err) {
      setEditMessage(err instanceof Error ? err.message : "Could not save the category.");
      setSavingEdits(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("products")
      .update({
        category_id: categoryId,
        title: editDraft.title.trim(),
        price_aed: price,
        customization_enabled: editDraft.customization.enabled,
        customization_instructions: editDraft.customization.enabled
          ? editDraft.customization.instructions.trim()
          : null,
        customization_fields: editDraft.customization.enabled
          ? editDraft.customization.fields
          : [],
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
      setEditMessage(err instanceof Error ? err.message : "Could not update colors.");
      setSavingEdits(false);
      return;
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
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from("products").delete().eq("id", product.id);
    void revalidatePublicCatalog();
    if (editingProductId === product.id) closeEdit();
    if (store) await loadProducts(store.id);
  }

  function toggleSelected(productId: string) {
    setSelectedIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  }

  async function bulkSetAvailability(isAvailable: boolean) {
    if (!selectedIds.length) return;
    const supabase = createClient();
    await supabase.from("products").update({ is_available: isAvailable }).in("id", selectedIds);
    setSelectedIds([]);
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
        await supabase.from("product_variants").update({ stock }).eq("product_id", productId);
      } else {
        await supabase.from("products").update({ stock }).eq("id", productId);
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
      <PortalPageHeader
        eyebrow="Catalog"
        title="Products"
        description={`Manage the live catalog, stock levels, options, and availability for ${store.name}.`}
      >
        <button type="button" onClick={openCreate} className="portal-button-primary">
          <PortalIcon name="plus" className="h-4 w-4" />
          Add product
        </button>
      </PortalPageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <PortalMetric
          label="Live products"
          value={String(products.filter((product) => product.is_available).length)}
          detail={`${products.length} in catalog`}
          icon="products"
        />
        <PortalMetric
          label="Low stock"
          value={String(products.filter((product) => product.stock <= 5).length)}
          detail="Items with 5 units or fewer"
          icon="warning"
          tone={products.some((product) => product.stock <= 5) ? "urgent" : "default"}
        />
        <PortalMetric
          label="Hidden products"
          value={String(products.filter((product) => !product.is_available).length)}
          detail="Not visible to shoppers"
          icon="eye"
        />
      </div>

      {message ? (
        <p className="rounded-xl bg-[#edf7f3] px-4 py-3 text-sm text-[#1f594f]">{message}</p>
      ) : null}

      <div className="portal-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="portal-input"
            placeholder="Search title, description, or color"
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
            onClick={() => setSelectedIds(visibleProducts.map((p) => p.id))}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            Select visible
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
          subtitle={createStep === 1 ? "Step 1 of 2 · Photos & stock" : "Step 2 of 2 · Review listing"}
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
            className="mx-auto flex min-h-full max-w-2xl flex-col"
          >
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
              <QuickProductFields
                draft={createColors[0] ?? createColorDraft({ color_name: "Default" })}
                priceAed={form.price_aed}
                onPriceChange={(price_aed) => setForm((current) => ({ ...current, price_aed }))}
                onChange={updatePrimaryColorDraft}
                disabled={generating || saving}
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#c9ddd4] bg-[#f4faf7] p-4">
                  <p className="text-sm font-semibold text-[#21463b]">
                    {aiGenerated ? "AI draft ready for review" : "Finish your product listing"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#54756b]">
                    {aiGenerated
                      ? "Check every suggestion before publishing. You can edit anything below."
                      : "AI suggestions are unavailable, so enter the listing details manually."
                    }
                  </p>
                </div>

                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Title *</span>
                  <input
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="Product name"
                    value={form.title}
                    onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                    required
                    autoFocus
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Category *</span>
                  <select
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    value={form.categorySlug}
                    onChange={(event) => {
                      const categorySlug = event.target.value;
                      setForm((current) => ({ ...current, categorySlug }));
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
                  <span className="font-medium text-[#40534d]">Description *</span>
                  <textarea
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="Describe what shoppers should know"
                    rows={5}
                    value={form.description}
                    onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                    required
                  />
                </label>

                <div className="rounded-2xl border border-line bg-white p-4 text-sm text-[#40534d]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Essentials saved</span>
                    <span className="text-xs text-muted">
                      {createColors[0]?.stock ?? 0} in stock · {categoryHasSizes(form.categorySlug) ? `${createColors[0]?.sizes.length ?? 0} sizes · ` : ""}{createColors[0]?.images.length ?? 0} photos
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Need colors, custom sizing, or other advanced options? Expand below.
                  </p>
                </div>

                <details className="rounded-2xl border border-line bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[#40534d]">
                    Advanced options
                  </summary>
                  <div className="mt-4 space-y-4">
                    <CustomizationEditor
                      value={form.customization}
                      onChange={(customization) => setForm((current) => ({ ...current, customization }))}
                    />
                    <ColorVariantEditor
                      value={createColors}
                      onChange={setCreateColors}
                      disabled={saving}
                      showSizes={categoryHasSizes(form.categorySlug)}
                    />
                  </div>
                </details>
              </div>
            )}

            {message ? <p className="mt-3 text-sm text-accent-deep">{message}</p> : null}

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
                    ? generating
                      ? "Creating draft…"
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
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-accent"
                />
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
                      current ? { ...current, price_aed: event.target.value } : current,
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
                        current ? { ...current, categorySlug } : current,
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
              <CustomizationEditor
                compact
                value={editDraft.customization}
                onChange={(customization) =>
                  setEditDraft((current) => (current ? { ...current, customization } : current))
                }
              />
              <ColorVariantEditor
                compact
                value={editColors}
                onChange={setEditColors}
                disabled={savingEdits}
                showSizes={categoryHasSizes(editDraft.categorySlug)}
              />
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
        const variants = [...(product.product_variants ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
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
                    <p className="truncate text-sm font-semibold text-[#263530]">{product.title}</p>
                    <p className="mt-1 text-sm text-[#5b6a64]">
                      {formatAed(product.price_aed)} · {product.stock} in stock
                    </p>
                    <p className="mt-1 text-xs text-[#7b8882]">
                      {product.categories?.name ?? "Needs category"}
                    </p>
                  </div>
                  {product.is_available ? <StatusBadge status="live" /> : <StatusBadge status="paused" />}
                </div>
                {variants.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {variants.slice(0, 4).map((variant) => (
                      <span
                        key={variant.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#fbfdfc] px-2 py-1 text-[11px] text-ink"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-line"
                          style={{ background: variant.color_hex ?? "#c45b7a" }}
                        />
                        {variant.color_name}
                      </span>
                    ))}
                    {variants.length > 4 ? (
                      <span className="text-[11px] text-muted">+{variants.length - 4}</span>
                    ) : null}
                  </div>
                ) : null}
                {product.customization_enabled ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#edf7f3] px-2 py-1 text-[11px] font-semibold text-[#2f6f66]">
                    <PortalIcon name="sparkle" className="h-3 w-3" /> Custom sizing
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
          <p className="text-sm font-semibold text-[#263530]">Catalog inventory</p>
          <p className="mt-1 text-xs text-[#7b8882]">
            {products.length} product{products.length === 1 ? "" : "s"} in this view
          </p>
        </div>
        <p className="text-xs text-[#7b8882]">Select products above to make bulk changes.</p>
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
              const variants = [...(product.product_variants ?? [])].sort(
                (a, b) => a.sort_order - b.sort_order,
              );
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
                          <span className="text-[10px] text-[#7b8882]">No photo</span>
                        )}
                      </button>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#34423d]">
                          {product.title}
                        </span>
                        <span className="mt-1 block max-w-72 truncate text-xs text-[#7b8882]">
                          {variants.length
                            ? variants
                                .map((variant) => `${variant.color_name} (${variant.stock})`)
                                .join(" / ")
                            : "No colour variants"}
                        </span>
                        <span className="mt-1 block max-w-72 truncate text-xs text-[#7b8882]">
                          Category: {product.categories?.name ?? "Needs category"}
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
