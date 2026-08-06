"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ColorVariantEditor } from "@/components/color-variant-editor";
import {
  ImagePreviewDialog,
  type PreviewImage,
} from "@/components/image-preview-dialog";
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
import type { Product, ProductVariant } from "@/lib/types";

type ProductWithVariants = Product & {
  product_variants?: ProductVariant[] | null;
};

type ProductDraft = {
  title: string;
  price_aed: string;
};

function draftsFromVariants(
  product: ProductWithVariants,
): ColorDraft[] {
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
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "price_desc" | "price_asc" | "stock_asc">(
    "newest",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStock, setBulkStock] = useState("");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [colorDrafts, setColorDrafts] = useState<Record<string, ColorDraft[]>>({});
  const [savingEdits, setSavingEdits] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    title: string;
  } | null>(null);

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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    const colorError = validateColorDrafts(createColors);
    if (colorError) {
      setMessage(colorError);
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
    await loadProducts(store.id);
  }

  async function toggleAvailable(product: Product) {
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ is_available: !product.is_available })
      .eq("id", product.id);
    if (store) await loadProducts(store.id);
  }

  async function removeProduct(product: Product) {
    const supabase = createClient();
    await supabase.from("products").delete().eq("id", product.id);
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
    await supabase
      .from("products")
      .update({ is_available: isAvailable })
      .in("id", selectedIds);
    setSelectedIds([]);
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
      } else {
        await supabase.from("products").update({ stock }).eq("id", productId);
      }
    }

    setSelectedIds([]);
    setBulkStock("");
    await loadProducts(store.id);
  }

  function startEditing() {
    setDrafts(
      Object.fromEntries(
        products.map((product) => [
          product.id,
          {
            title: product.title,
            price_aed: String(product.price_aed),
          },
        ]),
      ),
    );
    setColorDrafts(
      Object.fromEntries(
        products.map((product) => [product.id, draftsFromVariants(product)]),
      ),
    );
    setEditMessage(null);
    setEditing(true);
  }

  function cancelEditing() {
    setDrafts({});
    setColorDrafts({});
    setEditMessage(null);
    setEditing(false);
  }

  function updateDraft(
    product: Product,
    field: keyof ProductDraft,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [product.id]: {
        ...(current[product.id] ?? {
          title: product.title,
          price_aed: String(product.price_aed),
        }),
        [field]: value,
      },
    }));
  }

  function colorsChanged(product: ProductWithVariants) {
    const next = colorDrafts[product.id];
    if (!next) return false;
    const current = draftsFromVariants(product);
    if (next.length !== current.length) return true;
    return JSON.stringify(
      next.map((draft) => ({
        id: draft.id ?? null,
        color_name: draft.color_name.trim(),
        color_hex: draft.color_hex,
        sizes: draft.sizes,
        stock: Number(draft.stock) || 0,
        imageCount: draft.images.length,
        hasNewFiles: draft.images.some((image) => Boolean(image.file)),
        urls: draft.images.map((image) => image.url),
      })),
    ) !==
      JSON.stringify(
        current.map((draft) => ({
          id: draft.id ?? null,
          color_name: draft.color_name.trim(),
          color_hex: draft.color_hex,
          sizes: draft.sizes,
          stock: Number(draft.stock) || 0,
          imageCount: draft.images.length,
          hasNewFiles: false,
          urls: draft.images.map((image) => image.url),
        })),
      );
  }

  function isProductChanged(product: ProductWithVariants) {
    const draft = drafts[product.id];
    return Boolean(
      colorsChanged(product) ||
        (draft &&
          (draft.title.trim() !== product.title ||
            Number(draft.price_aed) !== Number(product.price_aed))),
    );
  }

  async function saveEdits() {
    if (!store) return;

    const changedProducts = products.filter(isProductChanged);
    if (changedProducts.length === 0) {
      cancelEditing();
      return;
    }

    for (const product of changedProducts) {
      const draft = drafts[product.id];
      const colors = colorDrafts[product.id] ?? [];
      const price = Number(draft?.price_aed);
      if (!draft?.title.trim()) {
        setEditMessage("Every product needs a name.");
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setEditMessage(`Enter a valid price for ${draft.title.trim()}.`);
        return;
      }
      const colorError = validateColorDrafts(colors);
      if (colorError) {
        setEditMessage(`${product.title}: ${colorError}`);
        return;
      }
    }

    setSavingEdits(true);
    setEditMessage(null);
    const supabase = createClient();

    for (const product of changedProducts) {
      const draft = drafts[product.id];
      const colors = colorDrafts[product.id] ?? [];

      const { error: updateError } = await supabase
        .from("products")
        .update({
          title: draft.title.trim(),
          price_aed: Number(draft.price_aed),
        })
        .eq("id", product.id)
        .eq("store_id", store.id);

      if (updateError) {
        setEditMessage(`Could not update ${product.title}: ${updateError.message}`);
        setSavingEdits(false);
        return;
      }

      try {
        await replaceProductVariants({
          storeId: store.id,
          productId: product.id,
          drafts: colors,
        });
      } catch (err) {
        setEditMessage(
          `Could not update colors for ${product.title}: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
        setSavingEdits(false);
        return;
      }
    }

    await loadProducts(store.id);
    setDrafts({});
    setColorDrafts({});
    setSavingEdits(false);
    setEditing(false);
    setMessage(
      `${changedProducts.length} product${changedProducts.length === 1 ? "" : "s"} updated.`,
    );
  }

  if (error === "unauthenticated") {
    return (
      <Link href="/auth?next=/portal/products" className="text-accent-deep underline">
        Sign in
      </Link>
    );
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!store) {
    return (
      <p className="text-muted">
        Set up a store on the{" "}
        <Link href="/portal" className="text-accent-deep underline">
          Orders
        </Link>{" "}
        page first.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Products</h1>
          <p className="mt-1 text-sm text-muted">Manage catalog for {store.name}</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={savingEdits}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/30 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdits}
              disabled={savingEdits}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-50"
            >
              {savingEdits ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            disabled={products.length === 0}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Edit products
          </button>
        )}
      </div>

      {editing ? (
        <div className="rounded-2xl border border-accent/30 bg-[#fff0f4] px-4 py-3 text-sm text-ink">
          Editing is on. Update names, prices, and color options (photos, sizes,
          stock) on this page, then save once.
        </div>
      ) : null}

      {editMessage ? (
        <p role="alert" className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
          {editMessage}
        </p>
      ) : null}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
            placeholder="Search title, description, or color"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="newest">Sort: Newest</option>
            <option value="price_desc">Sort: Price high to low</option>
            <option value="price_asc">Sort: Price low to high</option>
            <option value="stock_asc">Sort: Stock low to high</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
            />
            Low stock only (≤5)
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2.5 text-sm">
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

      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-[1.5rem] border border-line bg-surface p-5 sm:grid-cols-2"
      >
        <h2 className="font-medium sm:col-span-2">Add product</h2>
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="Price AED"
          type="number"
          min="0"
          step="0.01"
          value={form.price_aed}
          onChange={(e) => setForm((f) => ({ ...f, price_aed: e.target.value }))}
          required
        />
        <textarea
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm sm:col-span-2"
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <ColorVariantEditor
            value={createColors}
            onChange={setCreateColors}
            disabled={saving}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-5 py-2.5 text-sm text-white sm:col-span-2 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add product"}
        </button>
        {message ? (
          <p className="text-sm text-accent-deep sm:col-span-2">{message}</p>
        ) : null}
      </form>

      <ul className="space-y-3">
        {visibleProducts.map((product) => {
          const variants = [...(product.product_variants ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          return (
            <li
              key={product.id}
              className="rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start gap-4">
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleSelected(product.id)}
                  aria-label={`Select ${product.title}`}
                />
                {product.image_urls?.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPreview({
                        images: product.image_urls.map((url, imageIndex) => ({
                          url,
                          label: `${product.title} · photo ${imageIndex + 1}`,
                        })),
                        title: product.title,
                      })
                    }
                    title={`Preview photos for ${product.title}`}
                    className="group relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-sand"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image_urls[0]}
                      alt={product.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-0.5 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                      {product.image_urls.length} photo
                      {product.image_urls.length === 1 ? "" : "s"}
                    </span>
                  </button>
                ) : (
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-sand" />
                )}
                <div className="min-w-[180px] flex-1 space-y-2">
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={drafts[product.id]?.title ?? product.title}
                        onChange={(event) =>
                          updateDraft(product, "title", event.target.value)
                        }
                        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm font-medium text-ink outline-none focus:border-accent"
                        aria-label={`Name for ${product.title}`}
                      />
                      <label className="flex max-w-44 items-center rounded-lg border border-line bg-background px-3 py-2 text-sm focus-within:border-accent">
                        <span className="mr-2 text-xs font-medium text-muted">AED</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            drafts[product.id]?.price_aed ??
                            String(product.price_aed)
                          }
                          onChange={(event) =>
                            updateDraft(product, "price_aed", event.target.value)
                          }
                          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                          aria-label={`Price for ${product.title}`}
                        />
                      </label>
                      {isProductChanged(product) ? (
                        <span className="inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-deep">
                          Changed
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted">
                        {formatAed(product.price_aed)} · {product.stock} in stock
                      </p>
                      {variants.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {variants.map((variant) => (
                            <span
                              key={variant.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-2.5 py-1 text-[11px] text-ink"
                            >
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-line"
                                style={{
                                  background: variant.color_hex ?? "#c45b7a",
                                }}
                              />
                              {variant.color_name}
                              <span className="text-muted">· {variant.stock}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          No color options yet — use Edit products to add them.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAvailable(product)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs"
                  >
                    {product.is_available ? "Available" : "Hidden"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProduct(product)}
                    className="text-xs text-accent-deep"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="mt-4 border-t border-line pt-4">
                  <ColorVariantEditor
                    compact
                    value={colorDrafts[product.id] ?? draftsFromVariants(product)}
                    onChange={(next) =>
                      setColorDrafts((current) => ({
                        ...current,
                        [product.id]: next,
                      }))
                    }
                    disabled={savingEdits}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

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
