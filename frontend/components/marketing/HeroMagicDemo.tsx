"use client";

import { useEffect, useState } from "react";
import { Coffee, Plus, Sparkles } from "lucide-react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";

type DemoPhase = "idle" | "processing" | "success";

const LOADING_STEP_MS = 1400;

export function HeroMagicDemo({ locale }: { locale: LandingLocale }) {
  const t = landingCopy[locale];
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    setPhase("idle");
    setLoadingStep(0);
  }, [locale]);

  useEffect(() => {
    if (phase !== "processing") {
      return;
    }

    if (loadingStep >= t.demoLoadingSteps.length) {
      const timer = window.setTimeout(() => setPhase("success"), 500);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setLoadingStep((step) => step + 1), LOADING_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [phase, loadingStep, t.demoLoadingSteps.length]);

  function startDemo() {
    setLoadingStep(0);
    setPhase("processing");
  }

  const loadingMessage =
    phase === "processing"
      ? t.demoLoadingSteps[Math.min(loadingStep, t.demoLoadingSteps.length - 1)]
      : "";

  return (
    <div className="relative flex h-full w-full flex-col bg-[#F5F2EB] font-sans">
      {phase === "idle" && (
        <button
          type="button"
          onClick={startDemo}
          className="absolute inset-0 m-4 mt-10 flex cursor-pointer flex-col items-center justify-center rounded-[2rem] border-4 border-dashed border-[#D7CCC8]/80 bg-[#FFFDF8]/60 p-6 text-center transition-all hover:border-espresso/30 hover:bg-[#FFFDF8]"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF9C4] text-[#F57F17] shadow-sm transition-transform hover:scale-110">
            <Sparkles className="h-10 w-10" strokeWidth={2} />
          </div>
          <h3 className="mb-2 text-2xl font-black leading-tight text-[#3E2723]">{t.demoStartPrompt}</h3>
          <p className="text-sm font-medium text-[#795548]">{t.demoStartHint}</p>
        </button>
      )}

      {phase === "processing" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FFFDF8] p-6 text-center">
          <Coffee className="mb-6 h-14 w-14 animate-pulse text-espresso" />
          <h3 className="mb-2 text-xl font-black text-[#3E2723]">{loadingMessage}</h3>
          <div className="mt-4 flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#D7CCC8]"
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "success" && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#F9F9F9] animate-in fade-in duration-500">
          <header className="relative bg-espresso pt-10 pb-4 ps-4 pe-4 text-center text-kraft shadow-md">
            <h2 className="text-xl font-bold">{t.demoRestaurant}</h2>
          </header>

          <nav className="relative z-10 flex gap-4 overflow-x-auto border-b border-gray-100 bg-white px-4 py-3 text-sm font-bold text-gray-500 shadow-sm">
            <span className="border-b-[3px] border-espresso pb-1 text-espresso">{t.demoCat1}</span>
            <span>{t.demoCat2}</span>
            <span>{t.demoCat3}</span>
          </nav>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#F5F2EB]/30 p-4 pb-32">
            {[
              { title: t.demoItem1, desc: "גרגירים חמים, פטרוזיליה ושמן זית", price: "₪32" },
              { title: t.demoItem2, desc: "מוגש עם טחינה הר ברכה", price: "₪28" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-[#D7CCC8]/40 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              >
                <div className="text-start">
                  <h4 className="text-base font-bold text-gray-900">{item.title}</h4>
                  <p className="mt-1 max-w-[130px] text-xs leading-tight text-gray-500">
                    {locale === "he" ? item.desc : "Fresh ingredients & herbs"}
                  </p>
                  <span className="mt-3 block text-base font-black text-gray-900">{item.price}</span>
                </div>
                <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-[#D7CCC8]/30 bg-[#F5F2EB]">
                  <div className="absolute -bottom-2 -right-2 rounded-full bg-[#2E7D32] p-1.5 text-white shadow-lg">
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border-t border-gray-100 bg-white p-5 shadow-[0_-15px_40px_rgba(0,0,0,0.1)]">
            <div className="mb-3 flex items-center gap-1.5 text-[#F57F17]">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-bold text-gray-600">
                {locale === "he" ? "הולך מעולה עם החומוס:" : "Pairs perfectly with Hummus:"}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-black text-[#3E2723]">
                {t.demoUpsell.split(":")[1]?.trim() || t.demoUpsell}
              </span>
              <button className="cursor-pointer rounded-xl border border-[#2E7D32]/20 bg-[#E8F5E9] px-4 py-2 text-sm font-black text-[#2E7D32] shadow-sm transition-transform active:scale-95">
                {t.demoAdd}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
