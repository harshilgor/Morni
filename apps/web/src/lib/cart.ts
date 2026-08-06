"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export type CartItem = {
  lineId?: string;
  productId: string;
  variantId?: string;
  storeId: string;
  storeName: string;
  title: string;
  priceAed: number;
  imageUrl?: string;
  size?: string;
  colorName?: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (
    product: Product,
    storeName: string,
    qty?: number,
    options?: {
      size?: string;
      variantId?: string;
      colorName?: string;
      imageUrl?: string;
    },
  ) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  clearStore: (storeId: string) => void;
  subtotal: () => number;
  count: () => number;
};

export function cartLineId(
  productId: string,
  size?: string,
  variantId?: string,
) {
  return `${productId}:${variantId || "default"}:${size || "one-size"}`;
}

function itemLineId(item: CartItem) {
  return item.lineId ?? cartLineId(item.productId, item.size, item.variantId);
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, storeName, qty = 1, options) => {
        const existing = get().items;
        const lineId = cartLineId(
          product.id,
          options?.size,
          options?.variantId,
        );
        const imageUrl =
          options?.imageUrl ?? product.image_urls?.[0] ?? undefined;
        const otherStore = existing.find((i) => i.storeId !== product.store_id);
        if (otherStore) {
          set({
            items: [
              {
                lineId,
                productId: product.id,
                variantId: options?.variantId,
                storeId: product.store_id,
                storeName,
                title: product.title,
                priceAed: Number(product.price_aed),
                imageUrl,
                size: options?.size,
                colorName: options?.colorName,
                quantity: qty,
              },
            ],
          });
          return;
        }
        const found = existing.find((i) => itemLineId(i) === lineId);
        if (found) {
          set({
            items: existing.map((i) =>
              itemLineId(i) === lineId
                ? { ...i, quantity: i.quantity + qty }
                : i,
            ),
          });
        } else {
          set({
            items: [
              ...existing,
              {
                lineId,
                productId: product.id,
                variantId: options?.variantId,
                storeId: product.store_id,
                storeName,
                title: product.title,
                priceAed: Number(product.price_aed),
                imageUrl,
                size: options?.size,
                colorName: options?.colorName,
                quantity: qty,
              },
            ],
          });
        }
      },
      removeItem: (lineId) =>
        set({ items: get().items.filter((i) => itemLineId(i) !== lineId) }),
      setQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(lineId);
          return;
        }
        set({
          items: get().items.map((i) =>
            itemLineId(i) === lineId ? { ...i, quantity } : i,
          ),
        });
      },
      clear: () => set({ items: [] }),
      clearStore: (storeId) =>
        set({ items: get().items.filter((i) => i.storeId !== storeId) }),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.priceAed * i.quantity, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "morni-cart" },
  ),
);
