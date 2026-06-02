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
  onCopyFromDefault: (code: Locale) => void;
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
  onCopyFromDefault,
  uiLocale,
  disabled = false,
}: ItemTranslationsTabProps) {
  if (supportedLocales.length <= 1) {
    return (
      <p className="text-sm text-zinc-500">{getUiMessage("itemTranslationsSingleLocale", uiLocale)}</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">{getUiMessage("itemTranslationsIntro", uiLocale)}</p>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
        {supportedLocales.map((code) => {
          const bucket = fields[code] ?? { name: "", description: "" };
          const isDefault = code === defaultLocale;
          const isMissing = isItemLocaleTranslationMissing(bucket);
          const columnDir = isRtlLocale(code) ? "rtl" : "ltr";

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
                    disabled={disabled}
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
                    disabled={disabled}
                    rows={4}
                    className="mt-1 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-5 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 disabled:opacity-60"
                  />
                </div>

                {!isDefault ? (
                  <button
                    type="button"
                    onClick={() => onCopyFromDefault(code)}
                    disabled={disabled}
                    className="text-xs font-semibold text-zinc-700 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {getUiMessage("itemTranslationCopyFromDefault", uiLocale)}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
