"use client";

import type { StepProps } from "./types";

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function StepRestaurantInfo({ state, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-900">Restaurant Info</h2>
      <p className="text-sm text-zinc-500">Enter the restaurant name and URL slug.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Restaurant Name <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => {
              const next = e.target.value;
              onChange({
                name: next,
                ...(!state.isSlugManual ? { slug: toSlug(next) } : {}),
              });
            }}
            placeholder="Hummus Yossi"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Slug <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={state.slug}
            onChange={(e) =>
              onChange({ slug: toSlug(e.target.value), isSlugManual: true })
            }
            placeholder="hummus-yossi"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
          />
          <span className="mt-1 block text-xs text-zinc-400">
            This will be the restaurant URL path
          </span>
        </label>
      </div>
    </div>
  );
}
