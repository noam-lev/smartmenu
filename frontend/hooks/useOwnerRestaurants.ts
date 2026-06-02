"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OwnerMenuNamePatch } from "../lib/patchOwnerRestaurantMenu";
import { patchOwnerRestaurantMenu } from "../lib/patchOwnerRestaurantMenu";
import type { OwnerRestaurant } from "../types/owner";
import { fetchOwnerRestaurants } from "../lib/menuApi";

type OwnerRestaurantsState = {
  restaurants: OwnerRestaurant[];
  isLoading: boolean;
  patchMenuInList: (menuId: string, patch: OwnerMenuNamePatch) => void;
};

/**
 * Fetches the list of restaurants (with menus) the current user owns/manages.
 * Only fires when `userId` is non-null. Passes `currentSlug` so the backend
 * can scope superadmin results to one restaurant instead of the entire DB.
 */
export function useOwnerRestaurants(
  userId: string | null,
  currentSlug?: string,
): OwnerRestaurantsState {
  const [restaurants, setRestaurants] = useState<OwnerRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<{ key: string; data: OwnerRestaurant[] } | null>(null);

  useEffect(() => {
    if (!userId) {
      setRestaurants([]);
      setIsLoading(false);
      cacheRef.current = null;
      return;
    }

    const cacheKey = `${userId}:${currentSlug ?? ""}`;
    if (cacheRef.current?.key === cacheKey) {
      setRestaurants(cacheRef.current.data);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchOwnerRestaurants(currentSlug)
      .then((data) => {
        if (!cancelled) {
          cacheRef.current = { key: cacheKey, data };
          setRestaurants(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRestaurants([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, currentSlug]);

  const patchMenuInList = useCallback((menuId: string, patch: OwnerMenuNamePatch) => {
    setRestaurants((prev) => {
      const next = patchOwnerRestaurantMenu(prev, menuId, patch);
      if (cacheRef.current) {
        cacheRef.current = { ...cacheRef.current, data: next };
      }
      return next;
    });
  }, []);

  return { restaurants, isLoading, patchMenuInList };
}
