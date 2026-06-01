import type { SelectedModifier } from "./cart";
import type { ModifierGroup, ModifierOption } from "../types/menu";

export type ModifierSelectionState = Record<string, string[]>;

export function getAvailableOptions(group: ModifierGroup): ModifierOption[] {
  return [...group.options]
    .filter((opt) => opt.is_available !== false)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

export function buildInitialModifierSelection(
  groups: ModifierGroup[],
): ModifierSelectionState {
  const state: ModifierSelectionState = {};
  for (const group of groups) {
    const available = getAvailableOptions(group);
    const defaults = available
      .filter((opt) => opt.is_default)
      .map((opt) => opt.id);
    if (defaults.length === 0) {
      state[group.id] = [];
      continue;
    }
    const max = Math.max(1, group.max_select);
    state[group.id] = defaults.slice(0, max);
  }
  return state;
}

export function isRadioGroup(group: ModifierGroup): boolean {
  return group.max_select <= 1;
}

export function countSelectedInGroup(
  state: ModifierSelectionState,
  groupId: string,
): number {
  return (state[groupId] ?? []).filter(Boolean).length;
}

export function isModifierSelectionValid(
  groups: ModifierGroup[],
  state: ModifierSelectionState,
): boolean {
  for (const group of groups) {
    const available = getAvailableOptions(group);
    if (available.length === 0) {
      continue;
    }
    const count = countSelectedInGroup(state, group.id);
    if (count < group.min_select || count > group.max_select) {
      return false;
    }
  }
  return true;
}

/** Items without modifier UI skip validation; items with groups must satisfy min/max. */
export function canAddItemToOrder(
  groups: ModifierGroup[],
  state: ModifierSelectionState,
): boolean {
  if (groups.length === 0) {
    return true;
  }
  return isModifierSelectionValid(groups, state);
}

/** Single-choice group: tap again to clear when optional (min_select === 0). */
export function toggleRadioOption(
  state: ModifierSelectionState,
  group: ModifierGroup,
  optionId: string,
): ModifierSelectionState {
  const groupId = group.id;
  const current = state[groupId] ?? [];
  if (current.includes(optionId)) {
    if (group.min_select === 0) {
      return { ...state, [groupId]: [] };
    }
    return state;
  }
  return { ...state, [groupId]: [optionId] };
}

export function toggleCheckboxOption(
  state: ModifierSelectionState,
  group: ModifierGroup,
  optionId: string,
): ModifierSelectionState {
  const groupId = group.id;
  const current = state[groupId] ?? [];
  if (current.includes(optionId)) {
    return {
      ...state,
      [groupId]: current.filter((id) => id !== optionId),
    };
  }
  if (current.length >= group.max_select) {
    return state;
  }
  return { ...state, [groupId]: [...current, optionId] };
}

export function buildSelectedModifiers(
  groups: ModifierGroup[],
  state: ModifierSelectionState,
): SelectedModifier[] {
  const rows: SelectedModifier[] = [];
  for (const group of groups) {
    const available = getAvailableOptions(group);
    const byId = new Map(available.map((opt) => [opt.id, opt]));
    for (const optionId of state[group.id] ?? []) {
      const opt = byId.get(optionId);
      if (!opt) {
        continue;
      }
      rows.push({
        groupId: group.id,
        optionId: opt.id,
        groupName: group.name,
        optionName: opt.name,
        priceDelta: Number(opt.price_delta) || 0,
      });
    }
  }
  return rows;
}
