"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
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
  setItemQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
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
      setItemQuantity: (itemId, quantity) =>
        set((state) => {
          const existing = state.itemsByItemId[itemId];
          if (!existing) {
            return state;
          }

          if (quantity <= 0) {
            const nextItems = { ...state.itemsByItemId };
            delete nextItems[itemId];
            return { itemsByItemId: nextItems };
          }

          return {
            itemsByItemId: {
              ...state.itemsByItemId,
              [itemId]: {
                ...existing,
                quantity,
              },
            },
          };
        }),
      removeItem: (itemId) =>
        set((state) => {
          const nextItems = { ...state.itemsByItemId };
          delete nextItems[itemId];
          return { itemsByItemId: nextItems };
        }),
    }),
    {
      name: "smartmenu-cart",
    },
  ),
);
