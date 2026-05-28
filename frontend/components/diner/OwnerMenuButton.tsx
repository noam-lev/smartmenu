"use client";

import { Menu } from "lucide-react";
import type { Locale } from "../../types/menu";
import { getUiMessage } from "../../utils/i18n";

type OwnerMenuButtonProps = {
  locale: Locale;
  onClick: () => void;
};

/** Hamburger control that opens {@link OwnerDrawer} (diner + admin). */
export default function OwnerMenuButton({ locale, onClick }: OwnerMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white p-2 text-zinc-700 shadow-sm"
      aria-label={getUiMessage("ownerDrawerOpenMenu", locale)}
      aria-haspopup="dialog"
    >
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  );
}
