"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import type { StepProps } from "./types";

function Badge({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <Check className="h-3 w-3" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      <X className="h-3 w-3" /> No
    </span>
  );
}

export default function StepReview({ state }: StepProps) {
  const totalCategories = state.parsedMenu?.categories.length ?? 0;
  const totalItems = useMemo(
    () =>
      state.parsedMenu
        ? state.parsedMenu.categories.reduce(
            (s, c) => s + c.items.length,
            0,
          )
        : 0,
    [state.parsedMenu],
  );
  const totalImages = Object.keys(state.itemImages).length;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900">Review & Create</h2>
      <p className="text-sm text-zinc-500">
        Verify everything looks correct before creating the restaurant.
      </p>

      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        <Row label="Name" value={state.name || "—"} />
        <Row label="Slug" value={state.slug || "—"} />
        <Row label="Currency" value={state.currency} />
        <Row label="Default Locale" value={state.defaultLocale} />
        <Row
          label="Menu"
          value={`${totalCategories} categories, ${totalItems} items`}
        />
        <Row label="Banner" value={<Badge yes={!!state.bannerUrl} />} />
        <Row
          label="Dish Photos"
          value={totalImages > 0 ? `${totalImages} uploaded` : "None"}
        />
        <Row label="Owner" value={state.ownerEmail || "Not assigned"} />
        <Row label="Plan" value={state.planTier} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm font-medium text-zinc-600">{label}</span>
      <span className="text-sm font-semibold text-zinc-900">{value}</span>
    </div>
  );
}
