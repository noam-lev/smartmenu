"use client";

import { useState, useEffect } from "react";
import { ReceiptText } from "lucide-react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";
import { HeroMagicDemo } from "./HeroMagicDemo";
import { LeadCaptureDialog } from "./LeadCaptureDialog";

const TABLE_IMAGE = "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=1200";

const FEATURES = [
  { num: "01", titleKey: "feature1Title" as const, bodyKey: "feature1Body" as const },
  { num: "02", titleKey: "feature2Title" as const, bodyKey: "feature2Body" as const },
  { num: "03", titleKey: "feature3Title" as const, bodyKey: "feature3Body" as const },
];

const PLANS = [
  { key: "starter", nameKey: "planStarterName" as const, priceKey: "planStarterPrice" as const, periodKey: "planStarterPeriod" as const, noteKey: "planStarterNote" as const, featuresKey: "planStarterFeatures" as const, popular: false },
  { key: "pro", nameKey: "planProName" as const, priceKey: "planProPrice" as const, periodKey: "planProPeriod" as const, noteKey: "planProNote" as const, featuresKey: "planProFeatures" as const, popular: true },
  { key: "studio", nameKey: "planStudioName" as const, priceKey: "planStudioPrice" as const, periodKey: "planStudioPeriod" as const, noteKey: "planStudioNote" as const, featuresKey: "planStudioFeatures" as const, popular: false },
];

