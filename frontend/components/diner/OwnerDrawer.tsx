"use client";



import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {

  ChevronLeft,

  ChevronRight,

  Menu,

  QrCode,

  Settings,

  Share2,

  UtensilsCrossed,

  X,

} from "lucide-react";

import type { FatMenuPayload, Locale, SlimMenuPayload } from "../../types/menu";

import type { OwnerRestaurant } from "../../types/owner";

import { tenantHref } from "../../lib/tenantLocale";

import { getUiMessage, isRtlLocale } from "../../utils/i18n";

import { socialLinksFromSettings } from "../../lib/socialLinks";

import { updateRestaurantSocialLinks } from "../../lib/menuApi";

import SocialLinksEditor from "../SocialLinksEditor";

import OwnerDefaultLanguageSetting from "./OwnerDefaultLanguageSetting";



type OwnerDrawerSection = "menus" | "social-links" | "settings";

type SettingsPanel = "default-language" | null;



type OwnerDrawerProps = {

  locale: Locale;

  open: boolean;

  onClose: () => void;

  restaurants: OwnerRestaurant[];

  currentSlug: string;

  menuPayload: SlimMenuPayload | FatMenuPayload | null;

  onSettingsSaved: (settings: Record<string, unknown>) => void;

  onSignOut: () => void;

};



export default function OwnerDrawer({

  locale,

  open,

  onClose,

  restaurants,

  currentSlug,

  menuPayload,

  onSettingsSaved,

  onSignOut,

}: OwnerDrawerProps) {

  const isRtl = isRtlLocale(locale);

  const [activeSection, setActiveSection] = useState<OwnerDrawerSection | null>(null);

  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);



  useEffect(() => {

    if (!open) {

      setActiveSection(null);

      setSettingsPanel(null);

    }

  }, [open]);



  useEffect(() => {

    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {

      if (event.key === "Escape") {

        if (settingsPanel) {

          setSettingsPanel(null);

        } else if (activeSection) {

          setActiveSection(null);

        } else {

          onClose();

        }

      }

    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);

  }, [open, activeSection, settingsPanel, onClose]);



  const ownsCurrentRestaurant = restaurants.some((r) => r.slug === currentSlug);



  const socialLinksInitial = useMemo(

    () => socialLinksFromSettings(menuPayload?.restaurant.settings),

    [menuPayload?.restaurant.settings],

  );



  const handleSaveSocialLinks = async (payload: Record<string, string | null>) => {

    const settings = await updateRestaurantSocialLinks(currentSlug, payload);

    onSettingsSaved(settings);

  };



  const handleBack = () => {

    if (settingsPanel) {

      setSettingsPanel(null);

      return;

    }

    setActiveSection(null);

  };



  if (!open) return null;



  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const showBack = Boolean(activeSection);



  const navItems: { id: OwnerDrawerSection; label: string; icon: typeof Menu }[] = [

    {

      id: "menus",

      label: getUiMessage("ownerDrawerMenus", locale),

      icon: UtensilsCrossed,

    },

  ];



  if (ownsCurrentRestaurant && menuPayload) {

    navItems.push({

      id: "settings",

      label: getUiMessage("ownerDrawerSettings", locale),

      icon: Settings,

    });

    navItems.push({

      id: "social-links",

      label: getUiMessage("socialLinksTitle", locale),

      icon: Share2,

    });

  }



  return (

    <div className="fixed inset-0 z-50">

      <button

        type="button"

        className="absolute inset-0 bg-zinc-900/40"

        aria-label={getUiMessage("ownerDrawerClose", locale)}

        onClick={onClose}

      />

      <aside

        className={`absolute inset-y-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl ${

          isRtl ? "right-0" : "left-0"

        }`}

        role="dialog"

        aria-modal="true"

        aria-label={getUiMessage("ownerDrawerTitle", locale)}

      >

        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">

          {showBack ? (

            <button

              type="button"

              onClick={handleBack}

              className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700"

            >

              <BackIcon className="h-4 w-4" aria-hidden />

              {getUiMessage("ownerDrawerBack", locale)}

            </button>

          ) : (

            <p className="text-sm font-semibold text-zinc-900">

              {getUiMessage("ownerDrawerTitle", locale)}

            </p>

          )}

          <button

            type="button"

            onClick={onClose}

            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"

            aria-label={getUiMessage("ownerDrawerClose", locale)}

          >

            <X className="h-5 w-5" aria-hidden />

          </button>

        </div>



        <div className="flex-1 overflow-y-auto">

          {activeSection === "menus" ? (

            <MenusSection locale={locale} restaurants={restaurants} />

          ) : activeSection === "social-links" && ownsCurrentRestaurant && menuPayload ? (

            <div className="p-4">

              <SocialLinksEditor

                key={JSON.stringify(socialLinksInitial)}

                locale={locale}

                initialLinks={socialLinksInitial}

                onSave={handleSaveSocialLinks}

              />

            </div>

          ) : activeSection === "settings" && ownsCurrentRestaurant && menuPayload ? (

            settingsPanel === "default-language" ? (

              <OwnerDefaultLanguageSetting

                locale={locale}

                restaurantSlug={currentSlug}

                settings={menuPayload.restaurant.settings}

                defaultLocale={menuPayload.restaurant.default_locale}

                onSaved={onSettingsSaved}

              />

            ) : (

              <nav className="flex flex-col gap-1 p-3">

                <button

                  type="button"

                  onClick={() => setSettingsPanel("default-language")}

                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-medium text-zinc-800 hover:bg-zinc-100"

                >

                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold text-zinc-600">

                    Aa

                  </span>

                  {getUiMessage("ownerSettingsDefaultLanguage", locale)}

                </button>

              </nav>

            )

          ) : (

            <nav className="flex flex-col gap-1 p-3">

              {navItems.map((item) => {

                const Icon = item.icon;

                return (

                  <button

                    key={item.id}

                    type="button"

                    onClick={() => setActiveSection(item.id)}

                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-medium text-zinc-800 hover:bg-zinc-100"

                  >

                    <Icon className="h-5 w-5 shrink-0 text-zinc-600" strokeWidth={1.75} aria-hidden />

                    {item.label}

                  </button>

                );

              })}

              {ownsCurrentRestaurant ? (

                <Link

                  href={tenantHref(

                    `/${encodeURIComponent(currentSlug)}/admin/qr-codes`,

                    locale,

                  )}

                  onClick={onClose}

                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100"

                >

                  <QrCode className="h-5 w-5 shrink-0 text-zinc-600" strokeWidth={1.75} aria-hidden />

                  {getUiMessage("qrCodesNav", locale)}

                </Link>

              ) : null}

            </nav>

          )}

        </div>



        <div className="border-t border-zinc-200 px-4 py-3">

          <button

            type="button"

            onClick={onSignOut}

            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"

          >

            {getUiMessage("ownerDrawerSignOut", locale)}

          </button>

        </div>

      </aside>

    </div>

  );

}



