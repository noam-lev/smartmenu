"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Locale, MenuItem, TranslationsMap } from "../types/menu";
import { useUiStore } from "../store/uiStore";
import { getLocalizedText, getUiMessage, isRtlLocale } from "../utils/i18n";
import UpsellTab from "./UpsellTab";
import DietaryIconPicker from "./DietaryIconPicker";
import {
  buildMetadataWithDietaryIcons,
  parseDietaryIcons,
  type DietaryIconId,
} from "../lib/dietaryIcons";
import { deleteOwnerImage, uploadOwnerImage } from "../lib/menuApi";
import { hasRenderableImage } from "../utils/media";

type EditTabId = "general" | "translations" | "upsells";

/** Detect text that likely belongs in the English translation bucket (Latin, no Hebrew letters). */
function looksLikeEnglishBucketText(value: string): boolean {
  const t = value.trim();
  if (!t) {
    return false;
  }
  return /[A-Za-z]/.test(t) && !/[\u0590-\u05FF]/.test(t);
}

/** Detect text that likely belongs in the Hebrew translation bucket. */
function looksLikeHebrewBucketText(value: string): boolean {
  const t = value.trim();
  if (!t) {
    return false;
  }
  return /[\u0590-\u05FF]/.test(t);
}

function shouldCopyBaseFieldToOtherLocale(
  baseValue: string,
  otherLocale: Locale,
): boolean {
  if (otherLocale === "en") {
    return looksLikeEnglishBucketText(baseValue);
  }
  return looksLikeHebrewBucketText(baseValue);
}

export type EditItemDrawerProps = {
  restaurantSlug: string;
  item: MenuItem | null;
  categoryId?: string | null;
  /** Canonical locale stored in DB `name` / `description`; other locales live under `translations`. */
  restaurantDefaultLocale?: Locale;
  /** Flat list of menu items (e.g. for upsell offer picker). */
  allMenuItems?: MenuItem[];
  /** Reload menu from API after upsell mutations (keeps drawer item in sync). */
  onRefreshMenu?: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<MenuItem>) => Promise<void>;
};

