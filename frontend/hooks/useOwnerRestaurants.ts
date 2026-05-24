"use client";

import { useEffect, useRef, useState } from "react";
import type { OwnerRestaurant } from "../types/owner";
import { fetchOwnerRestaurants } from "../lib/menuApi";

type OwnerRestaurantsState = {
  restaurants: OwnerRestaurant[];
  isLoading: boolean;
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

  return { restaurants, isLoading };
}
