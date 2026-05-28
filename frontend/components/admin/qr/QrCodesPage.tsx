"use client";

import { Printer } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import OwnerDrawer from "../../diner/OwnerDrawer";
import OwnerMenuButton from "../../diner/OwnerMenuButton";
import { useAuthUser } from "../../../hooks/useAuthUser";
import { useOwnerDrawerQueryParam } from "../../../hooks/useOwnerDrawerQueryParam";
import { useOwnerRestaurants } from "../../../hooks/useOwnerRestaurants";
import {
  deleteOwnerImage,
  fetchMenuBySlug,
  updateRestaurantQrLogoUrl,
  uploadOwnerImage,
} from "../../../lib/menuApi";
import { getMenuLoadErrorMessage } from "../../../lib/menuFetchError";
import { useUiStore } from "../../../store/uiStore";
import { createClient as createSupabaseBrowserClient } from "../../../utils/supabase/client";
import type { MenuPayload } from "../../../types/menu";
import {
  getLocalizedText,
  getUiMessage,
  getUiTemplate,
  isRtlLocale,
} from "../../../utils/i18n";
import { hasRenderableImage } from "../../../utils/media";
import QrCodeCard from "./QrCodeCard";
import { QR_FALLBACK_LOGO_SRC } from "./fallbackLogo";
import "./qr-print.css";

type QrMode = "general" | "tables";

type QrCodesPageProps = {
  restaurantSlug: string;
};

function buildMenuUrl(origin: string, slug: string, table?: number) {
  const base = `${origin}/${encodeURIComponent(slug)}`;
  if (table == null) {
    return base;
  }
  return `${base}?table=${table}`;
}

