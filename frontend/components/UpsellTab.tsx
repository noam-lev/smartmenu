"use client";

import { useState } from "react";
import type { Locale, MenuItem, UpsellRule } from "../types/menu";
import { useDialogs } from "../context/DialogProvider";
import { createUpsellRule, deleteUpsellRule, updateUpsellRule } from "../lib/menuApi";
import { getLocalizedText, getUiMessage } from "../utils/i18n";

export type UpsellTabProps = {
  restaurantSlug: string;
  triggerItemId: string;
  upsellRules: UpsellRule[];
  allMenuItems: MenuItem[];
  locale: Locale;
  isRtl: boolean;
  onRefreshMenu: () => Promise<void>;
};

export default function UpsellTab({
  restaurantSlug,
  triggerItemId,
  upsellRules,
  allMenuItems,
  locale,
  isRtl,
  onRefreshMenu,
}: UpsellTabProps) {
  const { confirm, alert } = useDialogs();

  const offerCandidates = allMenuItems.filter(
    (m) => m.id !== triggerItemId && !m.id.startsWith("temp-"),
  );

  const [offerItemId, setOfferItemId] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOfferChange = (nextId: string) => {
    setOfferItemId(nextId);
    if (!nextId) {
      return;
    }
    const picked = allMenuItems.find((m) => m.id === nextId);
    if (picked) {
      setDiscountPrice(String(picked.base_price));
    }
  };

  const handleAddRule = async () => {
    if (!offerItemId) {
      return;
    }
    const price = Number(discountPrice);
    if (!Number.isFinite(price) || price < 0) {
      return;
    }

    setIsAdding(true);
    try {
      await createUpsellRule(restaurantSlug, triggerItemId, {
        offer_item_id: offerItemId,
        discount_price: price,
        custom_message: newMessage.trim() || undefined,
      });
      setOfferItemId("");
      setDiscountPrice("");
      setNewMessage("");
      await onRefreshMenu();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (rule: UpsellRule) => {
    if (!rule.id) {
      return;
    }
    setEditingRuleId(rule.id);
    setEditMessageDraft(getLocalizedText(rule, "custom_message", locale));
  };

  const cancelEdit = () => {
    setEditingRuleId(null);
    setEditMessageDraft("");
  };

  const saveEdit = async () => {
    if (!editingRuleId) {
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateUpsellRule(restaurantSlug, editingRuleId, locale, {
        message: editMessageDraft,
      });
      cancelEdit();
      await onRefreshMenu();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteRule = async (rule: UpsellRule) => {
    if (!rule.id) {
      return;
    }

    const confirmed = await confirm({
      title: getUiMessage("upsellConfirmDeleteUpsellTitle", locale),
      message: getUiMessage("upsellConfirmDeleteUpsellBody", locale),
      variant: "danger",
      confirmLabel: getUiMessage("dialogConfirmDelete", locale),
      cancelLabel: getUiMessage("cancel", locale),
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteUpsellRule(restaurantSlug, rule.id);
      if (editingRuleId === rule.id) {
        cancelEdit();
      }
      await onRefreshMenu();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    }
  };

  const addDisabled =
    isAdding || !offerItemId || !Number.isFinite(Number(discountPrice)) || Number(discountPrice) < 0;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {getUiMessage("upsellNewRuleHeading", locale)}
        </p>
        <div>
          <label htmlFor="upsell-offer" className="text-xs font-semibold text-zinc-600">
            {getUiMessage("upsellOfferItemLabel", locale)}
          </label>
          <select
            id="upsell-offer"
            value={offerItemId}
            onChange={(event) => handleOfferChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
          >
            <option value="">{getUiMessage("upsellSelectOffer", locale)}</option>
            {offerCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {getLocalizedText(m, "name", locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="upsell-discount" className="text-xs font-semibold text-zinc-600">
            {getUiMessage("upsellDiscountPriceLabel", locale)}
          </label>
          <input
            id="upsell-discount"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={discountPrice}
            onChange={(event) => setDiscountPrice(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
          />
        </div>
        <div>
          <label htmlFor="upsell-new-message" className="text-xs font-semibold text-zinc-600">
            {getUiMessage("upsellMessageLabel", locale)}
          </label>
          <textarea
            id="upsell-new-message"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            rows={2}
            className="mt-1 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-5 text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAddRule()}
          disabled={addDisabled}
          className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAdding ? getUiMessage("upsellSavingUpsell", locale) : getUiMessage("upsellAddRule", locale)}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {getUiMessage("upsellExistingRulesTitle", locale)}
        </p>
        {upsellRules.length === 0 ? (
          <p className="text-sm text-zinc-500">{getUiMessage("upsellNoRules", locale)}</p>
        ) : (
          <ul className="space-y-3">
            {upsellRules.map((rule) => {
              const offerName = getLocalizedText(rule.offer_item_snapshot, "name", locale);
              const ruleId = rule.id;
              const isEditing = Boolean(ruleId && editingRuleId === ruleId);
              const canMutate = Boolean(ruleId);

              return (
                <li
                  key={ruleId ?? `${offerName}-${rule.discount_price ?? ""}`}
                  className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">{offerName}</p>
                      {rule.discount_price != null ? (
                        <p className="text-xs text-zinc-500">
                          {getUiMessage("upsellDiscountPriceLabel", locale)}: {rule.discount_price}
                        </p>
                      ) : null}
                    </div>
                    {canMutate ? (
                      <div className="flex shrink-0 gap-1">
                        {isEditing ? null : (
                          <button
                            type="button"
                            onClick={() => startEdit(rule)}
                            className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-800 active:scale-[0.98]"
                          >
                            {getUiMessage("upsellEditMessage", locale)}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteRule(rule)}
                          className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 active:scale-[0.98]"
                        >
                          {getUiMessage("upsellDeleteRule", locale)}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editMessageDraft}
                        onChange={(event) => setEditMessageDraft(event.target.value)}
                        rows={3}
                        className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-5 text-zinc-900 outline-none focus:border-zinc-400"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={isSavingEdit}
                          className="flex-1 rounded-full bg-zinc-900 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {isSavingEdit
                            ? getUiMessage("upsellSavingUpsell", locale)
                            : getUiMessage("upsellSave", locale)}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isSavingEdit}
                          className="flex-1 rounded-full border border-zinc-300 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-50"
                        >
                          {getUiMessage("cancel", locale)}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-600">
                      {getLocalizedText(rule, "custom_message", locale) || "—"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
