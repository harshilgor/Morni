"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export type CartItem = {
  lineId?: string;
  productId: string;
  storeId: string;
  storeName: string;
  title: string;
  priceAed: number;
  imageUrl?: string;
  size?: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (
    product: Product,
    storeName: string,
    qty?: number,
    size?: string,
  ) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  clearStore: (storeId: string) => void;
  subtotal: () => number;
  count: () => number;
};

export function cartLineId(productId: string, size?: string) {
  return `${productId}:${size || "one-size"}`;
}

function itemLineId(item: CartItem) {
  return item.lineId ?? cartLineId(item.productId, item.size);
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, storeName, qty = 1, size) => {
        const existing = get().items;
        const lineId = cartLineId(product.id, size);
        const otherStore = existing.find((i) => i.storeId !== product.store_id);
        if (otherStore) {
          // One store per cart for 1-hour delivery routing
          set({
            items: [
              {
                lineId,
                productId: product.id,
                storeId: product.store_id,
                storeName,
                title: product.title,
                priceAed: Number(product.price_aed),
                imageUrl: product.image_urls?.[0],
                size,
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
                storeId: product.store_id,
                storeName,
                title: product.title,
                priceAed: Number(product.price_aed),
                imageUrl: product.image_urls?.[0],
                size,
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
