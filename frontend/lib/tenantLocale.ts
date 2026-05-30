import type { Locale } from "../types/menu";

export const LANG_SEARCH_PARAM = "lang";
export const LOCALE_STORAGE_PREFIX = "smartmenu:locale:";

const VALID_LOCALES = new Set<Locale>(["en", "he"]);

export function isValidLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && VALID_LOCALES.has(value as Locale);
}

export function localeStorageKey(restaurantSlug: string): string {
  return `${LOCALE_STORAGE_PREFIX}${restaurantSlug}`;
}

export function readLocaleHint(restaurantSlug: string): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(localeStorageKey(restaurantSlug));
    return isValidLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeLocaleHint(restaurantSlug: string, locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(localeStorageKey(restaurantSlug), locale);
  } catch {
    // ignore quota / private mode
  }
}

/** Merge `lang` into path search params; preserve other keys (table, ownerDrawer, …). */
export function withLangSearchParams(
  pathname: string,
  locale: Locale,
  currentSearch?: string | URLSearchParams,
): string {
  const params = new URLSearchParams(
    typeof currentSearch === "string"
      ? currentSearch
      : currentSearch?.toString() ?? "",
  );
  params.set(LANG_SEARCH_PARAM, locale);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function tenantHref(
  path: string,
  locale: Locale,
  currentSearch?: string | URLSearchParams,
): string {
  const [pathname, existingQuery] = path.split("?", 2);
  const merged = new URLSearchParams(existingQuery ?? "");
  if (currentSearch) {
    const extra =
      typeof currentSearch === "string"
        ? new URLSearchParams(currentSearch)
        : currentSearch;
    extra.forEach((value, key) => {
      if (key !== LANG_SEARCH_PARAM) {
        merged.set(key, value);
      }
    });
  }
  return withLangSearchParams(pathname, locale, merged);
}

export function parseLangFromSearchParams(
  searchParams: URLSearchParams | null | undefined,
): Locale | null {
  if (!searchParams) {
    return null;
  }
  const raw = searchParams.get(LANG_SEARCH_PARAM);
  return isValidLocale(raw) ? raw : null;
}

export function resolveTenantLocale(input: {
  urlLang: Locale | null;
  storedLang: Locale | null;
  serverDefaultLocale: Locale | null | undefined;
}): Locale {
  if (input.urlLang) {
    return input.urlLang;
  }
  if (input.storedLang) {
    return input.storedLang;
  }
  const server = input.serverDefaultLocale;
  if (isValidLocale(server)) {
    return server;
  }
  return "he";
}
