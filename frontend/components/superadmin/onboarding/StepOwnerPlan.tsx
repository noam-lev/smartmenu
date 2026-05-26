"use client";

import type { StepProps } from "./types";

const PLAN_TIERS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
] as const;

export default function StepOwnerPlan({ state, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-900">Owner & Plan</h2>
      <p className="text-sm text-zinc-500">
        Optionally assign an owner and choose a subscription tier.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Owner Email (optional)
          </span>
          <input
            type="email"
            value={state.ownerEmail}
            onChange={(e) => onChange({ ownerEmail: e.target.value })}
            placeholder="owner@example.com"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
          />
          <span className="mt-1 block text-xs text-zinc-400">
            If not found, a magic-link invite will be sent automatically.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Plan Tier
          </span>
          <select
            value={state.planTier}
            onChange={(e) => onChange({ planTier: e.target.value })}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
          >
            {PLAN_TIERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
