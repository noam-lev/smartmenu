"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "../types/menu";
import {
  DIETARY_ICON_OPTIONS,
  dietaryIconAriaLabel,
  dietaryIconLabel,
  type DietaryIconId,
} from "../lib/dietaryIcons";
import { getUiMessage } from "../utils/i18n";

type DietaryIconBadgesProps = {
  icons: DietaryIconId[];
  locale: Locale;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: {
    wrap: "gap-1",
    badge: "h-6 w-6",
    icon: "h-3.5 w-3.5",
    tooltip: "text-[11px] px-2 py-1",
  },
  md: {
    wrap: "gap-1.5",
    badge: "h-7 w-7",
    icon: "h-4 w-4",
    tooltip: "text-xs px-2.5 py-1",
  },
} as const;

type DietaryIconBadgeProps = {
  id: DietaryIconId;
  locale: Locale;
  size: "sm" | "md";
};

function DietaryIconBadge({ id, locale, size }: DietaryIconBadgeProps) {
  const option = DIETARY_ICON_OPTIONS.find((entry) => entry.id === id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [tapOpen, setTapOpen] = useState(false);

  useEffect(() => {
    if (!tapOpen) {
      return;
    }

    const close = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) {
        return;
      }
      setTapOpen(false);
    };

    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [tapOpen]);

  if (!option) {
    return null;
  }

  const classes = sizeClasses[size];
  const Icon = option.icon;
  const label = dietaryIconLabel(id, locale);
  const showTooltip = tapOpen;

  return (
    <span role="listitem" className="inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={dietaryIconAriaLabel(id, locale)}
        aria-describedby={showTooltip ? tooltipId : undefined}
        aria-expanded={showTooltip}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setTapOpen((open) => !open);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className={`group/badge relative inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 outline-none transition-colors hover:border-zinc-300 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${classes.badge}`}
      >
        <span
          id={tooltipId}
          role="tooltip"
          aria-hidden={!showTooltip}
          className={`pointer-events-none absolute bottom-[calc(100%+0.375rem)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 font-medium text-white shadow-lg transition-all duration-200 ease-out ${classes.tooltip} ${
            showTooltip
              ? "visible translate-y-0 opacity-100"
              : "invisible translate-y-0.5 opacity-0 group-hover/badge:visible group-hover/badge:translate-y-0 group-hover/badge:opacity-100 group-focus-visible/badge:visible group-focus-visible/badge:translate-y-0 group-focus-visible/badge:opacity-100"
          }`}
        >
          {label}
          <span
            className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-zinc-900"
            aria-hidden
          />
        </span>
        <Icon
          className={`${classes.icon} ${option.badgeIconClassName}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
    </span>
  );
}

export default function DietaryIconBadges({
  icons,
  locale,
  size = "sm",
}: DietaryIconBadgesProps) {
  if (icons.length === 0) {
    return null;
  }

  const classes = sizeClasses[size];

  return (
    <span
      className={`inline-flex shrink-0 flex-wrap items-center ${classes.wrap}`}
      role="list"
      aria-label={getUiMessage("dietaryIconsSection", locale)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {icons.map((id) => (
        <DietaryIconBadge key={id} id={id} locale={locale} size={size} />
      ))}
    </span>
  );
}
