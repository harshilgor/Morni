"use client";

/* Product thumbnails may originate from seller-controlled Supabase storage URLs. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { ColorVariantEditor } from "@/components/color-variant-editor";
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
import type { Product, ProductVariant } from "@/lib/types";

type ProductWithVariants = Product & {
  product_variants?: ProductVariant[] | null;
};

type ProductDraft = {
  title: string;
  price_aed: string;
};

type CreateStep = 1 | 2;

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
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price_aed: "",
  });
  const [createColors, setCreateColors] = useState<ColorDraft[]>([
    createColorDraft({ color_name: "Default" }),
  ]);
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [saving, setSaving] = useState(false);
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
      .select("*, product_variants(*)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setProducts((data as ProductWithVariants[]) ?? []);
  }

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

  function openEdit(product: ProductWithVariants) {
    setEditingProductId(product.id);
    setEditDraft({
      title: product.title,
      price_aed: String(product.price_aed),
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
    const colorError = validateColorDrafts(createColors);
    if (colorError) {
      setMessage(colorError);
      setCreateStep(2);
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const aggregate = aggregateFromColorDrafts(createColors);

    const { data: created, error: insertError } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        title: form.title,
        description: form.description || null,
        price_aed: Number(form.price_aed),
        stock: aggregate.stock,
        sizes: aggregate.sizes,
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
        drafts: createColors,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save colors.");
      setSaving(false);
      return;
    }

    setForm({ title: "", description: "", price_aed: "" });
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
    const colorError = validateColorDrafts(editColors);
    if (colorError) {
      setEditMessage(colorError);
      return;
    }

    setSavingEdits(true);
    setEditMessage(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("products")
      .update({
        title: editDraft.title.trim(),
        price_aed: price,
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
        drafts: editColors,
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
          subtitle={createStep === 1 ? "Step 1 of 2 · Details" : "Step 2 of 2 · Photos & options"}
          onClose={closeCreate}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (createStep === 1) {
                if (!form.title.trim() || !form.price_aed.trim()) {
                  setMessage("Add a title and price to continue.");
                  return;
                }
                setMessage(null);
                setCreateStep(2);
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
              <div className="space-y-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Title</span>
                  <input
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="Product name"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    autoFocus
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Price (AED)</span>
                  <input
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_aed}
                    onChange={(e) => setForm((f) => ({ ...f, price_aed: e.target.value }))}
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-[#40534d]">Description</span>
                  <textarea
                    className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm"
                    placeholder="Optional details for shoppers"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
              </div>
            ) : (
              <ColorVariantEditor
                value={createColors}
                onChange={setCreateColors}
                disabled={saving}
              />
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
                  disabled={saving}
                  className="portal-button-primary flex-[1.4] disabled:opacity-50"
                >
                  {createStep === 1 ? "Continue" : saving ? "Saving…" : "Save product"}
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
              <ColorVariantEditor
                compact
                value={editColors}
                onChange={setEditColors}
                disabled={savingEdits}
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
