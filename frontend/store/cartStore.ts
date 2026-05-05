"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TranslationsMap } from "../types/menu";

export type CartItem = {
  itemId: string;
  name: string;
  translations?: TranslationsMap;
  displayUnitPrice: number;
  quantity: number;
};

type CartStore = {
  restaurantSlug: string | null;
  itemsByItemId: Record<string, CartItem>;
  totalItems: number;
  totalPrice: number;
  /** True if this menu item id is in the cart with a positive quantity. */
  hasItemInCart: (itemId: string) => boolean;
  addSelection: (payload: {
    restaurantSlug: string;
    itemId: string;
    quantity: number;
    name: string;
    translations?: TranslationsMap;
    displayUnitPrice: number;
  }) => void;
  setItemQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
};

function computeCartTotals(itemsByItemId: Record<string, CartItem>) {
  return Object.values(itemsByItemId).reduce(
    (acc, item) => {
      acc.totalItems += item.quantity;
      acc.totalPrice += item.displayUnitPrice * item.quantity;
      return acc;
    },
    { totalItems: 0, totalPrice: 0 },
  );
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      restaurantSlug: null,
      itemsByItemId: {},
      totalItems: 0,
      totalPrice: 0,
      hasItemInCart: (itemId) => {
        const row = get().itemsByItemId[itemId];
        return Boolean(row && row.quantity > 0);
      },
      addSelection: ({
        restaurantSlug,
        itemId,
        quantity,
        name,
        translations,
        displayUnitPrice,
      }) =>
        set((state) => {
          const isCrossRestaurant =
            state.restaurantSlug !== null && state.restaurantSlug !== restaurantSlug;
          const baseItems = isCrossRestaurant ? {} : state.itemsByItemId;
          const existing = baseItems[itemId];
          const nextQuantity = (existing?.quantity ?? 0) + quantity;
          const nextItemsByItemId = {
            ...baseItems,
            [itemId]: {
              itemId,
              name,
              translations,
              displayUnitPrice,
              quantity: nextQuantity,
            },
          };
          const totals = computeCartTotals(nextItemsByItemId);

          return {
            restaurantSlug,
            itemsByItemId: nextItemsByItemId,
            totalItems: totals.totalItems,
            totalPrice: totals.totalPrice,
          };
        }),
      setItemQuantity: (itemId, quantity) =>
        set((state) => {
          const existing = state.itemsByItemId[itemId];
          if (!existing) {
            return state;
          }

          if (quantity <= 0) {
            const nextItems = { ...state.itemsByItemId };
            delete nextItems[itemId];
            const totals = computeCartTotals(nextItems);
            return {
              restaurantSlug: Object.keys(nextItems).length ? state.restaurantSlug : null,
              itemsByItemId: nextItems,
              totalItems: totals.totalItems,
              totalPrice: totals.totalPrice,
            };
          }

          const nextItemsByItemId = {
            ...state.itemsByItemId,
            [itemId]: {
              ...existing,
              quantity,
            },
          };
          const totals = computeCartTotals(nextItemsByItemId);

          return {
            itemsByItemId: nextItemsByItemId,
            totalItems: totals.totalItems,
            totalPrice: totals.totalPrice,
          };
        }),
      removeItem: (itemId) =>
        set((state) => {
          const nextItems = { ...state.itemsByItemId };
          delete nextItems[itemId];
          const totals = computeCartTotals(nextItems);
          return {
            restaurantSlug: Object.keys(nextItems).length ? state.restaurantSlug : null,
            itemsByItemId: nextItems,
            totalItems: totals.totalItems,
            totalPrice: totals.totalPrice,
          };
        }),
      clearCart: () =>
        set(() => ({
          restaurantSlug: null,
          itemsByItemId: {},
          totalItems: 0,
          totalPrice: 0,
        })),
    }),
    {
      name: "smartmenu-cart",
      version: 3,
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as Partial<CartStore>;
        const itemsByItemId = state.itemsByItemId ?? {};
        const totals = computeCartTotals(itemsByItemId);

        return {
          ...state,
          restaurantSlug: state.restaurantSlug ?? null,
          itemsByItemId,
          totalItems: totals.totalItems,
          totalPrice: totals.totalPrice,
        } as CartStore;
      },
    },
  ),
);
