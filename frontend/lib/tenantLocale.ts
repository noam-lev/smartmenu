import type { Locale } from "../types/menu";
import { getSupportedLocalesFromSettings } from "./supportedLocales";

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

export function clampLocaleToSupported(
  locale: Locale,
  supportedLocales: Locale[] | null | undefined,
  defaultLocale?: Locale | null,
): Locale {
  if (!supportedLocales || supportedLocales.length === 0) {
    return locale;
  }
  if (supportedLocales.includes(locale)) {
    return locale;
  }
  if (defaultLocale && supportedLocales.includes(defaultLocale)) {
    return defaultLocale;
  }
  return supportedLocales[0];
}

export function resolveTenantLocale(input: {
  urlLang: Locale | null;
  storedLang: Locale | null;
  serverDefaultLocale: Locale | null | undefined;
  supportedLocales?: Locale[] | null;
}): Locale {
  const defaultLocale = isValidLocale(input.serverDefaultLocale)
    ? input.serverDefaultLocale
    : null;
  const clamp = (lang: Locale) =>
    clampLocaleToSupported(lang, input.supportedLocales, defaultLocale);

  if (input.urlLang) {
    return clamp(input.urlLang);
  }
  if (input.storedLang) {
    return clamp(input.storedLang);
  }
  if (defaultLocale) {
    return clamp(defaultLocale);
  }
  if (input.supportedLocales && input.supportedLocales.length > 0) {
    return input.supportedLocales[0];
  }
  return "he";
}

export function supportedLocalesFromRestaurantSettings(
  settings: Record<string, unknown> | null | undefined,
  defaultLocale?: Locale | null,
): Locale[] {
  return getSupportedLocalesFromSettings(settings, defaultLocale);
}