export default function QrCodesPage({ restaurantSlug }: QrCodesPageProps) {
  const locale = useUiStore((state) => state.locale);
  const isRtl = isRtlLocale(locale);

  const { userId } = useAuthUser();
  const { restaurants } = useOwnerRestaurants(userId, restaurantSlug);
  const hasRestaurants = restaurants.length > 0;
  const [isOwnerDrawerOpen, setIsOwnerDrawerOpen] = useState(false);
  useOwnerDrawerQueryParam(setIsOwnerDrawerOpen, Boolean(userId && hasRestaurants));

  const [menuPayload, setMenuPayload] = useState<MenuPayload | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<QrMode>("general");
  const [tableCount, setTableCount] = useState(10);
  const [isQrLogoUploading, setIsQrLogoUploading] = useState(false);
  const [isQrLogoRemoving, setIsQrLogoRemoving] = useState(false);
  const [qrLogoError, setQrLogoError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsMenuLoading(true);
    setMenuError(null);

    void fetchMenuBySlug(restaurantSlug)
      .then((data) => {
        if (!cancelled) {
          setMenuPayload(data);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMenuError(getMenuLoadErrorMessage(error, locale));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsMenuLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, locale]);

  const restaurantName = menuPayload
    ? getLocalizedText(menuPayload.restaurant, "name", locale)
    : restaurantSlug;

  const qrLogoUrlFromSettings =
    typeof menuPayload?.restaurant.settings?.qr_logo_url === "string"
      ? menuPayload.restaurant.settings.qr_logo_url.trim()
      : null;
  const currentQrLogoUrl = hasRenderableImage(qrLogoUrlFromSettings)
    ? (qrLogoUrlFromSettings as string)
    : null;
  const bannerUrl =
    menuPayload?.restaurant.banner_url ??
    menuPayload?.restaurant.banner_image_url ??
    null;
  const logoSrc = currentQrLogoUrl
    ? currentQrLogoUrl
    : hasRenderableImage(bannerUrl)
      ? (bannerUrl as string).trim()
      : QR_FALLBACK_LOGO_SRC;

  const qrEntries = useMemo(() => {
    if (!origin) {
      return [];
    }
    if (mode === "general") {
      return [
        {
          key: "general",
          value: buildMenuUrl(origin, restaurantSlug),
          label: getUiMessage("qrGeneralLabel", locale),
          title: `${restaurantName} — ${getUiMessage("qrGeneralLabel", locale)}`,
        },
      ];
    }

    const count = Math.max(1, Math.min(99, Math.floor(tableCount) || 1));
    return Array.from({ length: count }, (_, index) => {
      const tableNumber = index + 1;
      return {
        key: `table-${tableNumber}`,
        value: buildMenuUrl(origin, restaurantSlug, tableNumber),
        label: getUiTemplate("qrTableLabel", locale, { number: String(tableNumber) }),
        title: `${restaurantName} — ${getUiTemplate("qrTableLabel", locale, { number: String(tableNumber) })}`,
      };
    });
  }, [mode, origin, restaurantSlug, tableCount, locale, restaurantName]);

  const handlePrint = () => {
    window.print();
  };

  const handleSettingsSaved = (settings: Record<string, unknown>) => {
    setMenuPayload((prev) =>
      prev
        ? {
            ...prev,
            restaurant: {
              ...prev.restaurant,
              settings: {
                ...(prev.restaurant.settings ?? {}),
                ...settings,
              },
            },
          }
        : prev,
    );
  };

  const handleSignOut = () => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.signOut().then(() => {
      window.location.href = `/${encodeURIComponent(restaurantSlug)}`;
    });
  };

  const handleQrLogoPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setQrLogoError(getUiMessage("selectImageFileError", locale));
      return;
    }

    setQrLogoError(null);
    setIsQrLogoUploading(true);
    try {
      const uploadedUrl = await uploadOwnerImage(restaurantSlug, file);
      const settings = await updateRestaurantQrLogoUrl(restaurantSlug, uploadedUrl);
      handleSettingsSaved(settings);
    } catch (error) {
      setQrLogoError(
        error instanceof Error ? error.message : getUiMessage("failedToSaveChanges", locale),
      );
    } finally {
      setIsQrLogoUploading(false);
    }
  };

  const handleRemoveQrLogo = async () => {
    if (!currentQrLogoUrl || isQrLogoRemoving) {
      return;
    }
    setQrLogoError(null);
    setIsQrLogoRemoving(true);
    try {
      await deleteOwnerImage(restaurantSlug, currentQrLogoUrl);
      const settings = await updateRestaurantQrLogoUrl(restaurantSlug, null);
      handleSettingsSaved(settings);
    } catch (error) {
      setQrLogoError(
        error instanceof Error ? error.message : getUiMessage("failedToSaveChanges", locale),
      );
    } finally {
      setIsQrLogoRemoving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50" lang={locale} dir={isRtl ? "rtl" : "ltr"}>
      <div className="admin-no-print mx-auto max-w-4xl px-4 py-6">
        <header className="mb-6 flex items-start gap-3 border-b border-zinc-200 pb-4">
          {userId && hasRestaurants ? (
            <OwnerMenuButton
              locale={locale}
              onClick={() => setIsOwnerDrawerOpen(true)}
            />
          ) : (
            <span className="inline-flex h-9 w-9 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getUiMessage("ownerDashboard", locale)}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">
              {getUiMessage("qrCodesTitle", locale)}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">{getUiMessage("qrCodesSubtitle", locale)}</p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0" aria-hidden />
        </header>

        {isMenuLoading ? (
          <p className="text-sm text-zinc-500">{getUiMessage("loadingMenu", locale)}</p>
        ) : null}

        {menuError ? (
          <p className="text-sm text-red-600">{menuError}</p>
        ) : null}

        {!isMenuLoading && !menuError ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="h-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {getUiMessage("qrLogoTitle", locale)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {getUiMessage("qrLogoHint", locale)}
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {isQrLogoUploading
                        ? getUiMessage("uploading", locale)
                        : getUiMessage("uploadImage", locale)}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handleQrLogoPicked(event)}
                        className="hidden"
                        disabled={isQrLogoUploading || isQrLogoRemoving}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleRemoveQrLogo()}
                      disabled={!currentQrLogoUrl || isQrLogoUploading || isQrLogoRemoving}
                      className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                    >
                      {isQrLogoRemoving
                        ? getUiMessage("removing", locale)
                        : getUiMessage("remove", locale)}
                    </button>
                  </div>
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    {currentQrLogoUrl ? (
                      <img
                        src={currentQrLogoUrl}
                        alt={getUiMessage("qrLogoPreviewAlt", locale)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-[10px] font-medium text-zinc-400">
                        QR
                      </div>
                    )}
                  </div>
                </div>
                {qrLogoError ? <p className="mt-2 text-xs text-red-600">{qrLogoError}</p> : null}
              </section>

              <section className="h-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {getUiMessage("qrModeTitle", locale)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("general")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === "general"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {getUiMessage("qrModeGeneral", locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("tables")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === "tables"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {getUiMessage("qrModeTables", locale)}
                  </button>
                </div>

                {mode === "tables" ? (
                  <div className="mt-4">
                    <label
                      htmlFor="table-count"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      {getUiMessage("qrTableCountLabel", locale)}
                    </label>
                    <input
                      id="table-count"
                      type="number"
                      min={1}
                      max={99}
                      value={tableCount}
                      onChange={(event) => setTableCount(Number(event.target.value))}
                      className="mt-2 w-full max-w-[8rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      {getUiMessage("qrTableCountHint", locale)}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!origin || qrEntries.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Printer className="h-4 w-4" aria-hidden />
                {getUiMessage("qrPrint", locale)}
              </button>
              {mode === "general" && origin ? (
                <p className="text-xs text-zinc-500 break-all">
                  {buildMenuUrl(origin, restaurantSlug)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {!isMenuLoading && !menuError && origin ? (
        <section
          id="qr-print-area"
          className={`qr-print-grid mx-auto max-w-4xl px-4 pb-10 ${
            mode === "general"
              ? "qr-print-grid--general grid grid-cols-1 place-items-center"
              : "grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4"
          }`}
          aria-label={getUiMessage("qrCodesTitle", locale)}
        >
          {qrEntries.map((entry) => (
            <QrCodeCard
              key={entry.key}
              value={entry.value}
              logoSrc={logoSrc}
              title={entry.title}
              label={entry.label}
            />
          ))}
        </section>
      ) : null}

      {menuPayload && hasRestaurants ? (
        <OwnerDrawer
          locale={locale}
          open={isOwnerDrawerOpen}
          onClose={() => setIsOwnerDrawerOpen(false)}
          restaurants={restaurants}
          currentSlug={restaurantSlug}
          menuPayload={menuPayload}
          onSettingsSaved={handleSettingsSaved}
          onSignOut={handleSignOut}
        />
      ) : null}
    </div>
  );
}
