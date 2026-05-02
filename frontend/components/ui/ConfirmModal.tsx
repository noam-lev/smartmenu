"use client";

import type { Locale } from "../../types/menu";
import { isRtlLocale } from "../../utils/i18n";
import Modal from "./Modal";

export type ConfirmModalProps = {
  open: boolean;
  locale: Locale;
  titleId: string;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  variant?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  open,
  locale,
  titleId,
  title,
  message,
  cancelLabel,
  confirmLabel,
  variant = "primary",
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const isRtl = isRtlLocale(locale);

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]"
      : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]";

  return (
    <Modal open={open} onBackdropPointerDown={onCancel} labelledBy={titleId}>
      <div lang={locale} dir={isRtl ? "rtl" : "ltr"} className="text-start">
        <h2 id={titleId} className="text-lg font-bold text-zinc-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-5 text-zinc-600">{message}</p>
        <div className={`mt-6 flex gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800 shadow-sm active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
