"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale, MenuItem, ModifierGroup, UpsellRule } from "../types/menu";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
import { useImageLoadFailure } from "../hooks/useImageLoadFailure";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { useSheetDialogA11y } from "../hooks/useSheetDialogA11y";
import {
  buildInitialModifierSelection,
  buildSelectedModifiers,
  countSelectedInGroup,
  getAvailableOptions,
  canAddItemToOrder,
  isRadioGroup,
  toggleRadioOption,
  toggleCheckboxOption,
  type ModifierSelectionState,
} from "../lib/modifierSelection";
import type { SelectedModifier } from "../lib/cart";
import { computeLineTotal, computeUnitPrice } from "../lib/cart";
import { formatCurrency } from "../utils/currency";
import {
  getLocalizedText,
  getUiMessage,
  getUiTemplate,
  isRtlLocale,
} from "../utils/i18n";
import { hasRenderableImage } from "../utils/media";
import { parseDietaryIcons } from "../lib/dietaryIcons";
import DietaryIconBadges from "./DietaryIconBadges";

type ItemBottomSheetProps = {
  selectedItem: MenuItem | null;
  isUpsellStep: boolean;
  quantity: number;
  locale: Locale;
  currency?: string;
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
  onPrimaryAdd: (selections: SelectedModifier[]) => void;
  onUpsellDecision: (accept: boolean) => void;
};

function groupRequirementHint(group: ModifierGroup, locale: Locale): string {
  const { min_select: min, max_select: max } = group;
  if (min >= 1 && max <= 1) {
    return getUiMessage("dinerModifierRequired", locale);
  }
  if (min === 0 && max <= 1) {
    return getUiMessage("dinerModifierOptional", locale);
  }
  if (min === 0 && max > 1) {
    return getUiTemplate("dinerModifierUpTo", locale, { count: String(max) });
  }
  if (min === max) {
    return getUiTemplate("dinerModifierChooseAtLeast", locale, { count: String(min) });
  }
  return getUiTemplate("dinerModifierChooseBetween", locale, {
    min: String(min),
    max: String(max),
  });
}

function formatExtraPrice(priceDelta: number, locale: Locale): string | null {
  if (!Number.isFinite(priceDelta) || priceDelta <= 0) {
    return null;
  }
  const amount =
    priceDelta % 1 === 0 ? String(Math.round(priceDelta)) : String(priceDelta);
  return getUiTemplate("dinerModifierExtraPrice", locale, { amount });
}

function ModifierOptionControl({
  option,
  locale,
  isSelected,
  controlType,
  onSelect,
}: {
  option: { id: string; name: string; price_delta: number };
  locale: Locale;
  isSelected: boolean;
  controlType: "radio" | "checkbox";
  onSelect: () => void;
}) {
  const extra = formatExtraPrice(option.price_delta, locale);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition active:scale-[0.995] ${
        isSelected
          ? "bg-zinc-900/[0.06] ring-1 ring-zinc-900/15"
          : "bg-zinc-50/80 ring-1 ring-transparent hover:bg-zinc-100/80"
      }`}
      aria-pressed={isSelected}
      aria-label={`${option.name}${extra ? ` ${extra}` : ""}`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition ${
          controlType === "radio" ? "rounded-full" : "rounded-md"
        } ${isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-white"}`}
        aria-hidden
      >
        {isSelected ? (
          controlType === "radio" ? (
            <span className="h-2 w-2 rounded-full bg-white" />
          ) : (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none">
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-900">{option.name}</span>
      </span>
      {extra ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-600">
          {extra}
        </span>
      ) : null}
    </button>
  );
}

