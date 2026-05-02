"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Locale, MenuItem } from "../types/menu";
import { useUiStore } from "../store/uiStore";
import { getLocalizedText, getUiMessage, isRtlLocale } from "../utils/i18n";

type EditTabId = "general" | "translations" | "upsells";

export type EditItemDrawerProps = {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<MenuItem>) => Promise<void>;
};

function buildPatchFromForm(
  item: MenuItem,
  locale: Locale,
  name: string,
  description: string,
  basePrice: number,
): Partial<MenuItem> {
  const patch: Partial<MenuItem> = { base_price: basePrice };

  if (locale === "en") {
    patch.name = name;
    patch.description = description;
  } else {
    patch.translations = {
      ...item.translations,
      [locale]: {
        ...(item.translations?.[locale] ?? {}),
        name,
        description,
      },
    };
  }

  return patch;
}

export default function EditItemDrawer({
  item,
  isOpen,
  onClose,
  onSave,
}: EditItemDrawerProps) {
  const locale = useUiStore((state) => state.locale);
  const isRtl = isRtlLocale(locale);

  const [activeTab, setActiveTab] = useState<EditTabId>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) {
      return;
    }

    setActiveTab("general");
    setName(getLocalizedText(item, "name", locale));
    setDescription(getLocalizedText(item, "description", locale));
    setBasePrice(String(item.base_price ?? ""));
    setIsSaving(false);
  }, [isOpen, item, locale]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) {
    return null;
  }

  const tabs: { id: EditTabId; label: string }[] = [
    { id: "general", label: getUiMessage("tabGeneral", locale) },
    { id: "translations", label: getUiMessage("tabTranslations", locale) },
    { id: "upsells", label: getUiMessage("tabUpsells", locale) },
  ];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const parsedPrice = Number(basePrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return;
    }

    const patch = buildPatchFromForm(item, locale, name, description, parsedPrice);

    setIsSaving(true);
    try {
      await onSave(patch);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        aria-label={getUiMessage("closeEditor", locale)}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-item-drawer-title"
        lang={locale}
        dir={isRtl ? "rtl" : "ltr"}
        className={`absolute inset-y-0 z-[71] flex h-full w-full max-w-none flex-col bg-white shadow-2xl md:w-1/3 md:max-w-xl ${
          isRtl ? "left-0" : "right-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getUiMessage("editItemSectionTitle", locale)}
            </p>
            <h2
              id="edit-item-drawer-title"
              className="mt-1 truncate text-lg font-bold text-zinc-900"
            >
              {getLocalizedText(item, "name", locale)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={getUiMessage("close", locale)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.96]"
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

        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-100 px-4 py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 active:scale-[0.98]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {activeTab === "general" ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-item-name" className="text-xs font-semibold text-zinc-600">
                    {getUiMessage("fieldItemName", locale)}
                  </label>
                  <input
                    id="edit-item-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="off"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-item-description"
                    className="text-xs font-semibold text-zinc-600"
                  >
                    {getUiMessage("fieldItemDescription", locale)}
                  </label>
                  <textarea
                    id="edit-item-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className="mt-1 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-5 text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label htmlFor="edit-item-price" className="text-xs font-semibold text-zinc-600">
                    {getUiMessage("fieldBasePrice", locale)}
                  </label>
                  <input
                    id="edit-item-price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={basePrice}
                    onChange={(event) => setBasePrice(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "translations" ? (
              <p className="text-sm text-zinc-500">
                {getUiMessage("translationsComingSoon", locale)}
              </p>
            ) : null}

            {activeTab === "upsells" ? (
              <p className="text-sm text-zinc-500">
                {getUiMessage("upsellsComingSoon", locale)}
              </p>
            ) : null}
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
                    {getUiMessage("saving", locale)}
                  </span>
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
