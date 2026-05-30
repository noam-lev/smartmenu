"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "../../types/menu";
import { updateRestaurantDefaultLocale } from "../../lib/menuApi";
import { getSupportedLocalesFromSettings } from "../../lib/supportedLocales";
import { isValidLocale } from "../../lib/tenantLocale";
import { getUiMessage, type UiMessageKey } from "../../utils/i18n";

type OwnerDefaultLanguageSettingProps = {
  locale: Locale;
  restaurantSlug: string;
  settings: Record<string, unknown> | null | undefined;
  defaultLocale?: Locale | null;
  onSaved: (settings: Record<string, unknown>) => void;
};

function localeOptionLabel(code: Locale, uiLocale: Locale): string {
  const key: UiMessageKey =
    code === "he" ? "languageHebrew" : "languageEnglish";
  return getUiMessage(key, uiLocale);
}

export default function OwnerDefaultLanguageSetting({
  locale,
  restaurantSlug,
  settings,
  defaultLocale,
  onSaved,
}: OwnerDefaultLanguageSettingProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const currentDefault = useMemo(() => {
    if (isValidLocale(defaultLocale)) {
      return defaultLocale;
    }
    const fromSettings = settings?.default_locale;
    if (typeof fromSettings === "string" && isValidLocale(fromSettings)) {
      return fromSettings;
    }
    return "he" as Locale;
  }, [defaultLocale, settings]);

  const availableLocales = useMemo(
    () => getSupportedLocalesFromSettings(settings, currentDefault),
    [settings, currentDefault],
  );

  const [selected, setSelected] = useState<Locale>(currentDefault);

  useEffect(() => {
    setSelected(currentDefault);
  }, [currentDefault]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSavedFlash(false);
    setIsSaving(true);
    try {
      const updated = await updateRestaurantDefaultLocale(restaurantSlug, selected);
      onSaved(updated);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : getUiMessage("failedToSaveChanges", locale),
      );
    } finally {
      setIsSaving(false);
    }
  }, [locale, onSaved, restaurantSlug, selected]);

  const isDirty = selected !== currentDefault;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">
          {getUiMessage("ownerSettingsDefaultLanguage", locale)}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          {getUiMessage("ownerSettingsDefaultLanguageHint", locale)}
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-600">
          {getUiMessage("ownerSettingsDefaultLanguageLabel", locale)}
        </span>
        <select
          value={selected}
          onChange={(e) => {
            const value = e.target.value;
            if (isValidLocale(value)) {
              setSelected(value);
            }
          }}
          disabled={isSaving || availableLocales.length === 0}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {availableLocales.map((code) => (
            <option key={code} value={code}>
              {localeOptionLabel(code, locale)}
            </option>
          ))}
        </select>
      </label>

      {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
      {savedFlash ? (
        <p className="text-xs font-medium text-emerald-600">
          {getUiMessage("ownerSettingsSaved", locale)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!isDirty || isSaving}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? getUiMessage("saving", locale) : getUiMessage("saveChanges", locale)}
      </button>
    </div>
  );
}
