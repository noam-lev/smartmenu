"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TranslationsMap } from "../types/menu";

/** Cart expires after 90 minutes with no cart mutations. */
export const CART_IDLE_TTL_MS = 90 * 60 * 1000;

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
  lastActivityAt: string;
  menuLastUpdatedAt: string | null;
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
  /**
   * Silently drops the cart when idle TTL expired or the live menu is newer than
   * the stored baseline. Adopts `menuLastUpdatedAt` when missing on a non-empty cart.
   */
  syncCartLifecycle: (
    restaurantSlug: string,
    liveMenuLastUpdated: string | null | undefined,
  ) => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isCartIdleExpired(
  bucket: Pick<CartBucket, "lastActivityAt">,
  atMs: number = Date.now(),
): boolean {
  const lastMs = parseTimestampMs(bucket.lastActivityAt);
  if (lastMs === null) {
    return true;
  }
  return atMs - lastMs >= CART_IDLE_TTL_MS;
}

export function isMenuNewerThanCart(
  liveMenuLastUpdated: string,
  cartMenuLastUpdatedAt: string | null,
): boolean {
  if (!cartMenuLastUpdatedAt) {
    return false;
  }
  const liveMs = parseTimestampMs(liveMenuLastUpdated);
  const cartMs = parseTimestampMs(cartMenuLastUpdatedAt);
  if (liveMs === null || cartMs === null) {
    return false;
  }
  return liveMs > cartMs;
}

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

function makeCartBucket(
  itemsByItemId: Record<string, CartItem>,
  meta: { lastActivityAt: string; menuLastUpdatedAt: string | null },
): CartBucket {
  const totals = computeCartTotals(itemsByItemId);
  return {
    itemsByItemId,
    totalItems: totals.totalItems,
    totalPrice: totals.totalPrice,
    lastActivityAt: meta.lastActivityAt,
    menuLastUpdatedAt: meta.menuLastUpdatedAt,
  };
}

function bucketHasItems(bucket: CartBucket | undefined): bucket is CartBucket {
  return Boolean(bucket && Object.keys(bucket.itemsByItemId).length > 0);
}

function touchBucketMeta(
  existing: CartBucket | undefined,
  menuLastUpdatedAt?: string | null,
): { lastActivityAt: string; menuLastUpdatedAt: string | null } {
  return {
    lastActivityAt: nowIso(),
    menuLastUpdatedAt:
      menuLastUpdatedAt !== undefined
        ? menuLastUpdatedAt
        : (existing?.menuLastUpdatedAt ?? null),
  };
}

function migratePersistedBuckets(
  persistedState: unknown,
): Pick<CartStore, "cartsByRestaurant"> {
  const state = (persistedState ?? {}) as Partial<
    CartStore & {
      restaurantSlug?: string | null;
      itemsByItemId?: Record<string, CartItem>;
    }
  >;

  const adoptedAt = nowIso();
  const normalizeBucket = (
    slug: string,
    raw: Partial<CartBucket> & { itemsByItemId?: Record<string, CartItem> },
  ): CartBucket | null => {
    const items = raw.itemsByItemId ?? {};
    if (!slug || Object.keys(items).length === 0) {
      return null;
    }
    return makeCartBucket(items, {
      lastActivityAt: raw.lastActivityAt ?? adoptedAt,
      menuLastUpdatedAt: raw.menuLastUpdatedAt ?? null,
    });
  };

  if (state.cartsByRestaurant && typeof state.cartsByRestaurant === "object") {
    const cartsByRestaurant = Object.entries(state.cartsByRestaurant).reduce(
      (acc, [slug, bucket]) => {
        const normalized = normalizeBucket(slug, bucket ?? {});
        if (normalized) {
          acc[slug] = normalized;
        }
        return acc;
      },
      {} as Record<string, CartBucket>,
    );
    return { cartsByRestaurant };
  }

  const legacySlug = state.restaurantSlug ?? null;
  const legacyItems = state.itemsByItemId ?? {};
  const cartsByRestaurant: Record<string, CartBucket> = {};
  if (legacySlug && Object.keys(legacyItems).length > 0) {
    cartsByRestaurant[legacySlug] = makeCartBucket(legacyItems, {
      lastActivityAt: adoptedAt,
      menuLastUpdatedAt: null,
    });
  }
  return { cartsByRestaurant };
}

function purgeIdleExpiredCarts(
  cartsByRestaurant: Record<string, CartBucket>,
  atMs: number = Date.now(),
): Record<string, CartBucket> {
  let changed = false;
  const nextCarts: Record<string, CartBucket> = {};

  for (const [slug, bucket] of Object.entries(cartsByRestaurant)) {
    if (!bucketHasItems(bucket)) {
      changed = true;
      continue;
    }
    if (isCartIdleExpired(bucket, atMs)) {
      changed = true;
      continue;
    }
    nextCarts[slug] = bucket;
  }

  return changed ? nextCarts : cartsByRestaurant;
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
          const existingBucket = state.cartsByRestaurant[restaurantSlug];
          const baseItems = existingBucket?.itemsByItemId ?? {};
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
          const nextBucket = makeCartBucket(
            nextItemsByItemId,
            touchBucketMeta(existingBucket),
          );

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

          const meta = touchBucketMeta(bucket);

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
                [restaurantSlug]: makeCartBucket(nextItems, meta),
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
              [restaurantSlug]: makeCartBucket(nextItemsByItemId, meta),
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
              [restaurantSlug]: makeCartBucket(nextItems, touchBucketMeta(bucket)),
            },
          };
        }),
      clearCart: (restaurantSlug) =>
        set((state) => {
          const nextCarts = { ...state.cartsByRestaurant };
          delete nextCarts[restaurantSlug];
          return { cartsByRestaurant: nextCarts };
        }),
      syncCartLifecycle: (restaurantSlug, liveMenuLastUpdated) => {
        const bucket = get().cartsByRestaurant[restaurantSlug];
        if (!bucketHasItems(bucket)) {
          return;
        }

        if (isCartIdleExpired(bucket)) {
          get().clearCart(restaurantSlug);
          return;
        }

        if (liveMenuLastUpdated) {
          if (
            bucket.menuLastUpdatedAt &&
            isMenuNewerThanCart(liveMenuLastUpdated, bucket.menuLastUpdatedAt)
          ) {
            get().clearCart(restaurantSlug);
            return;
          }

          if (!bucket.menuLastUpdatedAt) {
            set((state) => {
              const current = state.cartsByRestaurant[restaurantSlug];
              if (!bucketHasItems(current)) {
                return state;
              }
              return {
                cartsByRestaurant: {
                  ...state.cartsByRestaurant,
                  [restaurantSlug]: {
                    ...current,
                    menuLastUpdatedAt: liveMenuLastUpdated,
                  },
                },
              };
            });
          }
        }
      },
    }),
    {
      name: "smartmenu-cart",
      version: 5,
      migrate: (persistedState) => migratePersistedBuckets(persistedState),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          return;
        }
        const purged = purgeIdleExpiredCarts(state.cartsByRestaurant);
        if (purged !== state.cartsByRestaurant) {
          useCartStore.setState({ cartsByRestaurant: purged });
        }
      },
    },
  ),
);
