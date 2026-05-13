"use client";

import type { CartItem } from "../store/cartStore";
import type { Locale } from "../types/menu";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { formatILSCurrency } from "../utils/currency";
import { getLocalizedText } from "../utils/i18n";

type CartSummarySheetProps = {
  isOpen: boolean;
  locale: Locale;
  items: CartItem[];
  subtotal: number;
  labels: {
    yourOrder: string;
    close: string;
    emptyCart: string;
    each: string;
    remove: string;
    subtotal: string;
  };
  onClose: () => void;
  onIncrease: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

export default function CartSummarySheet({
  isOpen,
  locale,
  items,
  subtotal,
  labels,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
}: CartSummarySheetProps) {
  const { sheetOffsetY, sheetDragging, dragHandlers } = useDraggableSheet({
    onDismiss: onClose,
  });
  useLockBodyScroll(isOpen);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute inset-x-0 bottom-0 mx-auto flex h-[min(74vh,42rem)] w-full max-w-md overscroll-contain flex-col rounded-t-3xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl will-change-transform"
        style={{
          transform: `translateY(${sheetOffsetY}px)`,
          transition: sheetDragging
            ? "none"
            : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="-mx-4 -mt-2 flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          {...dragHandlers}
          role="presentation"
        >
          <div className="h-1.5 w-12 rounded-full bg-zinc-200" />
        </div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">{labels.yourOrder}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm font-medium text-zinc-500"
          >
            {labels.close}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="py-6 text-center text-sm text-zinc-500">
              {labels.emptyCart}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {items.map((item) => (
                <div
                  key={item.itemId}
                  className="rounded-2xl border border-zinc-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {getLocalizedText(item, "name", locale)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatILSCurrency(item.displayUnitPrice)} {labels.each}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.itemId)}
                      className="text-xs font-semibold text-zinc-500 underline underline-offset-2"
                    >
                      {labels.remove}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDecrease(item.itemId)}
                        className="h-8 w-8 rounded-full border border-zinc-300 text-zinc-900 active:scale-[0.96]"
                      >
                        -
                      </button>
                      <span className="min-w-5 text-center text-sm font-semibold text-zinc-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onIncrease(item.itemId)}
                        className="h-8 w-8 rounded-full border border-zinc-300 text-zinc-900 active:scale-[0.96]"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {formatILSCurrency(item.displayUnitPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600">{labels.subtotal}</p>
                <p className="text-base font-bold text-zinc-900">
                  {formatILSCurrency(subtotal)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
