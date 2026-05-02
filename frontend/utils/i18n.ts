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
    ownerDashboard: "Owner Dashboard",
    menuEditor: "Menu Editor",
    selectLanguage: "Select language",
    logout: "Logout",
    loadingMenu: "Loading menu…",
    couldNotLoadMenu: "Could not load menu",
    failedToLoadMenu: "Failed to load menu",
    failedToSaveChanges: "Failed to save changes. Please try again.",
    failedToUpdateAvailability: "Failed to update availability. Please try again.",
    addItem: "+ Add Item",
    editItemSectionTitle: "Edit item",
    tabGeneral: "General",
    tabTranslations: "Translations",
    tabUpsells: "Upsells",
    fieldItemName: "Name",
    fieldItemDescription: "Description",
    fieldBasePrice: "Base price",
    translationsComingSoon: "Translations coming soon.",
    upsellsComingSoon: "Upsell rules coming soon.",
    cancel: "Cancel",
    saveChanges: "Save changes",
    saving: "Saving…",
    closeEditor: "Close editor",
    availabilityAvailable: "Available",
    availabilityOutOfStock: "Out of stock",
    editMenuItemAria: "Edit {{name}}",
    toggleAvailabilityAria: "Toggle availability for {{name}}",
    menuUnavailable: "Menu unavailable",
    menuLoadFallback: "We could not load this menu right now.",
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
    ownerDashboard: "לוח בעלים",
    menuEditor: "עריכת תפריט",
    selectLanguage: "בחר שפה",
    logout: "התנתקות",
    loadingMenu: "טוען תפריט…",
    couldNotLoadMenu: "לא ניתן לטעון את התפריט",
    failedToLoadMenu: "טעינת התפריט נכשלה",
    failedToSaveChanges: "שמירת השינויים נכשלה. נסה שוב.",
    failedToUpdateAvailability: "עדכון הזמינות נכשל. נסה שוב.",
    addItem: "+ הוסף פריט",
    editItemSectionTitle: "עריכת פריט",
    tabGeneral: "כללי",
    tabTranslations: "תרגומים",
    tabUpsells: "מכירות נלוות",
    fieldItemName: "שם",
    fieldItemDescription: "תיאור",
    fieldBasePrice: "מחיר בסיס",
    translationsComingSoon: "תרגומים יתווספו בקרוב.",
    upsellsComingSoon: "כללי מכירות נלוות יתווספו בקרוב.",
    cancel: "ביטול",
    saveChanges: "שמור שינויים",
    saving: "שומר…",
    closeEditor: "סגירת העורך",
    availabilityAvailable: "זמין",
    availabilityOutOfStock: "אזל מהמלאי",
    editMenuItemAria: "עריכת {{name}}",
    toggleAvailabilityAria: "החלפת זמינות עבור {{name}}",
    menuUnavailable: "התפריט אינו זמין",
    menuLoadFallback: "לא ניתן לטעון את התפריט כרגע.",
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

export type UiMessageKey = keyof (typeof uiMessages)["en"];

export function getUiMessage(key: UiMessageKey, locale: Locale): string {
  return uiMessages[locale][key];
}

/** Replace `{{var}}` placeholders in a UI string (used for aria-labels). */
export function getUiTemplate(
  key: UiMessageKey,
  locale: Locale,
  vars: Record<string, string>,
): string {
  let result = uiMessages[locale][key] as string;
  for (const [varKey, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${varKey}}}`, value);
  }
  return result;
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "he";
}
