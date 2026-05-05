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

export type CartBucket = {
  itemsByItemId: Record<string, CartItem>;
  totalItems: number;
  totalPrice: number;
};

type CartStore = {
  cartsByRestaurant: Record<string, CartBucket>;
  /** True if this menu item id is in the cart with a positive quantity. */
  hasItemInCart: (restaurantSlug: string, itemId: string) => boolean;
  addSelection: (payload: {
    restaurantSlug: string;
    itemId: string;
    quantity: number;
    name: string;
    translations?: TranslationsMap;
    displayUnitPrice: number;
  }) => void;
  setItemQuantity: (restaurantSlug: string, itemId: string, quantity: number) => void;
  removeItem: (restaurantSlug: string, itemId: string) => void;
  clearCart: (restaurantSlug: string) => void;
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

function makeCartBucket(itemsByItemId: Record<string, CartItem>): CartBucket {
  const totals = computeCartTotals(itemsByItemId);
  return {
    itemsByItemId,
    totalItems: totals.totalItems,
    totalPrice: totals.totalPrice,
  };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cartsByRestaurant: {},
      hasItemInCart: (restaurantSlug, itemId) => {
        const bucket = get().cartsByRestaurant[restaurantSlug];
        const row = bucket?.itemsByItemId[itemId];
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
          const baseItems =
            state.cartsByRestaurant[restaurantSlug]?.itemsByItemId ?? {};
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
          const nextBucket = makeCartBucket(nextItemsByItemId);

          return {
            cartsByRestaurant: {
              ...state.cartsByRestaurant,
              [restaurantSlug]: nextBucket,
            },
          };
        }),
      setItemQuantity: (restaurantSlug, itemId, quantity) =>
        set((state) => {
          const bucket = state.cartsByRestaurant[restaurantSlug];
          if (!bucket) {
            return state;
          }

          const existing = bucket.itemsByItemId[itemId];
          if (!existing) {
            return state;
          }

          if (quantity <= 0) {
            const nextItems = { ...bucket.itemsByItemId };
            delete nextItems[itemId];
            const nextCarts = { ...state.cartsByRestaurant };
            if (Object.keys(nextItems).length === 0) {
              delete nextCarts[restaurantSlug];
              return { cartsByRestaurant: nextCarts };
            }

            return {
              cartsByRestaurant: {
                ...nextCarts,
                [restaurantSlug]: makeCartBucket(nextItems),
              },
            };
          }

          const nextItemsByItemId = {
            ...bucket.itemsByItemId,
            [itemId]: {
              ...existing,
              quantity,
            },
          };

          return {
            cartsByRestaurant: {
              ...state.cartsByRestaurant,
              [restaurantSlug]: makeCartBucket(nextItemsByItemId),
            },
          };
        }),
      removeItem: (restaurantSlug, itemId) =>
        set((state) => {
          const bucket = state.cartsByRestaurant[restaurantSlug];
          if (!bucket) {
            return state;
          }

          const nextItems = { ...bucket.itemsByItemId };
          delete nextItems[itemId];
          const nextCarts = { ...state.cartsByRestaurant };
          if (Object.keys(nextItems).length === 0) {
            delete nextCarts[restaurantSlug];
            return { cartsByRestaurant: nextCarts };
          }

          return {
            cartsByRestaurant: {
              ...nextCarts,
              [restaurantSlug]: makeCartBucket(nextItems),
            },
          };
        }),
      clearCart: (restaurantSlug) =>
        set((state) => {
          const nextCarts = { ...state.cartsByRestaurant };
          delete nextCarts[restaurantSlug];
          return { cartsByRestaurant: nextCarts };
        }),
    }),
    {
      name: "smartmenu-cart",
      version: 4,
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as Partial<
          CartStore & {
            restaurantSlug?: string | null;
            itemsByItemId?: Record<string, CartItem>;
          }
        >;

        if (state.cartsByRestaurant && typeof state.cartsByRestaurant === "object") {
          return {
            cartsByRestaurant: Object.entries(state.cartsByRestaurant).reduce(
              (acc, [slug, bucket]) => {
                const items = bucket?.itemsByItemId ?? {};
                if (slug && Object.keys(items).length > 0) {
                  acc[slug] = makeCartBucket(items);
                }
                return acc;
              },
              {} as Record<string, CartBucket>,
            ),
          } as Pick<CartStore, "cartsByRestaurant">;
        }

        const legacySlug = state.restaurantSlug ?? null;
        const legacyItems = state.itemsByItemId ?? {};
        const cartsByRestaurant: Record<string, CartBucket> = {};
        if (legacySlug && Object.keys(legacyItems).length > 0) {
          cartsByRestaurant[legacySlug] = makeCartBucket(legacyItems);
        }
        return {
          cartsByRestaurant,
        } as Pick<CartStore, "cartsByRestaurant">;
      },
    },
  ),
);
