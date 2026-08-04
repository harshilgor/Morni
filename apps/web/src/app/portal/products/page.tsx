"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { formatAed } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function PortalProductsPage() {
  const { store, loading, error } = useOwnerStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price_aed: "",
    stock: "10",
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
      is_available: true,
      image_urls: imageUrls,
    });

    setSaving(false);
    if (insertError) {
      setMessage(insertError.message);
      return;
    }

    setForm({ title: "", description: "", price_aed: "", stock: "10" });
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
      <div>
        <h1 className="font-display text-3xl text-ink">Products</h1>
        <p className="mt-1 text-sm text-muted">Manage catalog for {store.name}</p>
      </div>

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
            <div className="h-16 w-14 overflow-hidden rounded-lg bg-sand">
              {product.image_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_urls[0]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-[140px] flex-1">
              <p className="font-medium">{product.title}</p>
              <p className="text-sm text-muted">{formatAed(product.price_aed)}</p>
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
