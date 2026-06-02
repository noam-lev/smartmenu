import type { Locale, MenuItem, TranslationsMap } from "../types/menu";
import { getLocalizedText } from "../utils/i18n";

export type ItemLocaleFields = {
  name: string;
  description: string;
};

export type ItemTranslationFields = Partial<Record<Locale, ItemLocaleFields>>;

export function emptyItemTranslationFields(
  supportedLocales: Locale[],
): ItemTranslationFields {
  const fields: ItemTranslationFields = {};
  for (const code of supportedLocales) {
    fields[code] = { name: "", description: "" };
  }
  return fields;
}

export function readItemTranslationFields(
  item: MenuItem | null,
  supportedLocales: Locale[],
  defaultLocale: Locale,
): ItemTranslationFields {
  const fields = emptyItemTranslationFields(supportedLocales);

  for (const code of supportedLocales) {
    if (!item) {
      continue;
    }

    const nameFromBucket = item.translations?.[code]?.name;
    const descFromBucket = item.translations?.[code]?.description;

    fields[code] = {
      name:
        typeof nameFromBucket === "string" && nameFromBucket.trim().length > 0
          ? nameFromBucket
          : code === defaultLocale
            ? item.name
            : getLocalizedText(item, "name", code),
      description:
        typeof descFromBucket === "string"
          ? descFromBucket
          : code === defaultLocale
            ? item.description
            : getLocalizedText(item, "description", code),
    };
  }

  return fields;
}

export function buildItemTranslationsPatch(
  fields: ItemTranslationFields,
  supportedLocales: Locale[],
  defaultLocale: Locale,
): Pick<MenuItem, "name" | "description" | "translations"> {
  const translations: TranslationsMap = {};

  for (const code of supportedLocales) {
    const bucket = fields[code] ?? { name: "", description: "" };
    translations[code] = {
      name: bucket.name.trim(),
      description: bucket.description,
    };
  }

  const defaultBucket = translations[defaultLocale] ?? { name: "", description: "" };

  return {
    name: defaultBucket.name?.trim() ?? "",
    description: defaultBucket.description ?? "",
    translations,
  };
}

export function mergeItemTranslationPatches(
  generalPatch: Partial<MenuItem>,
  translationPatch: Pick<MenuItem, "name" | "description" | "translations">,
  uiLocale: Locale,
  defaultLocale: Locale,
): Partial<MenuItem> {
  const translations: TranslationsMap = {
    ...(translationPatch.translations ?? {}),
  };

  const uiBucket = generalPatch.translations?.[uiLocale];
  if (uiBucket) {
    translations[uiLocale] = {
      ...(translations[uiLocale] ?? {}),
      ...uiBucket,
    };
  }

  const defaultBucket = translations[defaultLocale];
  const name =
    uiLocale === defaultLocale && typeof uiBucket?.name === "string"
      ? uiBucket.name.trim()
      : (defaultBucket?.name?.trim() ?? translationPatch.name);
  const description =
    uiLocale === defaultLocale && uiBucket?.description !== undefined
      ? uiBucket.description
      : (defaultBucket?.description ?? translationPatch.description);

  if (defaultBucket) {
    translations[defaultLocale] = {
      ...defaultBucket,
      name,
      description,
    };
  }

  return {
    ...generalPatch,
    name,
    description,
    translations,
  };
}

export function isItemLocaleTranslationMissing(
  fields: ItemLocaleFields | undefined,
): boolean {
  if (!fields) {
    return true;
  }
  return fields.name.trim().length === 0;
}
