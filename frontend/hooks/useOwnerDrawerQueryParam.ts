"use client";

import { useEffect } from "react";
import { OWNER_DRAWER_SEARCH_PARAM } from "../lib/ownerDrawer";

/**
 * Opens the owner drawer when the URL contains `?ownerDrawer=1`, then strips the param.
 */
export function useOwnerDrawerQueryParam(
  setDrawerOpen: (open: boolean) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get(OWNER_DRAWER_SEARCH_PARAM) !== "1") {
      return;
    }

    setDrawerOpen(true);
    params.delete(OWNER_DRAWER_SEARCH_PARAM);
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [enabled, setDrawerOpen]);
}
