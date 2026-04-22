import type { Locale, TranslationsMap } from "../types/menu";

type TranslatableEntity = {
  translations?: TranslationsMap;
} & Record<string, unknown>;

const uiMessages = {
  en: {
    unavailable: "Unavailable",
    quantity: "Quantity",
    addToOrder: "Add to order",
    suggestedAddon: "Suggested add-on",
    noThanks: "No thanks",
    add: "Add",
    yourOrder: "Your order",
    close: "Close",
    emptyCart: "Your cart is empty.",
    each: "each",
    remove: "Remove",
    subtotal: "Subtotal",
    softOrdering: "Soft ordering",
    viewOrder: "View Order",
    itemSingular: "item",
    itemPlural: "items",
    languageHebrew: "עברית",
    languageEnglish: "English",
  },
  he: {
    unavailable: "לא זמין",
    quantity: "כמות",
    addToOrder: "הוסף להזמנה",
    suggestedAddon: "תוספת מומלצת",
    noThanks: "לא תודה",
    add: "הוסף",
    yourOrder: "ההזמנה שלך",
    close: "סגור",
    emptyCart: "העגלה ריקה.",
    each: "ליחידה",
    remove: "הסר",
    subtotal: "סיכום ביניים",
    softOrdering: "הזמנה רכה",
    viewOrder: "צפה בהזמנה",
    itemSingular: "פריט",
    itemPlural: "פריטים",
    languageHebrew: "עברית",
    languageEnglish: "English",
  },
} as const;

export function getLocalizedText(
  entity: TranslatableEntity,
  field: string,
  locale: Locale,
): string {
  const source = entity[field];
  const fallback = typeof source === "string" ? source : "";
  const translated = entity.translations?.[locale]?.[field];

  if (typeof translated === "string" && translated.trim().length > 0) {
    return translated;
  }

  return fallback;
}

export function getUiMessage(
  key: keyof (typeof uiMessages)["en"],
  locale: Locale,
): string {
  return uiMessages[locale][key];
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "he";
}
