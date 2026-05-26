"use client";

import type { StepProps } from "./types";

const CURRENCIES = [
  { value: "ILS", label: "Shekel (₪)" },
  { value: "USD", label: "Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "HUF", label: "Forint (Ft)" },
] as const;

const LOCALES = [
  { value: "he", label: "Hebrew (he)" },
  { value: "en", label: "English (en)" },
] as const;

export default function StepSettings({ state, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-900">Default Settings</h2>
      <p className="text-sm text-zinc-500">
        Configure the currency and default language for this restaurant.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Currency
          </span>
          <select
            value={state.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Default Locale
          </span>
          <select
            value={state.defaultLocale}
            onChange={(e) => onChange({ defaultLocale: e.target.value })}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
