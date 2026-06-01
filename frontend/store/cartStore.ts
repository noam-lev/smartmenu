"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TranslationsMap } from "../types/menu";
import {
  buildConfigKey,
  computeLineTotal,
  computeUnitPrice,
  type CartLine,
  type SelectedModifier,
} from "../lib/cart";

export type { CartLine, SelectedModifier } from "../lib/cart";

/** Cart expires after 90 minutes with no cart mutations. */
export const CART_IDLE_TTL_MS = 90 * 60 * 1000;

/** @deprecated Legacy shape; migrated to CartLine in persist v6. */
export type CartItem = {
  itemId: string;
  name: string;
  translations?: TranslationsMap;
  displayUnitPrice: number;
  quantity: number;
};

export type CartBucket = {
  lines: CartLine[];
  totalItems: number;
  totalPrice: number;
  lastActivityAt: string;
  menuLastUpdatedAt: string | null;
};

export type AddOrMergeLinePayload = {
  restaurantSlug: string;
  menuItemId: string;
  variantId: string;
  quantity: number;
  name: string;
  translations?: TranslationsMap;
  variantPrice: number;
  selections?: SelectedModifier[];
  addedBy?: string;
};

type CartStore = {
  cartsByRestaurant: Record<string, CartBucket>;
  hasLineWithMenuItemId: (restaurantSlug: string, menuItemId: string) => boolean;
  /** @deprecated Use hasLineWithMenuItemId. Kept for upsell gating. */
  hasItemInCart: (restaurantSlug: string, itemId: string) => boolean;
  addOrMergeLine: (payload: AddOrMergeLinePayload) => void;
  /** Compatibility: no modifiers; merges by item + default variant. */
  addSelection: (payload: {
    restaurantSlug: string;
    itemId: string;
    quantity: number;
    name: string;
    translations?: TranslationsMap;
    displayUnitPrice: number;
    variantId?: string;
  }) => void;
  setLineQuantity: (restaurantSlug: string, lineId: string, quantity: number) => void;
  /** Updates the sole no-modifier line for this menu item, if any. */
  setItemQuantity: (restaurantSlug: string, itemId: string, quantity: number) => void;
  removeLine: (restaurantSlug: string, lineId: string) => void;
  /** Removes all lines for a menu item (legacy cart sheet API). */
  removeItem: (restaurantSlug: string, itemId: string) => void;
  clearCart: (restaurantSlug: string) => void;
  syncCartLifecycle: (
    restaurantSlug: string,
    liveMenuLastUpdated: string | null | undefined,
  ) => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

function newLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function computeCartTotals(lines: CartLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.totalItems += line.quantity;
      acc.totalPrice += computeLineTotal(line.unitPrice, line.quantity);
      return acc;
    },
    { totalItems: 0, totalPrice: 0 },
  );
}

function makeCartBucket(
  lines: CartLine[],
  meta: { lastActivityAt: string; menuLastUpdatedAt: string | null },
): CartBucket {
  const totals = computeCartTotals(lines);
  return {
    lines,
    totalItems: totals.totalItems,
    totalPrice: totals.totalPrice,
    lastActivityAt: meta.lastActivityAt,
    menuLastUpdatedAt: meta.menuLastUpdatedAt,
  };
}