function buildPatchFromForm(
  item: MenuItem | null,
  locale: Locale,
  restaurantDefaultLocale: Locale,
  name: string,
  description: string,
  basePrice: number,
  imageUrl: string | null,
  dietaryIcons: DietaryIconId[],
): Partial<MenuItem> {
  const metadata = buildMetadataWithDietaryIcons(
    item?.metadata ?? null,
    dietaryIcons,
  );

  if (!item) {
    return {
      name: name.trim(),
      description,
      base_price: basePrice,
      image_url: imageUrl,
      metadata,
    };
  }

  const patch: Partial<MenuItem> = { base_price: basePrice, metadata };
  const trimmedName = name.trim();

  let nextTranslations: TranslationsMap = {
    ...(item.translations ?? {}),
    [locale]: {
      ...(item.translations?.[locale] ?? {}),
      name,
      description,
    },
  };

  if (locale === restaurantDefaultLocale) {
    const otherLocale: Locale = restaurantDefaultLocale === "en" ? "he" : "en";
    const otherBucket = nextTranslations[otherLocale] ?? {};
    const otherNameMissing =
      typeof otherBucket.name !== "string" || otherBucket.name.trim().length === 0;
    const otherDescMissing =
      otherBucket === undefined || typeof otherBucket.description !== "string";

    const additions: Record<string, string> = {};

    if (otherNameMissing && shouldCopyBaseFieldToOtherLocale(item.name, otherLocale)) {
      additions.name = item.name;
    }
    if (
      otherDescMissing &&
      typeof item.description === "string" &&
      shouldCopyBaseFieldToOtherLocale(item.description, otherLocale)
    ) {
      additions.description = item.description;
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

    patch.name = trimmedName;
    patch.description = description;
  }

  patch.translations = nextTranslations;
  patch.image_url = imageUrl;

  return patch;
}

function placeholderMenuItem(tempId: string, patch: Partial<MenuItem>): MenuItem {
  return {
    id: tempId,
    name: patch.name ?? "",
    description: typeof patch.description === "string" ? patch.description : "",
    base_price: patch.base_price ?? 0,
    is_available: true,
    sort_order: patch.sort_order ?? 0,
    image_url: patch.image_url ?? null,
    metadata: patch.metadata,
    translations: patch.translations,
    variants: [],
    upsell_rules: [],
  };
}

export { placeholderMenuItem };

export default function EditItemDrawer({
  restaurantSlug,
  item,
  categoryId = null,
  restaurantDefaultLocale = "en",
  allMenuItems = [],
  onRefreshMenu,
  isOpen,
  onClose,
  onSave,
}: EditItemDrawerProps) {
  const locale = useUiStore((state) => state.locale);
  const isRtl = isRtlLocale(locale);
  const isCreateMode = !item;

  const [activeTab, setActiveTab] = useState<EditTabId>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isImageRemoving, setIsImageRemoving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDietaryIcons, setSelectedDietaryIcons] = useState<DietaryIconId[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveTab("general");
    setIsSaving(false);

    if (isCreateMode) {
      setName("");
      setDescription("");
      setBasePrice("");
      setImageUrl(null);
      setImageError(null);
      setIsImageUploading(false);
      setIsImageRemoving(false);
      setSelectedDietaryIcons([]);
      return;
    }

    setName(getLocalizedText(item, "name", locale));
    setDescription(getLocalizedText(item, "description", locale));
    setBasePrice(String(item.base_price ?? ""));
    setImageUrl(item.image_url ?? null);
    setImageError(null);
    setIsImageUploading(false);
    setIsImageRemoving(false);
    setSelectedDietaryIcons(parseDietaryIcons(item.metadata));
  }, [isOpen, item, locale, isCreateMode]);

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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, isSaving]);

  if (!isOpen) {
    return null;
  }

  if (isCreateMode && !categoryId) {
    return null;
  }

  const tabs: { id: EditTabId; label: string }[] = [
    { id: "general", label: getUiMessage("tabGeneral", locale) },
    { id: "translations", label: getUiMessage("tabTranslations", locale) },
    { id: "upsells", label: getUiMessage("tabUpsells", locale) },
  ];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (isCreateMode && !trimmedName) {
      return;
    }

    const parsedPrice = Number(basePrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return;
    }

    const patch = buildPatchFromForm(
      item,
      locale,
      restaurantDefaultLocale,
      trimmedName,
      description,
      parsedPrice,
      imageUrl,
      selectedDietaryIcons,
    );

    setIsSaving(true);
    try {
      await onSave(patch);
    } finally {
      setIsSaving(false);
    }
  };

  const drawerTitleId = "edit-item-drawer-title";
  const isImageBusy = isImageUploading || isImageRemoving;

  const handlePickImageClick = () => {
    if (isImageBusy || isSaving) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImageInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const pickedFile = event.target.files?.[0];
    event.target.value = "";
    if (!pickedFile) {
      return;
    }
    if (!pickedFile.type.startsWith("image/")) {
      setImageError(getUiMessage("selectImageFileError", locale));
      return;
    }

    setImageError(null);
    setIsImageUploading(true);
    try {
      const uploadedUrl = await uploadOwnerImage(restaurantSlug, pickedFile);
      setImageUrl(uploadedUrl);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : getUiMessage("imageUploadFailed", locale),
      );
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!imageUrl || isImageBusy || isSaving) {
      return;
    }
    setImageError(null);
    setIsImageRemoving(true);
    try {
      await deleteOwnerImage(restaurantSlug, imageUrl);
      setImageUrl(null);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : getUiMessage("imageRemoveFailed", locale),
      );
    } finally {
      setIsImageRemoving(false);
    }
  };

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
                ? getUiMessage("createItemEyebrow", locale)
                : getUiMessage("editItemSectionTitle", locale)}
            </p>
            <h2 id={drawerTitleId} className="mt-1 truncate text-lg font-bold text-zinc-900">
              {isCreateMode
                ? getUiMessage("createItemMainTitle", locale)
                : getLocalizedText(item!, "name", locale)}
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
                    required={isCreateMode}
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
                <DietaryIconPicker
                  locale={locale}
                  selected={selectedDietaryIcons}
                  onChange={setSelectedDietaryIcons}
                  disabled={isSaving}
                />
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    {getUiMessage("imageManagementTitle", locale)}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageInputChange}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePickImageClick}
                      disabled={isImageBusy || isSaving}
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isImageUploading ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {getUiMessage("uploading", locale)}
                        </>
                      ) : (
                        getUiMessage("uploadImage", locale)
                      )}
                    </button>
                    {hasRenderableImage(imageUrl) ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveImage()}
                        disabled={isImageBusy || isSaving}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                      >
                        {isImageRemoving ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                            {getUiMessage("removing", locale)}
                          </>
                        ) : (
                          getUiMessage("removeImage", locale)
                        )}
                      </button>
                    ) : null}
                  </div>
                  {hasRenderableImage(imageUrl) ? (
                    <div className="mt-3 h-20 w-20 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <img
                        src={imageUrl!}
                        alt={getUiMessage("itemImagePreviewAlt", locale)}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  {imageError ? <p className="mt-2 text-xs text-red-600">{imageError}</p> : null}
                </div>
              </div>
            ) : null}

            {activeTab === "translations" ? (
              <p className="text-sm text-zinc-500">
                {getUiMessage("translationsComingSoon", locale)}
              </p>
            ) : null}

            {activeTab === "upsells" ? (
              !item ? (
                <p className="text-sm text-zinc-500">
                  {getUiMessage("upsellUpsellsNeedSavedItem", locale)}
                </p>
              ) : onRefreshMenu ? (
                <UpsellTab
                  restaurantSlug={restaurantSlug}
                  triggerItemId={item.id}
                  upsellRules={item.upsell_rules}
                  allMenuItems={allMenuItems}
                  locale={locale}
                  isRtl={isRtl}
                  onRefreshMenu={onRefreshMenu}
                />
              ) : (
                <p className="text-sm text-zinc-500">{getUiMessage("upsellsComingSoon", locale)}</p>
              )
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
                    {isCreateMode
                      ? getUiMessage("creatingItem", locale)
                      : getUiMessage("saving", locale)}
                  </span>
                ) : isCreateMode ? (
                  getUiMessage("createItemButton", locale)
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
