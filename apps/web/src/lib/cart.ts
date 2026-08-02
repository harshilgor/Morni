"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export type CartItem = {
  productId: string;
  storeId: string;
  storeName: string;
  title: string;
  priceAed: number;
  imageUrl?: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (product: Product, storeName: string, qty?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  clearStore: (storeId: string) => void;
  subtotal: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, storeName, qty = 1) => {
        const existing = get().items;
        const otherStore = existing.find((i) => i.storeId !== product.store_id);
        if (otherStore) {
          // One store per cart for 1-hour delivery routing
          set({
            items: [
              {
                productId: product.id,
                storeId: product.store_id,
                storeName,
                title: product.title,
                priceAed: Number(product.price_aed),
                imageUrl: product.image_urls?.[0],
                quantity: qty,
              },
            ],
          });
          return;
        }
        const found = existing.find((i) => i.productId === product.id);
        if (found) {
          set({
            items: existing.map((i) =>
              i.productId === product.id
                ? { ...i, quantity: i.quantity + qty }
                : i,
            ),
          });
        } else {
          set({
            items: [
              ...existing,
              {
                productId: product.id,
                storeId: product.store_id,
                storeName,
                title: product.title,
                priceAed: Number(product.price_aed),
                imageUrl: product.image_urls?.[0],
                quantity: qty,
              },
            ],
          });
        }
      },
      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      setQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i,
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