function ModifierGroupsSection({
  groups,
  locale,
  isRtl,
  selection,
  onSelectionChange,
}: {
  groups: ModifierGroup[];
  locale: Locale;
  isRtl: boolean;
  selection: ModifierSelectionState;
  onSelectionChange: (next: ModifierSelectionState) => void;
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-5" dir={isRtl ? "rtl" : "ltr"}>
      {groups.map((group) => {
        const available = getAvailableOptions(group);
        if (available.length === 0) {
          return null;
        }
        const radio = isRadioGroup(group);
        const selectedIds = new Set(selection[group.id] ?? []);
        const hint = groupRequirementHint(group, locale);
        const selectedCount = countSelectedInGroup(selection, group.id);
        const needsMore = selectedCount < group.min_select;

        return (
          <section key={group.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-zinc-900">{group.name}</h4>
              <span
                className={`shrink-0 text-xs font-medium ${
                  needsMore ? "text-amber-700" : "text-zinc-400"
                }`}
              >
                {hint}
              </span>
            </div>
            <ul className="space-y-2">
              {available.map((option) => (
                <li key={option.id}>
                  <ModifierOptionControl
                    option={option}
                    locale={locale}
                    isSelected={selectedIds.has(option.id)}
                    controlType={radio ? "radio" : "checkbox"}
                    onSelect={() => {
                      if (radio) {
                        onSelectionChange(toggleRadioOption(selection, group, option.id));
                      } else {
                        onSelectionChange(toggleCheckboxOption(selection, group, option.id));
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function ItemBottomSheet({
  selectedItem,
  isUpsellStep,
  quantity,
  locale,
  currency = "ILS",
  upsellRule,
  labels,
  onClose,
  onQuantityChange,
  onPrimaryAdd,
  onUpsellDecision,
}: ItemBottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isRtl = isRtlLocale(locale);
  const isOpen = Boolean(selectedItem);
  const { hasLoadableImage, createImgErrorHandler } = useImageLoadFailure();
  const { sheetOffsetY, sheetDragging, dragHandlers } = useDraggableSheet({
    onDismiss: onClose,
  });
  useLockBodyScroll(isOpen);
  useSheetDialogA11y({ isOpen, onClose, panelRef });

  const modifierGroups = useMemo(() => {
    if (!selectedItem?.modifier_groups?.length) {
      return [];
    }
    return [...selectedItem.modifier_groups]
      .filter((group) => getAvailableOptions(group).length > 0)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [selectedItem]);

  const [modifierSelection, setModifierSelection] = useState<ModifierSelectionState>({});

  useEffect(() => {
    if (!selectedItem) {
      setModifierSelection({});
      return;
    }
    setModifierSelection(buildInitialModifierSelection(modifierGroups));
  }, [selectedItem?.id, modifierGroups]);

  if (!selectedItem) {
    return null;
  }

  const itemName = getLocalizedText(selectedItem, "name", locale);
  const itemDescription = getLocalizedText(selectedItem, "description", locale);
  const dietaryIcons = parseDietaryIcons(selectedItem.metadata);
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
  const hasMainImage = hasLoadableImage(mainImageUrl);
  const hasUpsellImage = hasLoadableImage(upsellImageKey);

  const primaryVariant = selectedItem.variants[0];
  const variantPrice = primaryVariant?.price ?? selectedItem.base_price;
  const cartSelections = buildSelectedModifiers(modifierGroups, modifierSelection);
  const unitPrice = computeUnitPrice(variantPrice, cartSelections);
  const orderTotal = computeLineTotal(unitPrice, quantity);
  const canAdd = canAddItemToOrder(modifierGroups, modifierSelection);

  const handlePrimaryClick = () => {
    if (!canAdd) {
      return;
    }
    onPrimaryAdd(cartSelections);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-bottom-sheet-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overscroll-contain rounded-t-3xl bg-white shadow-2xl will-change-transform outline-none"
        style={{
          transform: `translateY(${sheetOffsetY}px)`,
          transition: sheetDragging
            ? "none"
            : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="shrink-0 cursor-grab touch-none px-4 pt-3 active:cursor-grabbing"
          {...dragHandlers}
          role="presentation"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" />
        </div>

        {!isUpsellStep ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
              {hasMainImage && mainImageUrl ? (
                <img
                  src={mainImageUrl}
                  alt={itemName}
                  className="h-40 w-full rounded-2xl object-cover"
                  onError={createImgErrorHandler(mainImageUrl)}
                />
              ) : null}
              <div className={`flex flex-wrap items-center gap-2 ${hasMainImage ? "mt-4" : "mt-1"}`}>
                <h3
                  id="item-bottom-sheet-title"
                  className="text-xl font-bold tracking-tight text-zinc-900"
                >
                  {itemName}
                </h3>
                <DietaryIconBadges icons={dietaryIcons} locale={locale} size="md" />
              </div>
              {itemDescription ? (
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                  {itemDescription}
                </p>
              ) : null}

              <ModifierGroupsSection
                groups={modifierGroups}
                locale={locale}
                isRtl={isRtl}
                selection={modifierSelection}
                onSelectionChange={setModifierSelection}
              />
            </div>

            <div className="shrink-0 border-t border-zinc-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-600">{labels.quantity}</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center text-base font-semibold tabular-nums text-zinc-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(quantity + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrimaryClick}
                disabled={!canAdd}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-zinc-900/10 transition active:scale-[0.995] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
              >
                <span>{labels.addToOrder}</span>
                <span className="tabular-nums opacity-90">
                  {formatCurrency(orderTotal, currency)}
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {labels.suggestedAddon}
            </p>
            <h3
              id="item-bottom-sheet-title"
              className="mt-1 text-xl font-bold text-zinc-900"
            >
              {upsellItemName}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{upsellMessage}</p>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
              {hasUpsellImage && upsellImageKey ? (
                <img
                  src={upsellImageKey}
                  alt={upsellItemName}
                  className="h-16 w-16 rounded-xl object-cover"
                  onError={createImgErrorHandler(upsellImageKey)}
                />
              ) : null}
              <div>
                <p className="text-sm font-semibold text-zinc-900">{upsellItemName}</p>
                <p className="text-sm text-zinc-500">
                  {formatCurrency(upsellPrice, currency)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpsellDecision(false)}
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 active:scale-[0.99]"
              >
                {labels.noThanks}
              </button>
              <button
                type="button"
                onClick={() => onUpsellDecision(true)}
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
              >
                {labels.add} {formatCurrency(upsellPrice, currency)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
