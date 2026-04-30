"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MenuItemCard from "../../components/MenuItemCard";
import { fetchMenuBySlug } from "../../lib/menuApi";
import type { Locale, MenuCategory, MenuItem, MenuPayload } from "../../types/menu";
import { getLocalizedText, getUiMessage, isRtlLocale } from "../../utils/i18n";

const ADMIN_MENU_SLUG = "yossis-hummus";

export default function AdminMenuPage() {
  const [menuPayload, setMenuPayload] = useState<MenuPayload | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("he");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

        setMenuError(
          error instanceof Error ? error.message : "Failed to load menu",
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
    const itemName = getLocalizedText(item, "name", locale);
    console.log("Edit item", item);
    alert(`Edit item: ${itemName}`);
  };

  const handleToggleAvailability = (item: MenuItem, newStatus: boolean) => {
    const itemName = getLocalizedText(item, "name", locale);
    console.log("Toggle availability", { item, newStatus });
    alert(
      `Toggle availability for ${itemName}: ${
        newStatus ? "Available" : "Out of stock"
      }`,
    );
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
                Owner Dashboard
              </p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">
                Menu Editor
              </h1>
            </div>
            <button
              type="button"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {isMenuLoading ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            Loading menu...
          </div>
        ) : null}

        {menuError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-900">
              Could not load menu
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
                      + Add Item
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
    </div>
  );
}
