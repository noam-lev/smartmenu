"use client";

import type { Locale } from "../types/menu";
import {
  type ItemLocaleFields,
  type ItemTranslationFields,
  isItemLocaleTranslationMissing,
} from "../lib/itemTranslations";
import { getUiMessage, isRtlLocale } from "../utils/i18n";

type ItemTranslationsTabProps = {
  supportedLocales: Locale[];
  defaultLocale: Locale;
  fields: ItemTranslationFields;
  onChange: (code: Locale, patch: Partial<ItemLocaleFields>) => void;
  onAutoTranslate: (code: Locale) => void;
  autoTranslatingLocale: Locale | null;
  autoTranslateError: string | null;
  autoTranslateErrorLocale: Locale | null;
  uiLocale: Locale;
  disabled?: boolean;
};

function localeColumnLabel(code: Locale, uiLocale: Locale): string {
  return code === "he"
    ? getUiMessage("itemTranslationNameHe", uiLocale)
    : getUiMessage("itemTranslationNameEn", uiLocale);
}

function localeDescriptionLabel(code: Locale, uiLocale: Locale): string {
  return code === "he"
    ? getUiMessage("itemTranslationDescHe", uiLocale)
    : getUiMessage("itemTranslationDescEn", uiLocale);
}

export default function ItemTranslationsTab({
  supportedLocales,
  defaultLocale,
  fields,
  onChange,
  onAutoTranslate,
  autoTranslatingLocale,
  autoTranslateError,
  autoTranslateErrorLocale,
  uiLocale,
  disabled = false,
}: ItemTranslationsTabProps) {
  if (supportedLocales.length <= 1) {
    return (
      <p className="text-sm text-zinc-500">{getUiMessage("itemTranslationsSingleLocale", uiLocale)}</p>
    );
  }

  const defaultFields = fields[defaultLocale] ?? { name: "", description: "" };
  const canAutoTranslate = defaultFields.name.trim().length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">{getUiMessage("itemTranslationsIntro", uiLocale)}</p>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
        {supportedLocales.map((code) => {
          const bucket = fields[code] ?? { name: "", description: "" };
          const isDefault = code === defaultLocale;
          const isMissing = isItemLocaleTranslationMissing(bucket);
          const columnDir = isRtlLocale(code) ? "rtl" : "ltr";
          const isTranslating = autoTranslatingLocale === code;
          const isAutoTranslateDisabled =
            disabled || autoTranslatingLocale !== null || !canAutoTranslate;

          return (
            <section
              key={code}
              lang={code}
              dir={columnDir}
              className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-700">
                  {getUiMessage(code === "he" ? "languageHebrew" : "languageEnglish", uiLocale)}
                </h3>
                {isDefault ? (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {getUiMessage("itemTranslationDefaultBadge", uiLocale)}
                  </span>
                ) : null}
                {isMissing ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {getUiMessage("itemTranslationMissing", uiLocale)}
                  </span>
                ) : null}
              </div>

              {!isDefault ? (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => onAutoTranslate(code)}
                    disabled={isAutoTranslateDisabled}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isTranslating ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                        {getUiMessage("itemTranslationAutoTranslating", uiLocale)}
                      </>
                    ) : (
                      getUiMessage("itemTranslationAutoTranslate", uiLocale)
                    )}
                  </button>
                  {autoTranslateError && autoTranslateErrorLocale === code ? (
                    <p className="mt-2 text-xs text-red-600">{autoTranslateError}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor={`item-translation-name-${code}`}
                    className="text-xs font-semibold text-zinc-600"
                  >
                    {localeColumnLabel(code, uiLocale)}
                  </label>
                  <input
                    id={`item-translation-name-${code}`}
                    type="text"
                    value={bucket.name}
                    onChange={(event) => onChange(code, { name: event.target.value })}
                    disabled={disabled || isTranslating}
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`item-translation-desc-${code}`}
                    className="text-xs font-semibold text-zinc-600"
                  >
                    {localeDescriptionLabel(code, uiLocale)}
                  </label>
                  <textarea
                    id={`item-translation-desc-${code}`}
                    value={bucket.description}
                    onChange={(event) => onChange(code, { description: event.target.value })}
                    disabled={disabled || isTranslating}
                    rows={4}
                    className="mt-1 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-5 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 disabled:opacity-60"
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
