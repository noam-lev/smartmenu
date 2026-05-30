import type { FatMenuPayload, Locale, SlimMenuPayload } from "../types/menu";
import { isValidLocale } from "./tenantLocale";

export function mergeRestaurantSettingsIntoPayload<
  T extends SlimMenuPayload | FatMenuPayload,
>(prev: T, settings: Record<string, unknown>): T {
  const rawDefault = settings.default_locale;
  const default_locale =
    typeof rawDefault === "string" && isValidLocale(rawDefault)
      ? (rawDefault as Locale)
      : prev.restaurant.default_locale;

  return {
    ...prev,
    restaurant: {
      ...prev.restaurant,
      default_locale,
      settings: {
        ...(prev.restaurant.settings ?? {}),
        ...settings,
      },
    },
  };
}
