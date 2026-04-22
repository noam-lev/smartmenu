"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type CartItem = {
  itemId: string;
  name: string;
  displayUnitPrice: number;
  quantity: number;
};

type CartStore = {
  itemsByItemId: Record<string, CartItem>;
  addSelection: (payload: {
    itemId: string;
    quantity: number;
    name: string;
    displayUnitPrice: number;
  }) => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      itemsByItemId: {},
      addSelection: ({ itemId, quantity, name, displayUnitPrice }) =>
        set((state) => {
          const existing = state.itemsByItemId[itemId];
          const nextQuantity = (existing?.quantity ?? 0) + quantity;

          return {
            itemsByItemId: {
              ...state.itemsByItemId,
              [itemId]: {
                itemId,
                name,
                displayUnitPrice,
                quantity: nextQuantity,
              },
            },
          };
        }),
      totalItems: () =>
        Object.values(get().itemsByItemId).reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
      totalPrice: () =>
        Object.values(get().itemsByItemId).reduce(
          (sum, item) => sum + item.displayUnitPrice * item.quantity,
          0,
        ),
    }),
    {
      name: "smartmenu-cart",
    },
  ),
);
