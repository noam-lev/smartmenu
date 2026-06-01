"use client";

import { useRef } from "react";
import type { CartLine } from "../lib/cart";
import type { Locale } from "../types/menu";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { useSheetDialogA11y } from "../hooks/useSheetDialogA11y";
import { formatCurrency } from "../utils/currency";
import { getLocalizedText } from "../utils/i18n";

type CartSummarySheetProps = {
  isOpen: boolean;
  locale: Locale;
  currency?: string;
  items: CartLine[];
  subtotal: number;
  labels: {
    yourOrder: string;
    close: string;
    emptyCart: string;
    each: string;
    remove: string;
    subtotal: string;
    startOver: string;
  };
  onClose: () => void;
  onIncrease: (lineId: string) => void;
  onDecrease: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  onStartOver: () => void;
};

export default function CartSummarySheet({
  isOpen,
  locale,
  currency = "ILS",
  items,
  subtotal,
  labels,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
  onStartOver,
}: CartSummarySheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { sheetOffsetY, sheetDragging, dragHandlers } = useDraggableSheet({
    onDismiss: onClose,
  });
  useLockBodyScroll(isOpen);
  useSheetDialogA11y({ isOpen, onClose, panelRef });

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-summary-sheet-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 mx-auto flex h-[min(74vh,42rem)] w-full max-w-md overscroll-contain flex-col rounded-t-3xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl will-change-transform outline-none"
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
          <h3
            id="cart-summary-sheet-title"
            className="text-lg font-bold text-zinc-900"
          >
            {labels.yourOrder}
          </h3>
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
              {items.map((line) => (
                <div
                  key={line.lineId}
                  className="rounded-2xl border border-zinc-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {getLocalizedText(line, "name", locale)}
                      </p>
                      {line.selections.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                          {line.selections.map((modifier) => (
                            <li key={`${modifier.groupId}-${modifier.optionId}`}>
                              {modifier.optionName}
                              {modifier.priceDelta > 0
                                ? ` (+${formatCurrency(modifier.priceDelta, currency)})`
                                : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatCurrency(line.unitPrice, currency)} {labels.each}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(line.lineId)}
                      className="text-xs font-semibold text-zinc-500 underline underline-offset-2"
                    >
                      {labels.remove}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDecrease(line.lineId)}
                        className="h-8 w-8 rounded-full border border-zinc-300 text-zinc-900 active:scale-[0.96]"
                      >
                        -
                      </button>
                      <span className="min-w-5 text-center text-sm font-semibold text-zinc-900">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onIncrease(line.lineId)}
                        className="h-8 w-8 rounded-full border border-zinc-300 text-zinc-900 active:scale-[0.96]"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {formatCurrency(line.unitPrice * line.quantity, currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600">{labels.subtotal}</p>
                <p className="text-base font-bold text-zinc-900">
                  {formatCurrency(subtotal, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={onStartOver}
                className="mt-3 w-full py-1 text-center text-sm font-medium text-zinc-500 underline underline-offset-2"
              >
                {labels.startOver}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
