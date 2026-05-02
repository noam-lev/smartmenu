"use client";

import type { Locale } from "../../types/menu";
import { isRtlLocale } from "../../utils/i18n";
import Modal from "./Modal";

export type AlertModalProps = {
  open: boolean;
  locale: Locale;
  titleId: string;
  title?: string;
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
};

export default function AlertModal({
  open,
  locale,
  titleId,
  title,
  message,
  dismissLabel,
  onDismiss,
}: AlertModalProps) {
  const isRtl = isRtlLocale(locale);

  return (
    <Modal
      open={open}
      onBackdropPointerDown={onDismiss}
      labelledBy={title ? titleId : undefined}
      ariaLabel={title ? undefined : dismissLabel}
    >
      <div lang={locale} dir={isRtl ? "rtl" : "ltr"} className="text-start">
        {title ? (
          <h2 id={titleId} className="text-lg font-bold text-zinc-900">
            {title}
          </h2>
        ) : null}
        <p
          id={`${titleId}-description`}
          className={`text-sm leading-5 text-zinc-600 ${title ? "mt-2" : ""}`}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98]"
        >
          {dismissLabel}
        </button>
      </div>
    </Modal>
  );
}
