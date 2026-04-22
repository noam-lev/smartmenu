"use client";

import { useRef, useState } from "react";
import type { MenuItem, UpsellRule } from "../types/menu";
import { formatILSCurrency } from "../utils/currency";

const SHEET_DISMISS_PX = 120;

type ItemBottomSheetProps = {
  selectedItem: MenuItem | null;
  isUpsellStep: boolean;
  quantity: number;
  upsellRule?: UpsellRule;
  onClose: () => void;
  onQuantityChange: (nextQuantity: number) => void;
  onPrimaryAdd: () => void;
  onUpsellDecision: (accept: boolean) => void;
};

export default function ItemBottomSheet({
  selectedItem,
  isUpsellStep,
  quantity,
  upsellRule,
  onClose,
  onQuantityChange,
  onPrimaryAdd,
  onUpsellDecision,
}: ItemBottomSheetProps) {
  const [sheetOffsetY, setSheetOffsetY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetDragRef = useRef<{
    pointerId: number;
    startClientY: number;
    startOffsetY: number;
  } | null>(null);

  if (!selectedItem) {
    return null;
  }

  const handleSheetHandlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startOffsetY: sheetOffsetY,
    };
    setSheetDragging(true);
  };

  const handleSheetHandlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = sheetDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const delta = event.clientY - drag.startClientY;
    setSheetOffsetY(Math.max(0, drag.startOffsetY + delta));
  };

  const handleSheetHandlePointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = sheetDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    const delta = event.clientY - drag.startClientY;
    const endOffset = Math.max(0, drag.startOffsetY + delta);
    sheetDragRef.current = null;
    setSheetDragging(false);

    if (endOffset >= SHEET_DISMISS_PX) {
      onClose();
      return;
    }

    setSheetOffsetY(0);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl will-change-transform"
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
          onPointerDown={handleSheetHandlePointerDown}
          onPointerMove={handleSheetHandlePointerMove}
          onPointerUp={handleSheetHandlePointerUp}
          onPointerCancel={handleSheetHandlePointerUp}
          role="presentation"
        >
          <div className="h-1.5 w-12 rounded-full bg-zinc-200" />
        </div>

        {!isUpsellStep ? (
          <>
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
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                >
                  -
                </button>
                <span className="min-w-6 text-center text-base font-semibold text-zinc-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(quantity + 1)}
                  className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-medium text-zinc-900 active:scale-[0.96]"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onPrimaryAdd}
              className="mt-5 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white active:scale-[0.995]"
            >
              Add to order -{" "}
              {formatILSCurrency(selectedItem.base_price * quantity)}
            </button>
          </>
        ) : (
          <>
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
                  {formatILSCurrency(upsellRule?.discount_price ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpsellDecision(false)}
                className="rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 active:scale-[0.99]"
              >
                No thanks
              </button>
              <button
                type="button"
                onClick={() => onUpsellDecision(true)}
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
              >
                Add {formatILSCurrency(upsellRule?.discount_price ?? 0)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
