"use client";

import { create } from "zustand";
import type { Locale } from "../types/menu";

type UiStore = {
  locale: Locale;
  setLocale: (newLocale: Locale) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  locale: "he",
  setLocale: (newLocale) => set({ locale: newLocale }),
}));
