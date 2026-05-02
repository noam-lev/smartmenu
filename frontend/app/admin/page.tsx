"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EditItemDrawer from "../../components/EditItemDrawer";
import MenuItemCard from "../../components/MenuItemCard";
import { fetchMenuBySlug, updateItemAvailability, updateMenuItem } from "../../lib/menuApi";
import { useUiStore } from "../../store/uiStore";
import type { MenuCategory, MenuItem, MenuPayload } from "../../types/menu";
import { getLocalizedText, getUiMessage, isRtlLocale } from "../../utils/i18n";

const ADMIN_MENU_SLUG = "yossis-hummus";

export default function AdminMenuPage() {
  const [menuPayload, setMenuPayload] = useState<MenuPayload | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);

  const categories = useMemo(
    () =>
      menuPayload
        ? [...menuPayload.menu.categories].sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [menuPayload],
  );
  const isRtl = isRtlLocale(locale);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      try {
        setIsMenuLoading(true);
        setMenuError(null);

        const data = await fetchMenuBySlug(ADMIN_MENU_SLUG);

        if (!isMounted) {
          return;
        }

        const sortedCategories = [...data.menu.categories].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        setMenuPayload(data);
        setLocale(data.restaurant.default_locale ?? "en");
        setActiveCategoryId(sortedCategories[0]?.id ?? "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const uiLocale = useUiStore.getState().locale;
        setMenuError(
          error instanceof Error ? error.message : getUiMessage("failedToLoadMenu", uiLocale),
        );
      } finally {
        if (isMounted) {
          setIsMenuLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      isMounted = false;
    };
    // setLocale from Zustand is stable for this one-time bootstrap load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sections = categories
      .map((category) => sectionRefs.current[category.id])
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!activeEntry) {
          return;
        }

        const nextCategoryId =
          activeEntry.target.getAttribute("data-category-id") ?? "";
        if (nextCategoryId) {
          setActiveCategoryId(nextCategoryId);
        }
      },
      {
        root: null,
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!languageMenuRef.current) {
        return;
      }

      if (!languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isLanguageMenuOpen]);

  const scrollToCategory = (category: MenuCategory) => {
    setActiveCategoryId(category.id);
    const sectionElement = sectionRefs.current[category.id];
    if (!sectionElement) {
      return;
    }

    const stickyNavOffset = 56;
    const targetTop =
      sectionElement.getBoundingClientRect().top + window.scrollY - stickyNavOffset;

    window.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  };

  const handleEditClick = (item: MenuItem) => {
    setEditingItem(item);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingItem(null);
  };

  const handleSaveItem = async (updatedData: Partial<MenuItem>) => {
    if (!menuPayload || !editingItem) {
      return;
    }

    const itemId = editingItem.id;
    const previousPayload = menuPayload;

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: menuPayload.menu.categories.map((category) => ({
          ...category,
          items: category.items.map((menuItem) =>
            menuItem.id === itemId ? { ...menuItem, ...updatedData } : menuItem,
          ),
        })),
      },
    });

    try {
      await updateMenuItem(itemId, updatedData);
      handleCloseDrawer();
    } catch (error) {
      setMenuPayload(previousPayload);
      alert(
        error instanceof Error
          ? error.message
          : getUiMessage("failedToSaveChanges", locale),
      );
    }
  };

  const handleToggleAvailability = (item: MenuItem, newStatus: boolean) => {
    const previousPayload = menuPayload;

    setMenuPayload((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        menu: {
          ...prev.menu,
          categories: prev.menu.categories.map((category) => ({
            ...category,
            items: category.items.map((menuItem) =>
              menuItem.id === item.id
                ? { ...menuItem, is_available: newStatus }
                : menuItem,
            ),
          })),
        },
      };
    });

    void updateItemAvailability(item.id, newStatus).catch((error) => {
      setMenuPayload(previousPayload);
      alert(
        error instanceof Error
          ? error.message
          : getUiMessage("failedToUpdateAvailability", locale),
      );
    });
  };

  return (
    <div
      className="min-h-[100dvh] bg-zinc-50"
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <main className="mx-auto max-w-md bg-white pb-10">
        <header className="border-b border-zinc-200 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {getUiMessage("ownerDashboard", locale)}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">
                {getUiMessage("menuEditor", locale)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={languageMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsLanguageMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isLanguageMenuOpen}
                  aria-label={getUiMessage("selectLanguage", locale)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
                >
                  <span>{locale === "he" ? "עב" : "EN"}</span>
                  <span className="text-[10px] text-zinc-500">▾</span>
                </button>

                {isLanguageMenuOpen ? (
                  <div
                    role="menu"
                    className={`absolute z-30 mt-2 min-w-28 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg ${
                      isRtl ? "left-0" : "right-0"
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLocale("he");
                        setIsLanguageMenuOpen(false);
                      }}
                      className={`block w-full rounded-lg px-3 py-2 text-sm ${
                        locale === "he"
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {getUiMessage("languageHebrew", locale)}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLocale("en");
                        setIsLanguageMenuOpen(false);
                      }}
                      className={`mt-1 block w-full rounded-lg px-3 py-2 text-sm ${
                        locale === "en"
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {getUiMessage("languageEnglish", locale)}
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
              >
                {getUiMessage("logout", locale)}
              </button>
            </div>
          </div>
        </header>

        {isMenuLoading ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            {getUiMessage("loadingMenu", locale)}
          </div>
        ) : null}

        {menuError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-900">
              {getUiMessage("couldNotLoadMenu", locale)}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{menuError}</p>
          </div>
        ) : null}

        {menuPayload && !menuError ? (
          <>
            <nav className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => {
                  const isActive = activeCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => scrollToCategory(category)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700 active:scale-[0.98]"
                      }`}
                    >
                      {getLocalizedText(category, "name", locale)}
                    </button>
                  );
                })}
              </div>
            </nav>

            <section>
              {categories.map((category) => (
                <div
                  key={category.id}
                  ref={(el) => {
                    sectionRefs.current[category.id] = el;
                  }}
                  data-category-id={category.id}
                >
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                    <h2 className="text-base font-bold text-zinc-900">
                      {getLocalizedText(category, "name", locale)}
                    </h2>
                    <button
                      type="button"
                      className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white active:scale-[0.98]"
                    >
                      {getUiMessage("addItem", locale)}
                    </button>
                  </div>
                  {category.items.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      mode="admin"
                      item={item}
                      locale={locale}
                      unavailableLabel={getUiMessage("unavailable", locale)}
                      onEditClick={handleEditClick}
                      onToggleAvailability={handleToggleAvailability}
                    />
                  ))}
                </div>
              ))}
            </section>
          </>
        ) : null}
      </main>

      <EditItemDrawer
        item={editingItem}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSave={handleSaveItem}
      />
    </div>
  );
}
