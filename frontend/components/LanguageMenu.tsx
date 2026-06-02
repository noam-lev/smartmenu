"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "../types/menu";
import { getUiMessage, isRtlLocale, localeFlagSrc } from "../utils/i18n";

type LanguageMenuProps = {
  locale: Locale;
  supportedLocales: Locale[];
  onLocaleChange: (next: Locale) => void;
  className?: string;
};

function localeLabelKey(code: Locale): "languageHebrew" | "languageEnglish" {
  return code === "he" ? "languageHebrew" : "languageEnglish";
}

export default function LanguageMenu({
  locale,
  supportedLocales,
  onLocaleChange,
  className = "",
}: LanguageMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isRtl = isRtlLocale(locale);

  const alternateLocales = supportedLocales.filter((code) => code !== locale);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  if (supportedLocales.length <= 1) {
    return null;
  }

  return (
    <div className={`relative ${className}`.trim()} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={getUiMessage("selectLanguage", locale)}
        className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
      >
        <img
          src={localeFlagSrc[locale]}
          alt=""
          className="h-4 w-[1.375rem] rounded-[2px] object-cover"
          aria-hidden
        />
        <span className="text-[10px] text-zinc-500">▾</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className={`absolute z-30 mt-2 min-w-[3rem] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg ${
            isRtl ? "left-0" : "right-0"
          }`}
        >
          {alternateLocales.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitem"
              aria-label={getUiMessage(localeLabelKey(code), locale)}
              onClick={() => {
                onLocaleChange(code);
                setIsOpen(false);
              }}
              className="flex w-full justify-center rounded-lg px-3 py-2 hover:bg-zinc-100"
            >
              <img
                src={localeFlagSrc[code]}
                alt=""
                className="h-4 w-[1.375rem] rounded-[2px] object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
