import type { Locale } from "../types/menu";
import { isValidLocale } from "./tenantLocale";

/** Options for default-language dropdown from restaurant settings only. */
export function getSupportedLocalesFromSettings(
  settings: Record<string, unknown> | null | undefined,
  defaultLocale?: Locale | null,
): Locale[] {
  const raw = settings?.supported_locales;
  if (Array.isArray(raw)) {
    const locales: Locale[] = [];
    for (const entry of raw) {
      const code = typeof entry === "string" ? entry : String(entry ?? "");
      if (isValidLocale(code) && !locales.includes(code)) {
        locales.push(code);
      }
    }
    if (locales.length > 0) {
      return locales.sort();
    }
  }

  const fromSettings = settings?.default_locale;
  const resolved =
    (isValidLocale(defaultLocale) && defaultLocale) ||
    (typeof fromSettings === "string" && isValidLocale(fromSettings)
      ? fromSettings
      : "he");

  return [resolved];
}
