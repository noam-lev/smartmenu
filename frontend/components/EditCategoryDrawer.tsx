"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale, MenuCategory, TranslationsMap } from "../types/menu";
import { useTenantLocale } from "../context/TenantLocaleContext";
import CategoryColorPicker from "./CategoryColorPicker";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { getLocalizedText, getUiMessage } from "../utils/i18n";

function looksLikeEnglishBucketText(value: string): boolean {
  const t = value.trim();
  if (!t) {
    return false;
  }
  return /[A-Za-z]/.test(t) && !/[\u0590-\u05FF]/.test(t);
}

function looksLikeHebrewBucketText(value: string): boolean {
  const t = value.trim();
  if (!t) {
    return false;
  }
  return /[\u0590-\u05FF]/.test(t);
}

function shouldCopyBaseFieldToOtherLocale(baseValue: string, otherLocale: Locale): boolean {
  if (otherLocale === "en") {
    return looksLikeEnglishBucketText(baseValue);
  }
  return looksLikeHebrewBucketText(baseValue);
}

export type CategorySavePayload = {
  name: string;
  locale: Locale;
  translations: TranslationsMap;
  header_color: string | null;
  /** False when the user only changed header color — avoids overwriting translations. */
  nameChanged: boolean;
};

function buildCategorySavePayload(
  category: MenuCategory | null,
  locale: Locale,
  restaurantDefaultLocale: Locale,
  name: string,
  header_color: string | null,
  nameChanged: boolean,
): CategorySavePayload {
  const trimmed = name.trim();

  if (!category) {
    return {
      name: trimmed,
      locale,
      translations: { [locale]: { name: trimmed } },
      header_color,
      nameChanged: true,
    };
  }

  if (!nameChanged) {
    return {
      name: trimmed,
      locale,
      translations: category.translations ?? {},
      header_color,
      nameChanged: false,
    };
  }

  let nextTranslations: TranslationsMap = {
    ...(category.translations ?? {}),
    [locale]: {
      ...(category.translations?.[locale] ?? {}),
      name,
    },
  };

  if (locale === restaurantDefaultLocale) {
    const otherLocale: Locale = restaurantDefaultLocale === "en" ? "he" : "en";
    const otherBucket = nextTranslations[otherLocale] ?? {};
    const otherNameMissing =
      typeof otherBucket.name !== "string" || otherBucket.name.trim().length === 0;

    const additions: Record<string, string> = {};
    if (otherNameMissing && shouldCopyBaseFieldToOtherLocale(category.name, otherLocale)) {
      additions.name = category.name;
    }
    if (Object.keys(additions).length > 0) {
      nextTranslations = {
        ...nextTranslations,
        [otherLocale]: {
          ...otherBucket,
          ...additions,
        },
      };
    }
  }

  return {
    name: trimmed,
    locale,
    translations: nextTranslations,
    header_color,
    nameChanged: true,
  };
}

export type EditCategoryDrawerProps = {
  category: MenuCategory | null;
  restaurantDefaultLocale: Locale;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CategorySavePayload) => Promise<void>;
};

export default function EditCategoryDrawer({
  category,
  restaurantDefaultLocale,
  isOpen,
  onClose,
  onSave,
}: EditCategoryDrawerProps) {
  const { locale, isRtl } = useTenantLocale();
  const isCreateMode = !category;

  const [name, setName] = useState("");
  const [headerColor, setHeaderColor] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initialNameRef = useRef("");

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsSaving(false);

    if (isCreateMode) {
      setName("");
      setHeaderColor(null);
      initialNameRef.current = "";
      return;
    }

    const initialName = getLocalizedText(category, "name", locale);
    setName(initialName);
    initialNameRef.current = initialName;
    setHeaderColor(category.header_color ?? null);
  }, [isOpen, category, locale, isCreateMode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose, isSaving]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const nameChanged = trimmed !== initialNameRef.current.trim();
    const payload = buildCategorySavePayload(
      category,
      locale,
      restaurantDefaultLocale,
      trimmed,
      headerColor,
      nameChanged,
    );

    setIsSaving(true);
    try {
      await onSave(payload);
    } finally {
      setIsSaving(false);
    }
  };

  const drawerTitleId = "edit-category-drawer-title";

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        aria-label={getUiMessage("closeEditor", locale)}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        disabled={isSaving}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={drawerTitleId}
        lang={locale}
        dir={isRtl ? "rtl" : "ltr"}
        className={`absolute inset-y-0 z-[71] flex h-full w-full max-w-none flex-col bg-white shadow-2xl md:w-1/3 md:max-w-xl ${
          isRtl ? "left-0" : "right-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {isCreateMode
                ? getUiMessage("createCategoryEyebrow", locale)
                : getUiMessage("editCategoryEyebrow", locale)}
            </p>
            <h2 id={drawerTitleId} className="mt-1 truncate text-lg font-bold text-zinc-900">
              {isCreateMode
                ? getUiMessage("createCategoryTitle", locale)
                : getLocalizedText(category!, "name", locale)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={getUiMessage("close", locale)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.96] disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="m6 6 8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div>
              <label htmlFor="edit-category-name" className="text-xs font-semibold text-zinc-600">
                {getUiMessage("categoryNameLabel", locale)}
              </label>
              <input
                id="edit-category-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
              />
            </div>

            <CategoryColorPicker
              locale={locale}
              value={headerColor}
              onChange={setHeaderColor}
              previewLabel={name.trim() || getUiMessage("categoryNameLabel", locale)}
              disabled={isSaving}
            />
          </div>

          <div className="sticky bottom-0 shrink-0 border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 rounded-full border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800 shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                {getUiMessage("cancel", locale)}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="relative flex flex-1 items-center justify-center rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
              >
                {isSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {getUiMessage("savingCategory", locale)}
                  </span>
                ) : isCreateMode ? (
                  getUiMessage("createCategoryButton", locale)
                ) : (
                  getUiMessage("saveChanges", locale)
                )}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
