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
  parseLangFromSearchParams,
  readLocaleHint,
  resolveTenantLocale,
  withLangSearchParams,
  writeLocaleHint,
} from "../lib/tenantLocale";
import { useUiStore } from "../store/uiStore";
import { isRtlLocale, otherLocale } from "../utils/i18n";

type TenantLocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  isRtl: boolean;
  /** Call after slim menu load to apply server default and canonicalize URL. */
  applyServerDefaultLocale: (defaultLocale: Locale | undefined) => void;
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

  useEffect(() => {
    setServerDefault(null);
  }, [restaurantSlug]);

  const locale = useMemo(
    () =>
      resolveTenantLocale({
        urlLang,
        storedLang: storedLang,
        serverDefaultLocale: serverDefault,
      }),
    [urlLang, storedLang, serverDefault],
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
      writeLocaleHint(restaurantSlug, next);
      syncUiStore(next);
      replaceWithLang(next);
    },
    [restaurantSlug, syncUiStore, replaceWithLang],
  );

  const toggleLocale = useCallback(() => {
    setLocale(otherLocale(locale));
  }, [locale, setLocale]);

  const applyServerDefaultLocale = useCallback(
    (defaultLocale: Locale | undefined) => {
      if (defaultLocale) {
        setServerDefault(defaultLocale);
      }
      if (!urlLang) {
        const resolved = resolveTenantLocale({
          urlLang: null,
          storedLang: readLocaleHint(restaurantSlug),
          serverDefaultLocale: defaultLocale,
        });
        writeLocaleHint(restaurantSlug, resolved);
        syncUiStore(resolved);
        replaceWithLang(resolved);
      }
    },
    [restaurantSlug, urlLang, syncUiStore, replaceWithLang],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      isRtl: isRtlLocale(locale),
      applyServerDefaultLocale,
    }),
    [locale, setLocale, toggleLocale, applyServerDefaultLocale],
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
