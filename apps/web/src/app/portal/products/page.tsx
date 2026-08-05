"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed } from "@/lib/format";
import { PRODUCT_SIZES } from "@/lib/product-sizes";
import type { Product } from "@/lib/types";

type ProductDraft = {
  title: string;
  price_aed: string;
};

export default function PortalProductsPage() {
  const { store, loading, error } = useOwnerStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price_aed: "",
    stock: "10",
    sizes: ["S", "M", "L"] as string[],
  });
  const [file, setFile] = useState<File | null>(null);
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
  const [editFiles, setEditFiles] = useState<Record<string, File>>({});
  const [editPreviews, setEditPreviews] = useState<Record<string, string>>({});
  const [savingEdits, setSavingEdits] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  async function loadProducts(storeId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setProducts((data as Product[]) ?? []);
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
        (product.description ?? "").toLowerCase().includes(q)
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
    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    let imageUrls: string[] = [];
    if (file) {
      const path = `${store.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setMessage(uploadError.message);
        setSaving(false);
        return;
      }
      const { data: publicUrl } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      imageUrls = [publicUrl.publicUrl];
    }

    const { error: insertError } = await supabase.from("products").insert({
      store_id: store.id,
      title: form.title,
      description: form.description || null,
      price_aed: Number(form.price_aed),
      stock: Number(form.stock),
      sizes: form.sizes,
      is_available: true,
      image_urls: imageUrls,
    });

    setSaving(false);
    if (insertError) {
      setMessage(insertError.message);
      return;
    }

    setForm({
      title: "",
      description: "",
      price_aed: "",
      stock: "10",
      sizes: ["S", "M", "L"],
    });
    setFile(null);
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

  async function updateStock(product: Product, stock: number) {
    const supabase = createClient();
    await supabase.from("products").update({ stock }).eq("id", product.id);
    if (store) await loadProducts(store.id);
  }

  async function toggleProductSize(product: Product, size: string) {
    const current = product.sizes ?? [];
    const sizes = current.includes(size)
      ? current.filter((item) => item !== size)
      : PRODUCT_SIZES.filter(
          (item) => current.includes(item) || item === size,
        );
    const supabase = createClient();
    await supabase.from("products").update({ sizes }).eq("id", product.id);
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
    if (!selectedIds.length || !bulkStock.trim()) return;
    const stock = Number(bulkStock);
    if (Number.isNaN(stock) || stock < 0) return;
    const supabase = createClient();
    await supabase.from("products").update({ stock }).in("id", selectedIds);
    setSelectedIds([]);
    setBulkStock("");
    if (store) await loadProducts(store.id);
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
    setEditFiles({});
    setEditPreviews({});
    setEditMessage(null);
    setEditing(true);
  }

  function clearEditPreviews() {
    Object.values(editPreviews).forEach((url) => URL.revokeObjectURL(url));
  }

  function cancelEditing() {
    clearEditPreviews();
    setDrafts({});
    setEditFiles({});
    setEditPreviews({});
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

  function chooseEditImage(productId: string, nextFile: File | null) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setEditMessage("Please choose an image file.");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setEditMessage("Images must be smaller than 10 MB.");
      return;
    }

    setEditMessage(null);
    setEditFiles((current) => ({ ...current, [productId]: nextFile }));
    setEditPreviews((current) => {
      if (current[productId]) URL.revokeObjectURL(current[productId]);
      return { ...current, [productId]: URL.createObjectURL(nextFile) };
    });
  }

  function isProductChanged(product: Product) {
    const draft = drafts[product.id];
    return Boolean(
      editFiles[product.id] ||
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
      const price = Number(draft?.price_aed);
      if (!draft?.title.trim()) {
        setEditMessage("Every product needs a name.");
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setEditMessage(`Enter a valid price for ${draft.title.trim()}.`);
        return;
      }
    }

    setSavingEdits(true);
    setEditMessage(null);
    const supabase = createClient();

    for (const product of changedProducts) {
      const draft = drafts[product.id];
      const updates: {
        title: string;
        price_aed: number;
        image_urls?: string[];
      } = {
        title: draft.title.trim(),
        price_aed: Number(draft.price_aed),
      };
      const nextFile = editFiles[product.id];

      if (nextFile) {
        const safeName = nextFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${store.id}/${product.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, nextFile, { upsert: true });

        if (uploadError) {
          setEditMessage(`Could not update ${product.title}: ${uploadError.message}`);
          setSavingEdits(false);
          return;
        }

        const { data: publicUrl } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        updates.image_urls = [
          publicUrl.publicUrl,
          ...(product.image_urls ?? []).slice(1),
        ];
      }

      const { error: updateError } = await supabase
        .from("products")
        .update(updates)
        .eq("id", product.id)
        .eq("store_id", store.id);

      if (updateError) {
        setEditMessage(`Could not update ${product.title}: ${updateError.message}`);
        setSavingEdits(false);
        return;
      }
    }

    await loadProducts(store.id);
    clearEditPreviews();
    setDrafts({});
    setEditFiles({});
    setEditPreviews({});
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
          Editing is on. Click any product image to replace it, then edit its
          name or price directly. Save once when you are finished.
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
            placeholder="Search title or description"
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
        <input
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm"
          placeholder="Stock"
          type="number"
          min="0"
          value={form.stock}
          onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
          required
        />
        <input
          type="file"
          accept="image/*"
          className="rounded-xl border border-line bg-background px-3 py-2 text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <fieldset className="rounded-xl border border-line bg-background p-3 sm:col-span-2">
          <legend className="px-1 text-sm text-muted">Available sizes</legend>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_SIZES.map((size) => {
              const selected = form.sizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      sizes: selected
                        ? current.sizes.filter((item) => item !== size)
                        : [...current.sizes, size],
                    }))
                  }
                  className={`min-w-11 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-muted hover:border-ink/40"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Shoppers will select one of these before adding the item to cart.
          </p>
        </fieldset>
        <textarea
          className="rounded-xl border border-line bg-background px-3 py-2.5 text-sm sm:col-span-2"
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
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
        {visibleProducts.map((product) => (
          <li
            key={product.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(product.id)}
              onChange={() => toggleSelected(product.id)}
              aria-label={`Select ${product.title}`}
            />
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
              {editing ? (
                <input
                  id={`edit-image-${product.id}`}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    chooseEditImage(product.id, event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              ) : null}
              {editPreviews[product.id] || product.image_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editPreviews[product.id] ?? product.image_urls[0]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
              {editing ? (
                <label
                  htmlFor={`edit-image-${product.id}`}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/45 px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition hover:opacity-100 focus-within:opacity-100"
                  title={`Change image for ${product.title}`}
                >
                  Change image
                </label>
              ) : null}
            </div>
            <div className="min-w-[140px] flex-1">
              {editing ? (
                <div className="space-y-2">
                  <label className="block">
                    <span className="sr-only">Product name</span>
                    <input
                      type="text"
                      value={drafts[product.id]?.title ?? product.title}
                      onChange={(event) =>
                        updateDraft(product, "title", event.target.value)
                      }
                      className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                      aria-label={`Name for ${product.title}`}
                    />
                  </label>
                  <label className="flex max-w-44 items-center rounded-lg border border-line bg-background px-3 py-2 text-sm focus-within:border-accent">
                    <span className="mr-2 text-xs font-medium text-muted">AED</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[product.id]?.price_aed ?? String(product.price_aed)}
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
                  <p className="text-sm text-muted">{formatAed(product.price_aed)}</p>
                </>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {PRODUCT_SIZES.map((size) => {
                  const selected = (product.sizes ?? []).includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleProductSize(product, size)}
                      className={`rounded-md border px-2 py-1 text-[10px] transition ${
                        selected
                          ? "border-ink bg-ink text-white"
                          : "border-line text-muted hover:border-ink/40"
                      }`}
                      aria-pressed={selected}
                      aria-label={`${selected ? "Remove" : "Add"} size ${size} for ${product.title}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="text-xs text-muted">
              Stock
              <input
                type="number"
                className="ml-2 w-20 rounded-lg border border-line px-2 py-1"
                value={product.stock}
                onChange={(e) => updateStock(product, Number(e.target.value))}
              />
            </label>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
