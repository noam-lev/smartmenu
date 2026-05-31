import type { TranslationsMap } from "../types/menu";

export type SelectedModifier = {
  groupId: string;
  optionId: string;
  groupName: string;
  optionName: string;
  priceDelta: number;
};

export type CartLine = {
  lineId: string;
  menuItemId: string;
  variantId: string;
  quantity: number;
  selections: SelectedModifier[];
  configKey: string;
  unitPrice: number;
  name: string;
  translations?: TranslationsMap;
  addedAt: string;
  addedBy?: string;
};

/** Stable fingerprint for merge-vs-split cart lines. */
export function buildConfigKey(
  menuItemId: string,
  variantId: string,
  selections: Pick<SelectedModifier, "optionId">[],
): string {
  const optionIds = selections
    .map((entry) => entry.optionId)
    .filter(Boolean)
    .sort();
  return `${menuItemId}|${variantId}|${optionIds.join(",")}`;
}

export function computeUnitPrice(
  variantPrice: number,
  selections: Pick<SelectedModifier, "priceDelta">[],
): number {
  const modifierTotal = selections.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.priceDelta) ? entry.priceDelta : 0),
    0,
  );
  const base = Number.isFinite(variantPrice) ? variantPrice : 0;
  return base + modifierTotal;
}

export function computeLineTotal(unitPrice: number, quantity: number): number {
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const unit = Number.isFinite(unitPrice) ? unitPrice : 0;
  return unit * qty;
}