function MenusSection({

  locale,

  restaurants,

}: {

  locale: Locale;

  restaurants: OwnerRestaurant[];

}) {

  if (restaurants.length === 0) {

    return (

      <div className="px-4 py-8 text-center text-sm text-zinc-500">

        {getUiMessage("ownerDrawerNoRestaurants", locale)}

      </div>

    );

  }



  const singleRestaurant = restaurants.length === 1;



  return (

    <div className="p-3">

      {restaurants.map((restaurant) => (

        <div key={restaurant.id} className={singleRestaurant ? "" : "mb-4"}>

          {!singleRestaurant ? (

            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">

              {restaurant.name}

            </p>

          ) : null}

          <div className="flex flex-col gap-0.5">

            {restaurant.menus.length > 0 ? (

              restaurant.menus.map((menu) => (

                <a

                  key={menu.id}

                  href={tenantHref(`/${encodeURIComponent(restaurant.slug)}/admin`, locale)}

                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"

                >

                  <span>{menu.name}</span>

                  <span

                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${

                      menu.is_active

                        ? "bg-emerald-100 text-emerald-700"

                        : "bg-zinc-200 text-zinc-600"

                    }`}

                  >

                    {getUiMessage(

                      menu.is_active ? "ownerDrawerMenuActive" : "ownerDrawerMenuInactive",

                      locale,

                    )}

                  </span>

                </a>

              ))

            ) : (

              <p className="px-3 py-2 text-xs text-zinc-500">

                {getUiMessage("ownerDrawerNoRestaurants", locale)}

              </p>

            )}

          </div>

        </div>

      ))}

    </div>

  );

}


