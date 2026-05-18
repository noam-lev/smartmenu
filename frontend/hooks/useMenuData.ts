"use client";

import { useEffect, useState } from "react";
import { fetchMenuBySlug } from "../lib/menuApi";
import { getMenuLoadErrorMessage } from "../lib/menuFetchError";
import { useUiStore } from "../store/uiStore";
import type { MenuPayload } from "../types/menu";

type UseMenuDataOptions = {
  onMenuLoaded?: (data: MenuPayload) => void;
};

export function useMenuData(restaurantSlug: string, options?: UseMenuDataOptions) {
  const [menuPayload, setMenuPayload] = useState<MenuPayload | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const setLocale = useUiStore((state) => state.setLocale);
  const onMenuLoaded = options?.onMenuLoaded;

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      try {
        setIsMenuLoading(true);
        setMenuError(null);

        const data = await fetchMenuBySlug(restaurantSlug);

        if (!isMounted) {
          return;
        }

        setMenuPayload(data);
        setLocale(data.restaurant.default_locale ?? "en");
        onMenuLoaded?.(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const uiLocale = useUiStore.getState().locale;
        setMenuError(getMenuLoadErrorMessage(error, uiLocale));
      } finally {
        if (isMounted) {
          setIsMenuLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      isMounted = false;
    };
  }, [restaurantSlug, setLocale, onMenuLoaded]);

  return { menuPayload, isMenuLoading, menuError };
}
