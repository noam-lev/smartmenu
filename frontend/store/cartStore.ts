"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type CartItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type CartStore = {
  items: Record<string, CartItem>;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: {},
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items[item.id];
          const nextQuantity = (existing?.quantity ?? 0) + quantity;

          return {
            items: {
              ...state.items,
              [item.id]: {
                ...item,
                quantity: nextQuantity,
              },
            },
          };
        }),
      totalItems: () =>
        Object.values(get().items).reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: () =>
        Object.values(get().items).reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        ),
    }),
    {
      name: "smartmenu-cart",
    },
  ),
);
