"use client";

import { useEffect } from "react";

export type ModalProps = {
  open: boolean;
  onBackdropPointerDown: () => void;
  children: React.ReactNode;
  /** Used when `labelledBy` is omitted */
  ariaLabel?: string;
  labelledBy?: string;
};

/**
 * Accessible overlay shell: backdrop + centered panel. Children supply the card UI.
 * Use with z-index above other overlays (e.g. drawers).
 */
export default function Modal({
  open,
  onBackdropPointerDown,
  children,
  ariaLabel,
  labelledBy,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBackdropPointerDown();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onBackdropPointerDown]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button
        type="button"
        aria-label={ariaLabel ?? "Close dialog"}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onPointerDown={(event) => {
          event.preventDefault();
          onBackdropPointerDown();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        className="relative mx-auto flex min-h-full w-full max-w-md items-center justify-center px-4 py-10"
      >
        <div
          className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
