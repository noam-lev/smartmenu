"use client";

import { useEffect, useState } from "react";
import { useTenantLocale } from "../context/TenantLocaleContext";
import { fetchDinerMenu } from "../lib/menuApi";
import { getMenuLoadErrorMessage } from "../lib/menuFetchError";
import {
  parseLangFromSearchParams,
  readLocaleHint,
} from "../lib/tenantLocale";
import { useSearchParams } from "next/navigation";
import type { SlimMenuPayload } from "../types/menu";

type UseMenuDataOptions = {
  onMenuLoaded?: (data: SlimMenuPayload) => void;
};

export function useMenuData(restaurantSlug: string, options?: UseMenuDataOptions) {
  const [menuPayload, setMenuPayload] = useState<SlimMenuPayload | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const { locale, applyServerDefaultLocale } = useTenantLocale();
  const searchParams = useSearchParams();
  const urlLang = parseLangFromSearchParams(searchParams);
  const onMenuLoaded = options?.onMenuLoaded;

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      try {
        setIsMenuLoading(true);
        setMenuError(null);

        const fetchLang = urlLang ?? readLocaleHint(restaurantSlug) ?? undefined;
        const data = await fetchDinerMenu(restaurantSlug, fetchLang);

        if (!isMounted) {
          return;
        }

        setMenuPayload(data);
        applyServerDefaultLocale(data.restaurant.default_locale);
        onMenuLoaded?.(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMenuError(getMenuLoadErrorMessage(error, locale));
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
  }, [restaurantSlug, urlLang, locale, applyServerDefaultLocale, onMenuLoaded]);

  return { menuPayload, isMenuLoading, menuError, locale };
}
