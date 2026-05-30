import type { LucideIcon } from "lucide-react";
import { Flame, Leaf, Vegan, WheatOff } from "lucide-react";
import type { Locale } from "../types/menu";
import { getUiMessage, getUiTemplate, type UiMessageKey } from "../utils/i18n";

export const DIETARY_ICON_IDS = [
  "gluten_free",
  "vegetarian",
  "vegan",
  "spicy",
] as const;

export type DietaryIconId = (typeof DIETARY_ICON_IDS)[number];

const DIETARY_ICON_ID_SET = new Set<string>(DIETARY_ICON_IDS);

export function isDietaryIconId(value: string): value is DietaryIconId {
  return DIETARY_ICON_ID_SET.has(value);
}

export function parseDietaryIcons(
  metadata: Record<string, unknown> | null | undefined,
): DietaryIconId[] {
  const raw = metadata?.dietary_icons;
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<DietaryIconId>();
  const result: DietaryIconId[] = [];
  for (const entry of raw) {
    const code = typeof entry === "string" ? entry : String(entry ?? "");
    if (!isDietaryIconId(code) || seen.has(code)) {
      continue;
    }
    seen.add(code);
    result.push(code);
  }
  return DIETARY_ICON_IDS.filter((id) => seen.has(id));
}

export function buildMetadataWithDietaryIcons(
  existing: Record<string, unknown> | null | undefined,
  icons: DietaryIconId[],
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  if (icons.length > 0) {
    base.dietary_icons = [...icons];
  } else {
    delete base.dietary_icons;
  }
  return base;
}

type DietaryIconOption = {
  id: DietaryIconId;
  icon: LucideIcon;
  labelKey: UiMessageKey;
  /** Distinct badge tint so similar glyphs (e.g. Leaf vs Vegan) read clearly at a glance. */
  badgeIconClassName: string;
};

export const DIETARY_ICON_OPTIONS: DietaryIconOption[] = [
  {
    id: "gluten_free",
    icon: WheatOff,
    labelKey: "dietaryGlutenFree",
    badgeIconClassName: "text-amber-700",
  },
  {
    id: "vegetarian",
    icon: Leaf,
    labelKey: "dietaryVegetarian",
    badgeIconClassName: "text-emerald-600",
  },
  {
    id: "vegan",
    icon: Vegan,
    labelKey: "dietaryVegan",
    badgeIconClassName: "text-green-800",
  },
  {
    id: "spicy",
    icon: Flame,
    labelKey: "dietarySpicy",
    badgeIconClassName: "text-red-600",
  },
];

export function dietaryIconLabel(id: DietaryIconId, locale: Locale): string {
  const option = DIETARY_ICON_OPTIONS.find((entry) => entry.id === id);
  return option ? getUiMessage(option.labelKey, locale) : id;
}

export function dietaryIconAriaLabel(id: DietaryIconId, locale: Locale): string {
  return getUiTemplate("dietaryIconAria", locale, {
    label: dietaryIconLabel(id, locale),
  });
}
