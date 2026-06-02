"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "../types/menu";
import {
  clampLocaleToSupported,
  parseLangFromSearchParams,
  readLocaleHint,
  resolveTenantLocale,
  supportedLocalesFromRestaurantSettings,
  withLangSearchParams,
  writeLocaleHint,
} from "../lib/tenantLocale";
import { useUiStore } from "../store/uiStore";
import { isRtlLocale, otherLocale } from "../utils/i18n";

type TenantLocaleContextValue = {
  locale: Locale;
  supportedLocales: Locale[];
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  isRtl: boolean;
  /** Call after menu load to apply server default, supported locales, and canonicalize URL. */
  applyServerDefaultLocale: (
    defaultLocale: Locale | undefined,
    settings?: Record<string, unknown> | null,
  ) => void;
};

const TenantLocaleContext = createContext<TenantLocaleContextValue | null>(null);

type TenantLocaleProviderProps = {
  restaurantSlug: string;
  children: ReactNode;
};

export function TenantLocaleProvider({
  restaurantSlug,
  children,
}: TenantLocaleProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const syncUiStore = useUiStore((state) => state.setLocale);

  const urlLang = useMemo(
    () => parseLangFromSearchParams(searchParams),
    [searchParams],
  );

  const storedLang = useMemo(
    () => readLocaleHint(restaurantSlug),
    [restaurantSlug],
  );
  const [serverDefault, setServerDefault] = useState<Locale | null>(null);
  const [supportedLocales, setSupportedLocales] = useState<Locale[] | null>(null);

  useEffect(() => {
    setServerDefault(null);
    setSupportedLocales(null);
  }, [restaurantSlug]);

  const locale = useMemo(
    () =>
      resolveTenantLocale({
        urlLang,
        storedLang,
        serverDefaultLocale: serverDefault,
        supportedLocales,
      }),
    [urlLang, storedLang, serverDefault, supportedLocales],
  );

  useEffect(() => {
    syncUiStore(locale);
  }, [locale, syncUiStore]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const dir = isRtlLocale(locale) ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const replaceWithLang = useCallback(
    (next: Locale) => {
      const href = withLangSearchParams(pathname, next, searchParams);
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      const clamped = clampLocaleToSupported(next, supportedLocales, serverDefault);
      writeLocaleHint(restaurantSlug, clamped);
      syncUiStore(clamped);
      replaceWithLang(clamped);
    },
    [restaurantSlug, supportedLocales, serverDefault, syncUiStore, replaceWithLang],
  );

  const toggleLocale = useCallback(() => {
    const options = supportedLocales ?? (["en", "he"] as Locale[]);
    const currentIndex = options.indexOf(locale);
    const next =
      currentIndex >= 0 && options.length > 1
        ? options[(currentIndex + 1) % options.length]
        : otherLocale(locale);
    setLocale(next);
  }, [locale, supportedLocales, setLocale]);

  const applyServerDefaultLocale = useCallback(
    (defaultLocale: Locale | undefined, settings?: Record<string, unknown> | null) => {
      const nextSupported = supportedLocalesFromRestaurantSettings(settings, defaultLocale);
      setSupportedLocales(nextSupported);
      if (defaultLocale) {
        setServerDefault(defaultLocale);
      }

      const resolved = resolveTenantLocale({
        urlLang,
        storedLang: readLocaleHint(restaurantSlug),
        serverDefaultLocale: defaultLocale,
        supportedLocales: nextSupported,
      });

      if (!urlLang || !nextSupported.includes(urlLang)) {
        writeLocaleHint(restaurantSlug, resolved);
        syncUiStore(resolved);
        replaceWithLang(resolved);
      }
    },
    [restaurantSlug, urlLang, syncUiStore, replaceWithLang],
  );

  const effectiveSupportedLocales = supportedLocales ?? (["en", "he"] as Locale[]);

  const value = useMemo(
    () => ({
      locale,
      supportedLocales: effectiveSupportedLocales,
      setLocale,
      toggleLocale,
      isRtl: isRtlLocale(locale),
      applyServerDefaultLocale,
    }),
    [locale, effectiveSupportedLocales, setLocale, toggleLocale, applyServerDefaultLocale],
  );

  return (
    <TenantLocaleContext.Provider value={value}>
      <div lang={locale} dir={isRtlLocale(locale) ? "rtl" : "ltr"} className="min-h-[100dvh]">
        {children}
      </div>
    </TenantLocaleContext.Provider>
  );
}

export function useTenantLocale(): TenantLocaleContextValue {
  const ctx = useContext(TenantLocaleContext);
  if (!ctx) {
    throw new Error("useTenantLocale must be used within TenantLocaleProvider");
  }
  return ctx;
}
