"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";

const FAQ_ITEMS = [
  { questionKey: "faq1Question" as const, answerKey: "faq1Answer" as const },
  { questionKey: "faq2Question" as const, answerKey: "faq2Answer" as const },
  { questionKey: "faq3Question" as const, answerKey: "faq3Answer" as const },
  { questionKey: "faq4Question" as const, answerKey: "faq4Answer" as const },
  { questionKey: "faq5Question" as const, answerKey: "faq5Answer" as const },
  { questionKey: "faq6Question" as const, answerKey: "faq6Answer" as const },
] as const;

type LandingFaqProps = {
  locale: LandingLocale;
};

export function LandingFaq({ locale }: LandingFaqProps) {
  const t = landingCopy[locale];
  const sectionId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      className="faq-tear-section pt-24"
      aria-labelledby={`${sectionId}-title`}
    >
      <div className="faq-tear-section__content mx-auto max-w-[800px] ps-8 pe-8">
        <h2
          id={`${sectionId}-title`}
          className="mb-10 text-center text-4xl font-black leading-tight tracking-tight text-espresso md:text-5xl"
        >
          {t.faqTitle}
        </h2>

        <div className="divide-y divide-espresso/10 border border-espresso/10 bg-parchment/40">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            const triggerId = `${sectionId}-trigger-${index}`;
            const panelId = `${sectionId}-panel-${index}`;

            return (
              <div key={item.questionKey}>
                <h3 className="m-0">
                  <button
                    type="button"
                    id={triggerId}
                    className="flex w-full items-center justify-between gap-4 py-5 ps-6 pe-6 text-start text-base font-bold leading-snug tracking-tight text-espresso transition hover:bg-kraft/80 md:text-lg"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span>{t[item.questionKey]}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-warm-brown transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  hidden={!isOpen}
                  className={isOpen ? "block" : "hidden"}
                >
                  <p className="border-t border-dashed border-espresso/10 px-6 pb-6 pt-2 text-sm font-medium leading-snug tracking-tight text-warm-brown md:text-base">
                    {t[item.answerKey]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