function bucketHasItems(bucket: CartBucket | undefined): bucket is CartBucket {
  return Boolean(bucket && bucket.lines.length > 0);
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

function sortSelections(selections: SelectedModifier[]): SelectedModifier[] {
  return [...selections].sort((a, b) => a.groupId.localeCompare(b.groupId));
}

function legacyCartItemToLine(item: CartItem): CartLine {
  const variantId = "";
  const selections: SelectedModifier[] = [];
  const configKey = buildConfigKey(item.itemId, variantId, selections);
  return {
    lineId: newLineId(),
    menuItemId: item.itemId,
    variantId,
    quantity: item.quantity,
    selections,
    configKey,
    unitPrice: item.displayUnitPrice,
    name: item.name,
    translations: item.translations,
    addedAt: nowIso(),
  };
}

function normalizeCartBucket(
  slug: string,
  raw: Partial<CartBucket> & {
    itemsByItemId?: Record<string, CartItem>;
    lines?: CartLine[];
  },
): CartBucket | null {
  if (!slug) {
    return null;
  }

  const adoptedAt = nowIso();

  if (Array.isArray(raw.lines) && raw.lines.length > 0) {
    const lines = raw.lines
      .filter((line) => line && typeof line.menuItemId === "string")
      .map((line) => ({
        ...line,
        selections: sortSelections(line.selections ?? []),
        configKey:
          line.configKey ??
          buildConfigKey(line.menuItemId, line.variantId ?? "", line.selections ?? []),
        unitPrice:
          line.unitPrice ??
          computeUnitPrice(0, line.selections ?? []),
      }));
    if (lines.length === 0) {
      return null;
    }
    return makeCartBucket(lines, {
      lastActivityAt: raw.lastActivityAt ?? adoptedAt,
      menuLastUpdatedAt: raw.menuLastUpdatedAt ?? null,
    });
  }

  const legacyItems = raw.itemsByItemId ?? {};
  const legacyLines = Object.values(legacyItems).map(legacyCartItemToLine);
  if (legacyLines.length === 0) {
    return null;
  }

  return makeCartBucket(legacyLines, {
    lastActivityAt: raw.lastActivityAt ?? adoptedAt,
    menuLastUpdatedAt: raw.menuLastUpdatedAt ?? null,
  });
}

function migratePersistedState(
  persistedState: unknown,
  version: number,
): Pick<CartStore, "cartsByRestaurant"> {
  const state = (persistedState ?? {}) as Partial<
    CartStore & {
      restaurantSlug?: string | null;
      itemsByItemId?: Record<string, CartItem>;
    }
  >;

  const cartsByRestaurant: Record<string, CartBucket> = {};

  if (state.cartsByRestaurant && typeof state.cartsByRestaurant === "object") {
    for (const [slug, bucket] of Object.entries(state.cartsByRestaurant)) {
      const normalized = normalizeCartBucket(slug, bucket ?? {});
      if (normalized) {
        cartsByRestaurant[slug] = normalized;
      }
    }
    return { cartsByRestaurant };
  }

  const legacySlug = state.restaurantSlug ?? null;
  if (legacySlug) {
    const normalized = normalizeCartBucket(legacySlug, {
      itemsByItemId: state.itemsByItemId ?? {},
    });
    if (normalized) {
      cartsByRestaurant[legacySlug] = normalized;
    }
  }

  if (version >= 6) {
    return { cartsByRestaurant };
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

function findLegacyLine(bucket: CartBucket, menuItemId: string): CartLine | undefined {
  const candidates = bucket.lines.filter(
    (line) => line.menuItemId === menuItemId && line.selections.length === 0,
  );
  if (candidates.length === 1) {
    return candidates[0];
  }
  return bucket.lines.find((line) => line.menuItemId === menuItemId);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      cartsByRestaurant: {},
      hasLineWithMenuItemId: (restaurantSlug, menuItemId) => {
        const bucket = get().cartsByRestaurant[restaurantSlug];
        return Boolean(
          bucket?.lines.some((line) => line.menuItemId === menuItemId && line.quantity > 0),
        );
      },
      hasItemInCart: (restaurantSlug, itemId) =>
        get().hasLineWithMenuItemId(restaurantSlug, itemId),
      addOrMergeLine: ({
        restaurantSlug,
        menuItemId,
        variantId,
        quantity,
        name,
        translations,
        variantPrice,
        selections = [],
        addedBy,
      }) =>
        set((state) => {
          const existingBucket = state.cartsByRestaurant[restaurantSlug];
          const sortedSelections = sortSelections(selections);
          const configKey = buildConfigKey(menuItemId, variantId, sortedSelections);
          const unitPrice = computeUnitPrice(variantPrice, sortedSelections);
          const lines = [...(existingBucket?.lines ?? [])];
          const matchIndex = lines.findIndex((line) => line.configKey === configKey);

          if (matchIndex >= 0) {
            const existing = lines[matchIndex];
            lines[matchIndex] = {
              ...existing,
              quantity: existing.quantity + quantity,
              name,
              translations,
              unitPrice,
            };
          } else {
            lines.push({
              lineId: newLineId(),
              menuItemId,
              variantId,
              quantity,
              selections: sortedSelections,
              configKey,
              unitPrice,
              name,
              translations,
              addedAt: nowIso(),
              addedBy,
            });
          }

          return {
            cartsByRestaurant: {
              ...state.cartsByRestaurant,
              [restaurantSlug]: makeCartBucket(lines, touchBucketMeta(existingBucket)),
            },
          };
        }),
      addSelection: ({
        restaurantSlug,
        itemId,
        quantity,
        name,
        translations,
        displayUnitPrice,
        variantId = "",
      }) => {
        get().addOrMergeLine({
          restaurantSlug,
          menuItemId: itemId,
          variantId,
          quantity,
          name,
          translations,
          variantPrice: displayUnitPrice,
          selections: [],
        });
      },
      setLineQuantity: (restaurantSlug, lineId, quantity) =>
        set((state) => {
          const bucket = state.cartsByRestaurant[restaurantSlug];
          if (!bucket) {
            return state;
          }

          const index = bucket.lines.findIndex((line) => line.lineId === lineId);
          if (index < 0) {
            return state;
          }

          const meta = touchBucketMeta(bucket);
          const nextLines = [...bucket.lines];

          if (quantity <= 0) {
            nextLines.splice(index, 1);
          } else {
            nextLines[index] = { ...nextLines[index], quantity };
          }

          const nextCarts = { ...state.cartsByRestaurant };
          if (nextLines.length === 0) {
            delete nextCarts[restaurantSlug];
            return { cartsByRestaurant: nextCarts };
          }

          return {
            cartsByRestaurant: {
              ...nextCarts,
              [restaurantSlug]: makeCartBucket(nextLines, meta),
            },
          };
        }),
      setItemQuantity: (restaurantSlug, itemId, quantity) => {
        const bucket = get().cartsByRestaurant[restaurantSlug];
        if (!bucket) {
          return;
        }
        const line = findLegacyLine(bucket, itemId);
        if (!line) {
          return;
        }
        get().setLineQuantity(restaurantSlug, line.lineId, quantity);
      },
      removeLine: (restaurantSlug, lineId) =>
        set((state) => {
          const bucket = state.cartsByRestaurant[restaurantSlug];
          if (!bucket) {
            return state;
          }

          const nextLines = bucket.lines.filter((line) => line.lineId !== lineId);
          const nextCarts = { ...state.cartsByRestaurant };
          if (nextLines.length === 0) {
            delete nextCarts[restaurantSlug];
            return { cartsByRestaurant: nextCarts };
          }

          return {
            cartsByRestaurant: {
              ...nextCarts,
              [restaurantSlug]: makeCartBucket(nextLines, touchBucketMeta(bucket)),
            },
          };
        }),
      removeItem: (restaurantSlug, itemId) => {
        const bucket = get().cartsByRestaurant[restaurantSlug];
        if (!bucket) {
          return;
        }
        const line = findLegacyLine(bucket, itemId);
        if (!line) {
          return;
        }
        get().removeLine(restaurantSlug, line.lineId);
      },
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
      version: 6,
      migrate: (persistedState, version) => migratePersistedState(persistedState, version),
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
