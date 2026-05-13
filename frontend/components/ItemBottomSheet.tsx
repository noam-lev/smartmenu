"use client";

import { useState } from "react";
import type { Locale, MenuItem, UpsellRule } from "../types/menu";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { formatILSCurrency } from "../utils/currency";
import { getLocalizedText } from "../utils/i18n";
import { hasRenderableImage } from "../utils/media";

type ItemBottomSheetProps = {
  selectedItem: MenuItem | null;
  isUpsellStep: boolean;
  quantity: number;
  locale: Locale;
  upsellRule?: UpsellRule;
  labels: {
    quantity: string;
    addToOrder: string;
    suggestedAddon: string;
    noThanks: string;
    add: string;
  };
  onClose: () => void;
  onQuantityChange: (nextQuantity: number) => void;
  onPrimaryAdd: () => void;
  onUpsellDecision: (accept: boolean) => void;
};

export default function ItemBottomSheet({
  selectedItem,
  isUpsellStep,
  quantity,
  locale,
  upsellRule,
  labels,
  onClose,
  onQuantityChange,
  onPrimaryAdd,
  onUpsellDecision,
}: ItemBottomSheetProps) {
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const { sheetOffsetY, sheetDragging, dragHandlers } = useDraggableSheet({
    onDismiss: onClose,
  });
  useLockBodyScroll(Boolean(selectedItem));

  if (!selectedItem) {
    return null;
  }

  const itemName = getLocalizedText(selectedItem, "name", locale);
  const itemDescription = getLocalizedText(selectedItem, "description", locale);
  const upsellItemName = upsellRule
    ? getLocalizedText(upsellRule.offer_item_snapshot, "name", locale)
    : "";
  const upsellMessage = upsellRule
    ? getLocalizedText(upsellRule, "custom_message", locale)
    : "";
  const mainImageUrl = hasRenderableImage(selectedItem.image_url)
    ? selectedItem.image_url
    : null;
  const upsellImageUrl = upsellRule?.offer_item_snapshot.image_url;
  const upsellImageKey = hasRenderableImage(upsellImageUrl) ? upsellImageUrl : null;
  const upsellPrice = upsellRule
    ? upsellRule.discount_price ?? upsellRule.offer_item_snapshot.price
    : 0;
  const hasMainImage = mainImageUrl ? !failedImageUrls[mainImageUrl] : false;
  const hasUpsellImage = upsellImageKey ? !failedImageUrls[upsellImageKey] : false;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md overscroll-contain rounded-t-3xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl will-change-transform"
        style={{
          transform: `translateY(${sheetOffsetY}px)`,
          transition: sheetDragging
            ? "none"
            : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="-mx-4 -mt-2 flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          {...dragHandlers}
          role="presentation"
        >
          <div className="h-1.5 w-12 rounded-full bg-zinc-200" />
        </div>

        {!isUpsellStep ? (
          <>
            {hasMainImage && mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt={itemName}
                className="h-44 w-full rounded-2xl object-cover"
                onError={(event) => {
                  const failedUrl =
                    event.currentTarget.currentSrc || mainImageUrl;
                  if (!failedUrl) {
                    return;
                  }
                  setFailedImageUrls((prev) => ({ ...prev, [failedUrl]: true }));
                }}
              />
            ) : null}
            <h3 className="mt-4 text-xl font-bold text-zinc-900">
              {itemName}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {itemDescription}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-600">{labels.quantity}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                >
                  -
                </button>
                <span className="min-w-6 text-center text-base font-semibold text-zinc-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(quantity + 1)}
                  className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onPrimaryAdd}
              className="mt-5 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white active:scale-[0.995]"
            >
              {labels.addToOrder} -{" "}
              {formatILSCurrency(selectedItem.base_price * quantity)}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {labels.suggestedAddon}
            </p>
            <h3 className="mt-1 text-xl font-bold text-zinc-900">
              {upsellItemName}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {upsellMessage}
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 p-3">
              {hasUpsellImage && upsellImageKey ? (
                <img
                  src={upsellImageKey}
                  alt={upsellItemName}
                  className="h-16 w-16 rounded-xl object-cover"
                  onError={(event) => {
                    const failedUrl =
                      event.currentTarget.currentSrc || upsellImageKey;
                    if (!failedUrl) {
                      return;
                    }
                    setFailedImageUrls((prev) => ({ ...prev, [failedUrl]: true }));
                  }}
                />
              ) : null}
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {upsellItemName}
                </p>
                <p className="text-sm text-zinc-500">
                  {formatILSCurrency(upsellPrice)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpsellDecision(false)}
                className="rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 active:scale-[0.99]"
              >
                {labels.noThanks}
              </button>
              <button
                type="button"
                onClick={() => onUpsellDecision(true)}
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
              >
                {labels.add} {formatILSCurrency(upsellPrice)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
