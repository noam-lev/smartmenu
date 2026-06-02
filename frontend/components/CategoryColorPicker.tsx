"use client";

import type { Locale } from "../types/menu";
import { categoryHeaderStyle } from "../utils/categoryHeaderStyle";
import { getUiMessage } from "../utils/i18n";

/** Restaurant-friendly presets: warm, soft, appetizing — not neon. */
export const CATEGORY_HEADER_COLOR_PRESETS = [
  "#faf6f0",
  "#fdf4e8",
  "#fceee3",
  "#fff8e8",
  "#f3f0e8",
  "#eef5ee",
  "#e8f2f0",
  "#f5ebe8",
  "#ede9f5",
  "#e8eef5",
] as const;

type CategoryColorPickerProps = {
  locale: Locale;
  value: string | null;
  onChange: (color: string | null) => void;
  previewLabel: string;
  disabled?: boolean;
};

export default function CategoryColorPicker({
  locale,
  value,
  onChange,
  previewLabel,
  disabled = false,
}: CategoryColorPickerProps) {
  const previewStyle = categoryHeaderStyle(value);

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold text-zinc-600">
        {getUiMessage("categoryHeaderColorLabel", locale)}
      </p>

      <div
        className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${
          value ? "border-transparent" : "border-b border-zinc-200 bg-white text-zinc-900"
        }`}
        style={previewStyle}
        aria-hidden
      >
        {previewLabel || "—"}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            value === null
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          } disabled:opacity-50`}
        >
          {getUiMessage("categoryHeaderColorDefault", locale)}
        </button>
        {CATEGORY_HEADER_COLOR_PRESETS.map((preset) => {
          const selected = value?.toLowerCase() === preset;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset)}
              aria-label={preset}
              aria-pressed={selected}
              className={`h-9 w-9 shrink-0 rounded-full border-2 shadow-sm transition active:scale-95 disabled:opacity-50 ${
                selected ? "border-zinc-900 ring-2 ring-zinc-400 ring-offset-1" : "border-white"
              }`}
              style={{ backgroundColor: preset }}
            />
          );
        })}
      </div>

      <label className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600">
          {getUiMessage("categoryHeaderColorCustom", locale)}
        </span>
        <input
          type="color"
          disabled={disabled}
          value={value ?? "#faf6f0"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-0.5 disabled:opacity-50"
        />
        {value ? (
          <span className="font-mono text-xs text-zinc-500">{value}</span>
        ) : null}
      </label>
    </div>
  );
}
