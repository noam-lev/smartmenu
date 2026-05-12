"use client";

import { useState, useEffect } from "react";
import { Menu, ReceiptText } from "lucide-react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";
import { HeroMagicDemo } from "./HeroMagicDemo";
import { LeadCaptureDialog } from "./LeadCaptureDialog";

/** Hero phone scene — edit these first when tuning the mockup. */
const HERO_PHONE_SCENE = {
  phoneTiltDeg: -14,
  phoneFloatPx: 14,
  phoneFloatDurationSec: 5.5,
  plateWidthRem: 30,
  plateHeightRem: 30,
  plateTiltDeg: 10,
  plateOffsetYRem: 1.25,
} as const;

function renderHeroTitle(title: string) {
  const trimmed = title.trimEnd();
  if (trimmed.endsWith(".")) {
    return (
      <>
        {trimmed.slice(0, -1)}
        <span className="text-warm-gold">.</span>
      </>
    );
  }
  return title;
}

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
  const [headerBlend, setHeaderBlend] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = landingCopy[locale];
  const dir = locale === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.title = t.brand + " — " + (locale === "he" ? "תפריט דיגיטלי חכם" : "Smart Digital Menu");
  }, [locale, t.brand]);

  useEffect(() => {
    const onScroll = () => {
      const progress = Math.min(window.scrollY / 140, 1);
      const eased = 1 - (1 - progress) ** 3;
      setHeaderBlend(eased);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div dir={dir} lang={locale} className="min-h-screen bg-kraft font-sans tracking-tight leading-snug text-warm-brown selection:bg-fresh-green/10">
      <LeadCaptureDialog open={leadOpen} onClose={() => setLeadOpen(false)} locale={locale} />

      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-transparent transition-[background-color,border-color,box-shadow,backdrop-filter] duration-700 ease-out"
        style={{
          backgroundColor: `rgba(245, 242, 235, ${headerBlend * 0.94})`,
          borderBottomColor: `rgba(62, 39, 35, ${headerBlend * 0.12})`,
          boxShadow: `0 10px 30px rgba(62, 39, 35, ${headerBlend * 0.06})`,
          backdropFilter: headerBlend > 0.02 ? `blur(${headerBlend * 14}px)` : "none",
          WebkitBackdropFilter: headerBlend > 0.02 ? `blur(${headerBlend * 14}px)` : "none",
        }}
      >
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between gap-4 ps-6 pe-6 md:ps-10 md:pe-10">
          <div
            className="h-10 w-28 shrink-0 rounded-sm border border-espresso/15 bg-parchment/80"
            aria-label={t.brand}
            role="img"
          />
          <div className="flex items-center gap-3 md:gap-5">
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="rounded-sm bg-fresh-green py-2.5 ps-5 pe-5 text-sm font-bold tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-px md:py-3 md:ps-6 md:pe-6"
            >
              {t.navCta}
            </button>
            <div className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-tight md:flex">
              <button
                type="button"
                onClick={() => setLocale("he")}
                className={locale === "he" ? "text-espresso" : "text-warm-brown/60"}
              >
                {t.langHe}
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={locale === "en" ? "text-espresso" : "text-warm-brown/60"}
              >
                {t.langEn}
              </button>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-sm border border-espresso/15 p-2 text-espresso md:hidden"
              aria-label={locale === "he" ? "תפריט" : "Menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div
            className="border-t border-espresso/10 ps-6 pe-6 py-4 backdrop-blur-md md:hidden"
            style={{
              backgroundColor: `rgba(245, 242, 235, ${Math.max(headerBlend, 0.9)})`,
            }}
          >
            <div className="flex items-center gap-6 text-sm font-semibold tracking-tight">
              <button
                type="button"
                onClick={() => {
                  setLocale("he");
                  setMobileOpen(false);
                }}
                className={locale === "he" ? "text-espresso" : "text-warm-brown/60"}
              >
                {t.langHe}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocale("en");
                  setMobileOpen(false);
                }}
                className={locale === "en" ? "text-espresso" : "text-warm-brown/60"}
              >
                {t.langEn}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="pt-20">
        <section className="flex min-h-[calc(100vh-80px)] flex-col items-center bg-kraft lg:flex-row">
          <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between ps-8 pe-8 lg:flex-row lg:ps-12 lg:pe-12">
            <div className="flex w-full flex-col items-start py-16 lg:w-[45%] lg:py-24">
              <h1 className="text-5xl font-black leading-tight text-espresso sm:text-6xl lg:text-7xl">
                {renderHeroTitle(t.heroTitle)}
              </h1>
              <div className="mt-8 max-w-md border-s-4 border-espresso/20 ps-6">
                <p className="text-lg font-medium leading-snug text-warm-brown">{t.heroSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setLeadOpen(true)}
                className="mt-12 rounded-sm bg-fresh-green py-4 ps-10 pe-10 text-sm font-bold uppercase tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-px"
              >
                {t.heroCta}
              </button>
            </div>

            <div className="flex w-full items-center justify-center py-12 lg:w-[45%] lg:py-24">
              <div className="relative flex w-full max-w-sm items-center justify-center">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                  <div className="absolute h-[min(88vw,26rem)] w-[min(88vw,26rem)] rounded-full bg-warm-gold/20 blur-3xl" />
                  <div className="absolute h-[min(72vw,20rem)] w-[min(56vw,16rem)] -translate-y-6 rounded-[50%] bg-fresh-green/10 blur-2xl" />
                </div>
                <div
                  className="absolute z-[5] rounded-full border border-espresso/15 bg-[radial-gradient(circle_at_35%_30%,#FFFDF8_0%,#F5F2EB_55%,#EBE6D9_100%)] shadow-[0_28px_60px_-18px_rgba(62,39,35,0.28)]"
                  style={{
                    width: `${HERO_PHONE_SCENE.plateWidthRem}rem`,
                    height: `${HERO_PHONE_SCENE.plateHeightRem}rem`,
                    transform: `translateY(${HERO_PHONE_SCENE.plateOffsetYRem}rem) rotate(${HERO_PHONE_SCENE.plateTiltDeg}deg)`,
                  }}
                  aria-hidden
                >
                  <div className="absolute inset-[10%] rounded-full border border-espresso/10 bg-parchment/70 shadow-[inset_0_10px_24px_rgba(62,39,35,0.08)]" />
                  <div className="absolute inset-[22%] rounded-full border border-dashed border-espresso/10" />
                </div>
                <div
                  className="hero-phone-float relative z-10 h-[500px] w-[240px] rounded-[3rem] bg-[#1a1a1a] p-3 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.45)] lg:h-[560px] lg:w-[260px]"
                  style={
                    {
                      "--hero-phone-tilt": `${HERO_PHONE_SCENE.phoneTiltDeg}deg`,
                      "--hero-phone-float-y": `-${HERO_PHONE_SCENE.phoneFloatPx}px`,
                      "--hero-phone-float-duration": `${HERO_PHONE_SCENE.phoneFloatDurationSec}s`,
                    } as React.CSSProperties
                  }
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-kraft shadow-inner">
                    <div className="absolute inset-x-0 top-0 z-50 mx-auto h-6 w-32 rounded-b-2xl bg-[#1a1a1a]" />
                    <HeroMagicDemo locale={locale} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-y border-espresso/10 bg-[#FFFDF8] py-24">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-16 ps-8 pe-8 lg:flex-row lg:gap-24">
            <div className="h-fit lg:sticky lg:top-32 lg:w-1/3">
              <span className="mb-4 block text-sm font-bold uppercase tracking-tight text-espresso/70">
                {t.featuresTitle}
              </span>
              <h2 className="text-4xl font-black leading-tight text-espresso md:text-5xl">
                יותר מ-QR פשוט.
                <br />
                המלצר הכי טוב שלכם.
              </h2>
            </div>

            <div className="flex flex-col gap-12 lg:w-2/3 lg:gap-16">
              {FEATURES.map((f) => (
                <div
                  key={f.num}
                  className="flex flex-col gap-6 border-t-2 border-espresso/10 pt-8 sm:flex-row lg:gap-10"
                >
                  <div className="shrink-0 text-5xl font-black leading-none text-espresso/15 lg:text-6xl">
                    {f.num}
                  </div>
                  <div>
                    <h3 className="mb-3 text-2xl font-black text-espresso">{t[f.titleKey]}</h3>
                    <p className="text-lg font-medium leading-snug text-warm-brown">{t[f.bodyKey]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-espresso/10 bg-kraft py-24">
          <div className="mx-auto max-w-[1200px] ps-8 pe-8 text-center">
            <h2 className="mb-6 text-4xl font-black leading-tight text-espresso md:text-5xl">
              {t.pricingTitle}
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-lg leading-snug text-warm-brown">{t.pricingSub}</p>

            <div className="grid gap-0 overflow-hidden rounded-sm border border-espresso/15 shadow-sm md:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={`flex flex-col border-b border-espresso/15 p-10 text-start md:border-b-0 md:border-e last:border-none ${plan.popular ? "bg-parchment/60" : "bg-transparent"}`}
                >
                  {plan.popular ? (
                    <span className="mb-4 text-[10px] font-bold uppercase tracking-tight text-espresso/70">
                      {t.planPopular}
                    </span>
                  ) : (
                    <div className="mb-4 h-[14px]" />
                  )}
                  <h3 className="text-2xl font-bold text-espresso">{t[plan.nameKey]}</h3>
                  <p className="mt-1 mb-8 font-mono text-xs text-warm-brown/70">{t[plan.noteKey]}</p>
                  <div className="mb-8">
                    <span className="text-4xl font-black text-espresso">{t[plan.priceKey]}</span>
                    <span className="ms-1 text-sm text-warm-brown/60">{t[plan.periodKey]}</span>
                  </div>
                  <ul className="mb-10 flex-1 space-y-4 border-t border-dashed border-espresso/10 pt-8">
                    {t[plan.featuresKey].map((feat) => (
                      <li key={feat} className="flex gap-3 text-sm font-medium leading-snug text-warm-brown">
                        <span className="text-fresh-green">✓</span> {feat}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setLeadOpen(true)}
                    className="w-full rounded-sm bg-fresh-green py-3 text-xs font-bold uppercase tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-px"
                  >
                    {t.planCta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#EBE6D9] py-24">
          <div className="mx-auto max-w-md ps-6 pe-6">
            <div className="rotate-1 border-t-[10px] border-b-[10px] border-dashed border-ticket-rule bg-white p-10 shadow-[0_20px_50px_rgba(62,39,35,0.1)]">
              <ReceiptText className="mb-6 h-12 w-12 text-espresso/40" strokeWidth={1.5} aria-hidden />
              <div className="mb-8 space-y-1 font-mono text-xs uppercase tracking-tight text-warm-brown/60">
                <p>{t.ticketTable}</p>
                <p>{t.ticketTime}</p>
              </div>
              <div className="space-y-4 border-t border-dashed border-ticket-rule pt-8 font-mono text-base text-espresso">
                <div className="flex justify-between">
                  <span>1x {t.ticketLine1}</span>
                </div>
                <div className="flex justify-between font-bold text-espresso">
                  <span>1x {t.ticketLine2}</span>
                </div>
                <div className="flex justify-between border-t border-dotted border-espresso/10 pt-6 text-xl font-bold">
                  <span>{t.ticketTotal}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeadOpen(true)}
                className="mt-12 w-full bg-fresh-green py-5 text-sm font-bold uppercase tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-px"
              >
                {t.ticketCta}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-espresso py-12 text-center text-kraft/60">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-6 ps-10 pe-10 md:flex-row">
          <span className="text-xl font-bold text-kraft">{t.brand}</span>
          <p className="text-xs font-medium tracking-tight">
            © {new Date().getFullYear()} — בנוי למסעדנים שאוהבים לארח.
          </p>
        </div>
      </footer>
    </div>
  );
}
