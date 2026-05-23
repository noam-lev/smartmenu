"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import type { Locale } from "../../../types/menu";
import { getUiMessage, isRtlLocale } from "../../../utils/i18n";
import { ADMIN_SETTINGS_NAV_ITEMS } from "./navItems";
import { renderAdminSettingsSection } from "./sectionRegistry";
import type { AdminSettingsSectionContext, AdminSettingsSectionId } from "./types";

type AdminSettingsDrawerProps = AdminSettingsSectionContext & {
  locale: Locale;
  open: boolean;
  onClose: () => void;
};

export default function AdminSettingsDrawer({
  locale,
  open,
  onClose,
  ...sectionContext
}: AdminSettingsDrawerProps) {
  const isRtl = isRtlLocale(locale);
  const [activeSection, setActiveSection] = useState<AdminSettingsSectionId | null>(null);

  useEffect(() => {
    if (!open) {
      setActiveSection(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeSection) {
          setActiveSection(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, activeSection, onClose]);

  if (!open) {
    return null;
  }

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40"
        aria-label={getUiMessage("adminSettingsClose", locale)}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl ${
          isRtl ? "right-0" : "left-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={getUiMessage("adminSettingsMenuTitle", locale)}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          {activeSection ? (
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700"
            >
              <BackIcon className="h-4 w-4" aria-hidden />
              {getUiMessage("adminSettingsBack", locale)}
            </button>
          ) : (
            <p className="text-sm font-semibold text-zinc-900">
              {getUiMessage("adminSettingsMenuTitle", locale)}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label={getUiMessage("adminSettingsClose", locale)}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeSection ? (
            <div className="p-4">
              {renderAdminSettingsSection(activeSection, {
                locale,
                onClose,
                ...sectionContext,
              })}
            </div>
          ) : (
            <nav className="flex flex-col gap-1 p-3">
              {ADMIN_SETTINGS_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-zinc-600" strokeWidth={1.75} aria-hidden />
                    {getUiMessage(item.labelKey, locale)}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </aside>
    </div>
  );
}

type AdminSettingsMenuButtonProps = {
  locale: Locale;
  onClick: () => void;
};

export function AdminSettingsMenuButton({ locale, onClick }: AdminSettingsMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white p-2 text-zinc-700 shadow-sm"
      aria-label={getUiMessage("adminSettingsOpenMenu", locale)}
      aria-haspopup="dialog"
    >
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  );
}
