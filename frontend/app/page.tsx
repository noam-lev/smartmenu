"use client";

import { useMemo, useRef, useState } from "react";
import MenuItemCard from "../components/MenuItemCard";
import mockMenuRaw from "../data/mockMenu.json";
import { useCartStore } from "../store/cartStore";
import type { MenuCategory, MenuItem, MenuPayload } from "../types/menu";

const mockMenu = mockMenuRaw as MenuPayload;

function formatILS(amount: number) {
  return `${Math.round(amount)} \u20aa`;
}

export default function Home() {
  const categories = useMemo(
    () => [...mockMenu.menu.categories].sort((a, b) => a.sort_order - b.sort_order),
    [],
  );

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isUpsellStep, setIsUpsellStep] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");

  const addItem = useCartStore((state) => state.addItem);
  const totalItems = useCartStore((state) => state.totalItems());
  const totalPrice = useCartStore((state) => state.totalPrice());

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

  const handlePrimaryAdd = () => {
    if (!selectedItem) {
      return;
    }

    addItem(
      {
        id: selectedItem.id,
        name: selectedItem.name,
        unitPrice: selectedItem.base_price,
      },
      quantity,
    );

    if (selectedItem.upsell_rules?.length) {
      setIsUpsellStep(true);
      return;
    }

    closeSheet();
  };

  const handleUpsellDecision = (accept: boolean) => {
    if (accept && upsellRule) {
      addItem({
        id: upsellRule.offer_item_snapshot.id,
        name: upsellRule.offer_item_snapshot.name,
        unitPrice: upsellRule.discount_price,
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
              onMouseEnter={() => setActiveCategoryId(category.id)}
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

      {selectedItem ? (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={closeSheet}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white p-4 pb-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {!isUpsellStep ? (
              <>
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-200" />
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="h-44 w-full rounded-2xl object-cover"
                />
                <h3 className="mt-4 text-xl font-bold text-zinc-900">
                  {selectedItem.name}
                </h3>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {selectedItem.description}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-600">Quantity</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                    >
                      -
                    </button>
                    <span className="min-w-6 text-center text-base font-semibold text-zinc-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => prev + 1)}
                      className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrimaryAdd}
                  className="mt-5 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white active:scale-[0.995]"
                >
                  Add to order - {formatILS(selectedItem.base_price * quantity)}
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-200" />
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Suggested add-on
                </p>
                <h3 className="mt-1 text-xl font-bold text-zinc-900">
                  {upsellRule?.offer_item_snapshot.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {upsellRule?.custom_message}
                </p>

                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 p-3">
                  <img
                    src={upsellRule?.offer_item_snapshot.image_url}
                    alt={upsellRule?.offer_item_snapshot.name}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {upsellRule?.offer_item_snapshot.name}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {formatILS(upsellRule?.discount_price ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleUpsellDecision(false)}
                    className="rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 active:scale-[0.99]"
                  >
                    No thanks
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpsellDecision(true)}
                    className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
                  >
                    Add {formatILS(upsellRule?.discount_price ?? 0)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {totalItems > 0 ? (
        <button
          type="button"
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-left text-white shadow-lg active:scale-[0.995]"
        >
          <p className="text-xs font-medium text-zinc-300">Soft ordering</p>
          <p className="text-sm font-semibold">
            View Order ({totalItems} {totalItems === 1 ? "item" : "items"}) -{" "}
            {formatILS(totalPrice)}
          </p>
        </button>
      ) : null}
    </div>
  );
}
