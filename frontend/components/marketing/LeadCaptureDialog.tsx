"use client";

import Modal from "@/components/ui/Modal";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";
import { LeadCaptureForm } from "./LeadCaptureForm";

type LeadCaptureDialogProps = {
  open: boolean;
  onClose: () => void;
  locale: LandingLocale;
};

export function LeadCaptureDialog({ open, onClose, locale }: LeadCaptureDialogProps) {
  const t = landingCopy[locale];

  return (
    <Modal
      open={open}
      onBackdropPointerDown={onClose}
      ariaLabel={t.leadModalTitle}
      labelledBy="lead-modal-title"
    >
      <div className="text-start">
        <h2 id="lead-modal-title" className="text-xl font-bold tracking-tight text-espresso">
          {t.leadModalTitle}
        </h2>
        <p className="mt-2 text-sm leading-snug text-warm-brown">{t.leadModalSub}</p>
      </div>
      <div className="mt-5">
        <LeadCaptureForm locale={locale} />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full cursor-pointer rounded-sm border border-ticket-rule py-2 text-sm text-warm-brown transition hover:bg-kraft"
      >
        {t.leadClose}
      </button>
    </Modal>
  );
}
