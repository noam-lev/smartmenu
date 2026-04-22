"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import CartSummarySheet from "../components/CartSummarySheet";
import ItemBottomSheet from "../components/ItemBottomSheet";
import MenuItemCard from "../components/MenuItemCard";
import mockMenuRaw from "../data/mockMenu.json";
import { useCartStore } from "../store/cartStore";
import type { MenuCategory, MenuItem, MenuPayload } from "../types/menu";
import { formatILSCurrency } from "../utils/currency";

const mockMenu = mockMenuRaw as MenuPayload;

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
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
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

  const upsellRule = selectedItem?.upsell_rules?.[0];

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

  const handlePrimaryAdd = () => {
    if (!selectedItem) {
      return;
    }

    addSelection({
      itemId: selectedItem.id,
      quantity,
      name: selectedItem.name,
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
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-md bg-white pb-24">
        <header className="border-b border-zinc-200 px-4 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
              {mockMenu.restaurant.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                {mockMenu.restaurant.name}
              </p>
              <p className="text-sm text-zinc-500">{mockMenu.menu.name}</p>
            </div>
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
                  {category.name}
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
                {category.name}
              </h2>
              {category.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
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
        upsellRule={upsellRule}
        onClose={closeSheet}
        onQuantityChange={setQuantity}
        onPrimaryAdd={handlePrimaryAdd}
        onUpsellDecision={handleUpsellDecision}
      />

      <CartSummarySheet
        key={`cart-sheet-${cartSheetSession}`}
        isOpen={isCartSheetOpen}
        items={cartItems}
        subtotal={totalPrice}
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
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-left text-white shadow-lg active:scale-[0.995]"
        >
          <p className="text-xs font-medium text-zinc-300">Soft ordering</p>
          <p className="text-sm font-semibold">
            View Order ({totalItems} {totalItems === 1 ? "item" : "items"}) -{" "}
            {formatILSCurrency(totalPrice)}
          </p>
        </button>
      ) : null}
    </div>
  );
}