export function TafritoLandingPage() {
  const [locale, setLocale] = useState<LandingLocale>("he");
  const [leadOpen, setLeadOpen] = useState(false);
  const t = landingCopy[locale];
  const dir = locale === "he" ? "rtl" : "ltr";
  const serif = locale === "he" ? "font-serifHe" : "font-serif";

  useEffect(() => {
    document.title = t.brand + " — " + (locale === "he" ? "תפריט דיגיטלי חכם" : "Smart Digital Menu");
  }, [locale, t.brand]);

  return (
    <div dir={dir} lang={locale} className="min-h-screen bg-kraft text-warm-brown selection:bg-fresh-green/10">
      <LeadCaptureDialog open={leadOpen} onClose={() => setLeadOpen(false)} locale={locale} />

      {/* NAVBAR */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-espresso/10 bg-kraft/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 md:px-10">
          <span className={`${serif} text-2xl font-black text-espresso`}>{t.brand}</span>
          <div className="flex items-center gap-6 font-sans text-xs uppercase tracking-widest">
            <button onClick={() => setLocale("he")} className={locale === "he" ? "text-espresso font-bold" : "opacity-50"}>עב</button>
            <button onClick={() => setLocale("en")} className={locale === "en" ? "text-espresso font-bold" : "opacity-50"}>EN</button>
          </div>
        </div>
      </header>

      <main className="pt-20">
        {/* SECTION 1: HERO WITH PERFECT FADE (45% - 60%) */}
        <section className="relative flex min-h-[calc(100vh-80px)] flex-col items-center overflow-hidden bg-kraft lg:flex-row">
          
          {/* Background with Precise Gradient Mask */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${TABLE_IMAGE})`,
                filter: "brightness(0.85) sepia(0.15)",
                WebkitMaskImage: locale === "he" 
                  ? "linear-gradient(to right, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 60%)" 
                  : "linear-gradient(to left, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 60%)",
                maskImage: locale === "he" 
                  ? "linear-gradient(to right, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 60%)" 
                  : "linear-gradient(to left, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 60%)"
              }}
            />
            <div className="absolute inset-0 bg-espresso/5 mix-blend-multiply" />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between px-8 lg:flex-row lg:px-12">
            
            {/* TEXT SIDE - PURE READABILITY */}
            <div className="flex w-full flex-col items-start py-16 lg:w-[45%] lg:py-24">
              <span className="mb-8 inline-flex items-center rounded-full bg-fresh-green/10 px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wider text-fresh-green border border-fresh-green/20">
                {t.badge}
              </span>
              <h1 className={`${serif} text-5xl font-black leading-[1.05] text-espresso sm:text-6xl lg:text-7xl`}>
                {t.heroTitle}
              </h1>
              <div className="mt-8 max-w-md border-s-4 border-espresso/20 ps-6">
                <p className="text-lg leading-relaxed text-warm-brown font-medium italic">
                  {t.heroSubtitle}
                </p>
              </div>
              <button
                onClick={() => setLeadOpen(true)}
                className="mt-12 rounded-xl bg-terracotta px-10 py-4 font-sans text-sm font-bold uppercase tracking-widest text-kraft shadow-xl transition-all hover:bg-terracotta/90 active:translate-y-1 border-b-4 border-espresso/20"
              >
                {t.heroCta}
              </button>
            </div>

            {/* SMALLER CENTERED PHONE */}
            <div className="flex w-full items-center justify-center py-12 lg:w-[45%] lg:py-24">
              <div className="perspective-1000 w-full flex justify-center">
                <div className="relative w-[240px] lg:w-[260px] h-[520px] lg:h-[560px] rotate-[-2deg] rounded-[3rem] bg-[#1a1a1a] p-3 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] transition-transform duration-700 hover:rotate-0">
                  <div className="h-full w-full overflow-hidden rounded-[2.25rem] bg-kraft relative shadow-inner">
                    <div className="absolute top-0 inset-x-0 z-50 mx-auto h-6 w-32 rounded-b-2xl bg-[#1a1a1a]"></div>
                    <HeroMagicDemo locale={locale} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 2: EDITORIAL FEATURES (WHY CHOOSE US) */}
        <section className="bg-[#FFFDF8] py-24 relative border-y border-espresso/10">
          <div className="max-w-[1200px] mx-auto px-8 flex flex-col lg:flex-row gap-16 lg:gap-24">
            <div className="lg:w-1/3 lg:sticky lg:top-32 h-fit">
              <span className="text-terracotta font-bold text-sm tracking-widest mb-4 block uppercase">{t.featuresTitle}</span>
              <h2 className={`${serif} text-4xl md:text-5xl font-black text-espresso leading-tight`}>
                יותר מ-QR פשוט.<br/>המלצר הכי טוב שלכם.
              </h2>
            </div>

            <div className="lg:w-2/3 flex flex-col gap-12 lg:gap-16">
              {FEATURES.map((f) => (
                <div key={f.num} className="border-t-2 border-espresso/10 pt-8 flex flex-col sm:flex-row gap-6 lg:gap-10">
                  <div className={`${serif} text-5xl lg:text-6xl text-espresso/15 font-black italic shrink-0`}>
                    {f.num}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-espresso mb-3">{t[f.titleKey]}</h3>
                    <p className="text-lg text-warm-brown leading-relaxed font-medium">
                      {t[f.bodyKey]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: PRICING (SIMPLE & CLEAN) */}
        <section className="bg-kraft py-24 border-b border-espresso/10">
          <div className="max-w-[1200px] mx-auto px-8 text-center">
            <h2 className={`${serif} text-4xl md:text-5xl font-black text-espresso mb-6`}>{t.pricingTitle}</h2>
            <p className="text-lg text-warm-brown mb-16 max-w-2xl mx-auto">{t.pricingSub}</p>
            
            <div className="grid md:grid-cols-3 gap-0 border border-espresso/15 shadow-sm rounded-sm overflow-hidden">
              {PLANS.map((plan) => (
                <div key={plan.key} className={`p-10 flex flex-col text-start border-b md:border-b-0 md:border-e border-espresso/15 last:border-none ${plan.popular ? 'bg-parchment/60' : 'bg-transparent'}`}>
                  {plan.popular && <span className="text-[10px] font-bold uppercase tracking-widest text-terracotta mb-4">{t.planPopular}</span>}
                  {!plan.popular && <div className="h-[14px] mb-4" />}
                  <h3 className={`${serif} text-2xl font-bold text-espresso`}>{t[plan.nameKey]}</h3>
                  <p className="font-mono text-xs text-warm-brown/70 mt-1 mb-8">{t[plan.noteKey]}</p>
                  <div className="mb-8">
                    <span className="text-4xl font-black text-espresso">{t[plan.priceKey]}</span>
                    <span className="text-sm text-warm-brown/60 ms-1">{t[plan.periodKey]}</span>
                  </div>
                  <ul className="space-y-4 mb-10 flex-1 border-t border-dashed border-espresso/10 pt-8">
                    {t[plan.featuresKey].map((feat) => (
                      <li key={feat} className="flex gap-3 text-sm font-medium text-warm-brown leading-snug">
                        <span className="text-fresh-green">✓</span> {feat}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setLeadOpen(true)} className="w-full border-2 border-espresso/20 py-3 font-sans text-xs font-bold uppercase tracking-widest text-espresso hover:bg-espresso hover:text-kraft transition-all">
                    {t.planCta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: KITCHEN TICKET (THE "BON") */}
        <section className="bg-[#EBE6D9] py-24">
          <div className="mx-auto max-w-md px-6">
            <div className="rotate-1 border-t-[10px] border-b-[10px] border-dashed border-ticket-rule bg-white p-10 shadow-[0_20px_50px_rgba(62,39,35,0.1)]">
              <ReceiptText className="h-12 w-12 text-espresso/40 mb-6" strokeWidth={1.5} />
              <div className="font-mono text-xs uppercase tracking-widest text-warm-brown/60 space-y-1 mb-8">
                <p>{t.ticketTable}</p>
                <p>{t.ticketTime}</p>
              </div>
              <div className="space-y-4 border-t border-dashed border-ticket-rule pt-8 font-mono text-base text-espresso">
                <div className="flex justify-between"><span>1x {t.ticketLine1}</span></div>
                <div className="flex justify-between text-terracotta font-bold"><span>1x {t.ticketLine2}</span></div>
                <div className="flex justify-between pt-6 border-t border-dotted border-espresso/10 text-xl font-bold">
                  <span>{t.ticketTotal}</span>
                </div>
              </div>
              <button
                onClick={() => setLeadOpen(true)}
                className="mt-12 w-full bg-espresso py-5 font-sans text-sm font-bold uppercase tracking-widest text-kraft shadow-xl transition-all active:translate-y-1"
              >
                {t.ticketCta}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-espresso text-kraft/60 py-12 text-center">
        <div className="max-w-[1400px] mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className={`${serif} text-xl text-kraft font-bold`}>{t.brand}</span>
          <p className="text-xs font-medium tracking-wide">
            © {new Date().getFullYear()} — בנוי למסעדנים שאוהבים לארח.
          </p>
        </div>
      </footer>
    </div>
  );
}