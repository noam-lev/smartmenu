"use client";

import type { Locale } from "../types/menu";
import {
  DIETARY_ICON_OPTIONS,
  dietaryIconLabel,
  type DietaryIconId,
} from "../lib/dietaryIcons";
import { getUiMessage, getUiTemplate } from "../utils/i18n";

type DietaryIconPickerProps = {
  locale: Locale;
  selected: DietaryIconId[];
  onChange: (next: DietaryIconId[]) => void;
  disabled?: boolean;
};

export default function DietaryIconPicker({
  locale,
  selected,
  onChange,
  disabled = false,
}: DietaryIconPickerProps) {
  const selectedSet = new Set(selected);

  const toggle = (id: DietaryIconId) => {
    if (disabled) {
      return;
    }
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(DIETARY_ICON_OPTIONS.map((opt) => opt.id).filter((code) => next.has(code)));
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-zinc-700">
          {getUiMessage("dietaryIconsSection", locale)}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {getUiMessage("dietaryIconsHint", locale)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {DIETARY_ICON_OPTIONS.map(({ id, icon: Icon }) => {
          const isOn = selectedSet.has(id);
          const label = dietaryIconLabel(id, locale);
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={label}
              aria-pressed={isOn}
              aria-label={
                isOn
                  ? getUiTemplate("dietaryIconToggleOn", locale, { label })
                  : getUiTemplate("dietaryIconToggleOff", locale, { label })
              }
              onClick={() => toggle(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isOn
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
