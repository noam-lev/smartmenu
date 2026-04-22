"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import CartSummarySheet from "../components/CartSummarySheet";
import ItemBottomSheet from "../components/ItemBottomSheet";
import MenuItemCard from "../components/MenuItemCard";
import mockMenuRaw from "../data/mockMenu.json";
import { useCartStore } from "../store/cartStore";
import type { Locale, MenuCategory, MenuItem, MenuPayload } from "../types/menu";
import { formatILSCurrency } from "../utils/currency";
import { getLocalizedText, getUiMessage, isRtlLocale } from "../utils/i18n";

const mockMenu = mockMenuRaw as MenuPayload;
const defaultLocale: Locale = mockMenu.restaurant.default_locale ?? "en";

export default function Home() {
  const categories = useMemo(
    () => [...mockMenu.menu.categories].sort((a, b) => a.sort_order - b.sort_order),
    [],
  );

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isUpsellStep, setIsUpsellStep] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [cartSheetSession, setCartSheetSession] = useState(0);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const addSelection = useCartStore((state) => state.addSelection);
  const itemsByItemId = useCartStore((state) => state.itemsByItemId);
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const totalItems = useCartStore((state) => state.totalItems());
  const totalPrice = useCartStore((state) => state.totalPrice());
  const cartItems = useMemo(() => Object.values(itemsByItemId), [itemsByItemId]);
  const isRtl = isRtlLocale(locale);

  const upsellRule = selectedItem?.upsell_rules?.[0];
  const restaurantName = getLocalizedText(mockMenu.restaurant, "name", locale);
  const menuName = getLocalizedText(mockMenu.menu, "name", locale);

  const closeSheet = () => {
    setSelectedItem(null);
    setIsUpsellStep(false);
    setQuantity(1);
  };

  const openItemSheet = (item: MenuItem) => {
    if (!item.is_available) {
      return;
    }

    setSelectedItem(item);
    setIsUpsellStep(false);
    setQuantity(1);
  };

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

  const handlePrimaryAdd = () => {
    if (!selectedItem) {
      return;
    }

    addSelection({
      itemId: selectedItem.id,
      quantity,
      name: selectedItem.name,
      translations: selectedItem.translations,
      displayUnitPrice: selectedItem.base_price,
    });

    if (selectedItem.upsell_rules?.length) {
      setIsUpsellStep(true);
      return;
    }

    closeSheet();
  };

  const handleUpsellDecision = (accept: boolean) => {
    if (accept && upsellRule) {
      addSelection({
        itemId: upsellRule.offer_item_snapshot.id,
        quantity: 1,
        name: upsellRule.offer_item_snapshot.name,
        translations: upsellRule.offer_item_snapshot.translations,
        displayUnitPrice: upsellRule.discount_price,
      });
    }

    closeSheet();
  };

  const scrollToCategory = (category: MenuCategory) => {
    setActiveCategoryId(category.id);
    sectionRefs.current[category.id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const openCartSheet = () => {
    setCartSheetSession((prev) => prev + 1);
    setIsCartSheetOpen(true);
  };

  const closeCartSheet = () => {
    setIsCartSheetOpen(false);
  };

  return (
    <div
      className="min-h-screen bg-zinc-50"
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <main className="mx-auto max-w-md bg-white pb-24">
        <header className="border-b border-zinc-200">
          <div className="h-44 w-full overflow-hidden bg-zinc-100">
            <img
              src={mockMenu.restaurant.banner_image_url}
              alt={`${restaurantName} banner`}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-zinc-900">
                {restaurantName}
              </h1>
              <div className="relative" ref={languageMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsLanguageMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isLanguageMenuOpen}
                  aria-label="Select language"
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
            </div>
            <p className="mt-1 text-sm text-zinc-500">{menuName}</p>
          </div>
        </header>

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
              <h2 className="border-b border-zinc-200 px-4 py-3 text-base font-bold text-zinc-900">
                {getLocalizedText(category, "name", locale)}
              </h2>
              {category.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  unavailableLabel={getUiMessage("unavailable", locale)}
                  onClick={() => openItemSheet(item)}
                />
              ))}
            </div>
          ))}
        </section>
      </main>

      <ItemBottomSheet
        key={selectedItem ? `${selectedItem.id}-${isUpsellStep ? "upsell" : "item"}` : "closed"}
        selectedItem={selectedItem}
        isUpsellStep={isUpsellStep}
        quantity={quantity}
        locale={locale}
        upsellRule={upsellRule}
        labels={{
          quantity: getUiMessage("quantity", locale),
          addToOrder: getUiMessage("addToOrder", locale),
          suggestedAddon: getUiMessage("suggestedAddon", locale),
          noThanks: getUiMessage("noThanks", locale),
          add: getUiMessage("add", locale),
        }}
        onClose={closeSheet}
        onQuantityChange={setQuantity}
        onPrimaryAdd={handlePrimaryAdd}
        onUpsellDecision={handleUpsellDecision}
      />

      <CartSummarySheet
        key={`cart-sheet-${cartSheetSession}`}
        isOpen={isCartSheetOpen}
        locale={locale}
        items={cartItems}
        subtotal={totalPrice}
        labels={{
          yourOrder: getUiMessage("yourOrder", locale),
          close: getUiMessage("close", locale),
          emptyCart: getUiMessage("emptyCart", locale),
          each: getUiMessage("each", locale),
          remove: getUiMessage("remove", locale),
          subtotal: getUiMessage("subtotal", locale),
        }}
        onClose={closeCartSheet}
        onIncrease={(itemId) => {
          const item = itemsByItemId[itemId];
          if (!item) {
            return;
          }
          setItemQuantity(itemId, item.quantity + 1);
        }}
        onDecrease={(itemId) => {
          const item = itemsByItemId[itemId];
          if (!item) {
            return;
          }
          setItemQuantity(itemId, item.quantity - 1);
        }}
        onRemove={removeItem}
      />

      {hasMounted && totalItems > 0 ? (
        <button
          type="button"
          onClick={openCartSheet}
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-start text-white shadow-lg active:scale-[0.995]"
        >
          <p className="text-xs font-medium text-zinc-300">
            {getUiMessage("softOrdering", locale)}
          </p>
          <p className="text-sm font-semibold">
            {getUiMessage("viewOrder", locale)} ({totalItems}{" "}
            {totalItems === 1
              ? getUiMessage("itemSingular", locale)
              : getUiMessage("itemPlural", locale)}) -{" "}
            {formatILSCurrency(totalPrice)}
          </p>
        </button>
      ) : null}
    </div>
  );
}
