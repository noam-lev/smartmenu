"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Menu, Play, Star } from "lucide-react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";
import { getUiMessage, localeFlagSrc, otherLocale } from "../../utils/i18n";
import { HeroMagicDemo } from "./HeroMagicDemo";
import { LeadCaptureDialog } from "./LeadCaptureDialog";
import { LandingFaq } from "./LandingFaq";

/** Hero phone scene — edit these first when tuning the mockup. */
const HERO_PHONE_SCENE = {
  phoneTiltDeg: -14,
  phoneFloatPx: 14,
  phoneFloatDurationSec: 5.5,
  plateTiltDeg: 10,
  plateOffsetYRem: 1.25,
  heroFlightScaleStart: 1,
  heroFlightScaleEnd: 0.56,
  flightHoldMobileVh: 0.5,
  flightHoldDesktopVh: 0.08,
  flightHoldMobileRevealPaddingPx: 72,
  flightHoldMobileTravelCap: 0.52,
  phoneFlipMaxDeg: 360,
  phoneFlipLeadInVh: 0.28,
  phoneFlipTailOutVh: 0.22,
  phoneSideDepthPx: 11,
} as const;

const HERO_PHONE_SIZE_CLASSES =
  "h-[min(72vh,23rem)] w-[52vw] max-w-[240px] sm:h-[25.5rem] sm:w-[254px] lg:h-[31rem] lg:w-[286px]";

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function measureMobileFlightHold(heroAnchor: HTMLElement) {
  const rect = heroAnchor.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const scrollY = window.scrollY;
  const heroTopDoc = rect.top + scrollY;
  const heroBottomDoc = rect.bottom + scrollY;
  const revealBottomScroll =
    heroBottomDoc - viewportHeight + HERO_PHONE_SCENE.flightHoldMobileRevealPaddingPx;
  const revealTopScroll = Math.max(
    0,
    heroTopDoc - 80 - HERO_PHONE_SCENE.flightHoldMobileRevealPaddingPx,
  );
  const viewportHold = viewportHeight * HERO_PHONE_SCENE.flightHoldMobileVh;
  return Math.max(revealBottomScroll, revealTopScroll, viewportHold, 0);
}

function getFlightProgress(scrollY: number, travel: number, mobileHoldPx = 0) {
  const hold = isMobileViewport()
    ? Math.min(
        mobileHoldPx,
        travel * HERO_PHONE_SCENE.flightHoldMobileTravelCap,
      )
    : Math.min(window.innerHeight * HERO_PHONE_SCENE.flightHoldDesktopVh, travel * 0.1);
  const span = Math.max(travel - hold, 1);
  return Math.min(Math.max((scrollY - hold) / span, 0), 1);
}

function flightScale(progress: number) {
  return (
    HERO_PHONE_SCENE.heroFlightScaleStart +
    (HERO_PHONE_SCENE.heroFlightScaleEnd - HERO_PHONE_SCENE.heroFlightScaleStart) * progress
  );
}

function getHowItWorksFlipProgress(scrollY: number, sectionElement: HTMLElement) {
  const rect = sectionElement.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const sectionTopDoc = rect.top + scrollY;
  const sectionBottomDoc = sectionTopDoc + Math.max(rect.height, 1);
  const flipStart =
    sectionTopDoc - viewportHeight * HERO_PHONE_SCENE.phoneFlipLeadInVh;
  const flipEnd =
    sectionBottomDoc + viewportHeight * HERO_PHONE_SCENE.phoneFlipTailOutVh;
  const flipSpan = Math.max(flipEnd - flipStart, 1);

  return Math.min(Math.max((scrollY - flipStart) / flipSpan, 0), 1);
}

function getHowItWorksFlipDegrees(
  scrollY: number,
  sectionElement: HTMLElement,
  isRtl: boolean,
) {
  const progress = getHowItWorksFlipProgress(scrollY, sectionElement);
  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  const magnitude = HERO_PHONE_SCENE.phoneFlipMaxDeg * progress;
  return isRtl ? -magnitude : magnitude;
}

function TafritoBrandMark({
  label,
  className,
  iconClassName,
  textClassName,
}: {
  label: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`} aria-label={label} role="img">
      <img
        src="/icon.svg"
        alt=""
        className={iconClassName ?? "h-9 w-9 shrink-0 rounded-md"}
      />
      <span className={textClassName ?? "text-lg font-bold tracking-tight text-espresso"}>
        {label}
      </span>
    </div>
  );
}

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

const FEATURE_ORBIT_KEYS = [
  "feature1Short",
  "feature2Short",
  "feature3Short",
  "feature4Short",
  "feature5Short",
  "feature6Short",
] as const;

const FEATURE_ORBIT_BADGE_THEMES = [
  {
    surface: "bg-fresh-green",
    border: "border-fresh-green/80",
    text: "text-kraft",
    shadow: "shadow-[0_16px_44px_rgba(46,125,50,0.42)]",
  },
  {
    surface: "bg-warm-gold",
    border: "border-warm-gold/80",
    text: "text-espresso",
    shadow: "shadow-[0_16px_44px_rgba(245,127,23,0.38)]",
  },
  {
    surface: "bg-terracotta",
    border: "border-terracotta/80",
    text: "text-kraft",
    shadow: "shadow-[0_16px_44px_rgba(198,40,40,0.38)]",
  },
  {
    surface: "bg-espresso",
    border: "border-espresso/80",
    text: "text-kraft",
    shadow: "shadow-[0_16px_44px_rgba(62,39,35,0.42)]",
  },
  {
    surface: "bg-parchment",
    border: "border-espresso/25",
    text: "text-espresso",
    shadow: "shadow-[0_16px_44px_rgba(62,39,35,0.22)]",
  },
  {
    surface: "bg-warm-brown",
    border: "border-warm-brown/80",
    text: "text-kraft",
    shadow: "shadow-[0_16px_44px_rgba(93,64,55,0.38)]",
  },
] as const;

const FEATURE_ORBIT = FEATURE_ORBIT_KEYS.map((key, index) => ({
  key,
  angleDeg: -90 + index * (360 / FEATURE_ORBIT_KEYS.length),
  theme: FEATURE_ORBIT_BADGE_THEMES[index],
  floatDelaySec: index * 0.45,
}));

function measureDocCenter(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2 + window.scrollY,
  };
}

function measureFlightTravel(
  heroAnchor: HTMLElement,
  featuresAnchor: HTMLElement,
  travelRef: { current: number },
) {
  const heroDoc = measureDocCenter(heroAnchor);
  const featuresDoc = measureDocCenter(featuresAnchor);
  travelRef.current = Math.max(featuresDoc.y - heroDoc.y, 1);
}

function positionPhoneLayer(phoneLayer: HTMLElement, x: number, y: number, scale: number) {
  phoneLayer.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
  phoneLayer.classList.add("is-ready");
}

const PLANS = [
  { key: "starter", nameKey: "planStarterName" as const, priceKey: "planStarterPrice" as const, periodKey: "planStarterPeriod" as const, noteKey: "planStarterNote" as const, featuresKey: "planStarterFeatures" as const, popular: false },
  { key: "pro", nameKey: "planProName" as const, priceKey: "planProPrice" as const, periodKey: "planProPeriod" as const, noteKey: "planProNote" as const, featuresKey: "planProFeatures" as const, popular: true },
  { key: "studio", nameKey: "planStudioName" as const, priceKey: "planStudioPrice" as const, periodKey: "planStudioPeriod" as const, noteKey: "planStudioNote" as const, featuresKey: "planStudioFeatures" as const, popular: false },
];

const TRUSTED_LOGO_PLACEHOLDERS = [0, 1, 2, 3, 4] as const;

const TESTIMONIAL_TICKETS = [
  {
    quoteKey: "testimonial1Quote" as const,
    customerKey: "testimonial1Customer" as const,
    restaurantKey: "testimonial1Restaurant" as const,
    rotationClass: "rotate-1",
  },
  {
    quoteKey: "testimonial2Quote" as const,
    customerKey: "testimonial2Customer" as const,
    restaurantKey: "testimonial2Restaurant" as const,
    rotationClass: "-rotate-2",
  },
  {
    quoteKey: "testimonial3Quote" as const,
    customerKey: "testimonial3Customer" as const,
    restaurantKey: "testimonial3Restaurant" as const,
    rotationClass: "rotate-2",
  },
] as const;

export function TafritoLandingPage() {
  const [locale, setLocale] = useState<LandingLocale>("he");
  const [leadOpen, setLeadOpen] = useState(false);
  const [headerBlend, setHeaderBlend] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!langMenuOpen) {
      return;
    }
    const onDown = (event: MouseEvent) => {
      if (!langMenuRef.current?.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [langMenuOpen]);

  const heroPhoneAnchorRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const featuresCenterRef = useRef<HTMLDivElement>(null);
  const featuresOrbitRef = useRef<HTMLDivElement>(null);
  const phoneLayerRef = useRef<HTMLDivElement>(null);
  const phoneShellRef = useRef<HTMLDivElement>(null);
  const flightTravelRef = useRef(1);
  const mobileFlightHoldRef = useRef(0);
  const t = landingCopy[locale];
  const dir = locale === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.title = t.brand + " — " + (locale === "he" ? "תפריט דיגיטלי חכם" : "Smart Digital Menu");
  }, [locale, t.brand]);

  useEffect(() => {
    let frame = 0;

    const measureAnchors = () => {
      const heroAnchor = heroPhoneAnchorRef.current;
      const featuresAnchor = featuresCenterRef.current;
      if (!heroAnchor || !featuresAnchor) {
        return;
      }

      measureFlightTravel(heroAnchor, featuresAnchor, flightTravelRef);
      if (isMobileViewport()) {
        mobileFlightHoldRef.current = measureMobileFlightHold(heroAnchor);
      } else {
        mobileFlightHoldRef.current = 0;
      }
    };

    const updateScrollEffects = () => {
      const scrollY = window.scrollY;
      const headerProgress = Math.min(scrollY / 140, 1);
      setHeaderBlend(1 - (1 - headerProgress) ** 3);

      const heroAnchor = heroPhoneAnchorRef.current;
      const featuresAnchor = featuresCenterRef.current;
      const howItWorksSection = howItWorksRef.current;
      const phoneLayer = phoneLayerRef.current;
      const phoneShell = phoneShellRef.current;
      const featuresOrbit = featuresOrbitRef.current;

      if (!heroAnchor || !featuresAnchor || !phoneLayer || !phoneShell) {
        return;
      }

      measureAnchors();

      const heroRect = heroAnchor.getBoundingClientRect();
      const featuresRect = featuresAnchor.getBoundingClientRect();
      const heroX = heroRect.left + heroRect.width / 2;
      const heroY = heroRect.top + heroRect.height / 2;
      const featuresX = featuresRect.left + featuresRect.width / 2;
      const featuresY = featuresRect.top + featuresRect.height / 2;
      const progress = getFlightProgress(
        scrollY,
        flightTravelRef.current,
        mobileFlightHoldRef.current,
      );
      const x = heroX + (featuresX - heroX) * progress;
      const y = heroY + (featuresY - heroY) * progress;
      const scale = flightScale(progress);

      positionPhoneLayer(phoneLayer, x, y, scale);
      featuresOrbit?.style.setProperty("--phone-flight-progress", String(progress));

      const tiltDeg = HERO_PHONE_SCENE.phoneTiltDeg * (1 - progress);
      const flipDeg = howItWorksSection
        ? getHowItWorksFlipDegrees(scrollY, howItWorksSection, dir === "rtl")
        : 0;

      if (progress < 0.02) {
        phoneShell.classList.add("hero-phone-float");
        phoneShell.style.removeProperty("transform");
        phoneShell.style.setProperty("--hero-phone-tilt", `${HERO_PHONE_SCENE.phoneTiltDeg}deg`);
        phoneShell.style.setProperty("--hero-phone-float-y", `-${HERO_PHONE_SCENE.phoneFloatPx}px`);
        phoneShell.style.setProperty(
          "--hero-phone-float-duration",
          `${HERO_PHONE_SCENE.phoneFloatDurationSec}s`,
        );
      } else {
        phoneShell.classList.remove("hero-phone-float");
        phoneShell.style.transform = `rotate(${tiltDeg}deg) rotateY(${flipDeg}deg)`;
      }
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateScrollEffects();
      });
    };

    const onResize = () => {
      updateScrollEffects();
    };

    measureAnchors();
    updateScrollEffects();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            measureAnchors();
            updateScrollEffects();
          })
        : null;

    if (resizeObserver) {
      const heroAnchor = heroPhoneAnchorRef.current;
      const featuresAnchor = featuresCenterRef.current;
      const howItWorksSection = howItWorksRef.current;
      const featuresOrbit = featuresOrbitRef.current;
      if (heroAnchor) {
        resizeObserver.observe(heroAnchor);
      }
      if (howItWorksSection) {
        resizeObserver.observe(howItWorksSection);
      }
      if (featuresAnchor) {
        resizeObserver.observe(featuresAnchor);
      }
      if (featuresOrbit) {
        resizeObserver.observe(featuresOrbit);
      }
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      resizeObserver?.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [locale]);

  useLayoutEffect(() => {
    const heroAnchor = heroPhoneAnchorRef.current;
    const featuresAnchor = featuresCenterRef.current;
    const phoneLayer = phoneLayerRef.current;
    if (!heroAnchor || !featuresAnchor || !phoneLayer) {
      return;
    }

    measureFlightTravel(heroAnchor, featuresAnchor, flightTravelRef);
    mobileFlightHoldRef.current = isMobileViewport() ? measureMobileFlightHold(heroAnchor) : 0;

    const heroRect = heroAnchor.getBoundingClientRect();
    const x = heroRect.left + heroRect.width / 2;
    const y = heroRect.top + heroRect.height / 2;
    positionPhoneLayer(phoneLayer, x, y, 1);
    featuresOrbitRef.current?.style.setProperty("--phone-flight-progress", "0");
  }, [locale]);

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
          <TafritoBrandMark label={t.brand} className="shrink-0" />
          <div className="flex items-center gap-3 md:gap-5">
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="rounded-sm bg-fresh-green py-2.5 ps-5 pe-5 text-sm font-bold tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-px md:py-3 md:ps-6 md:pe-6"
            >
              {t.navCta}
            </button>
            <div className="relative hidden md:block" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={langMenuOpen}
                aria-label={getUiMessage("selectLanguage", locale)}
                className="inline-flex items-center gap-1 rounded-sm border border-espresso/15 bg-kraft/80 px-2 py-1.5"
              >
                <img
                  src={localeFlagSrc[locale]}
                  alt=""
                  className="h-4 w-[1.375rem] rounded-[2px] object-cover"
                  aria-hidden
                />
                <span className="text-[10px] text-warm-brown/70" aria-hidden>
                  ▾
                </span>
              </button>
              {langMenuOpen ? (
                <div
                  role="menu"
                  className="absolute end-0 z-30 mt-2 rounded-sm border border-espresso/15 bg-kraft p-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={getUiMessage(
                      otherLocale(locale) === "he" ? "languageHebrew" : "languageEnglish",
                      locale,
                    )}
                    onClick={() => {
                      setLocale(otherLocale(locale));
                      setLangMenuOpen(false);
                    }}
                    className="flex justify-center rounded-sm px-3 py-2 hover:bg-espresso/5"
                  >
                    <img
                      src={localeFlagSrc[otherLocale(locale)]}
                      alt=""
                      className="h-4 w-[1.375rem] rounded-[2px] object-cover"
                    />
                  </button>
                </div>
              ) : null}
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
            <button
              type="button"
              aria-label={getUiMessage(
                otherLocale(locale) === "he" ? "languageHebrew" : "languageEnglish",
                locale,
              )}
              onClick={() => {
                setLocale(otherLocale(locale));
                setMobileOpen(false);
              }}
              className="inline-flex rounded-sm border border-espresso/15 p-1.5"
            >
              <img
                src={localeFlagSrc[otherLocale(locale)]}
                alt=""
                className="h-4 w-[1.375rem] rounded-[2px] object-cover"
              />
            </button>
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

            <div className="flex w-full items-center justify-center pb-16 pt-10 sm:pb-20 sm:pt-8 lg:w-[45%] lg:pb-24 lg:pt-16">
              <div className="hero-phone-anchor-scene relative flex w-full max-w-sm items-center justify-center">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                  <div className="absolute h-[min(72vw,18rem)] w-[min(72vw,18rem)] rounded-full bg-warm-gold/20 blur-3xl md:h-[min(88vw,26rem)] md:w-[min(88vw,26rem)]" />
                  <div className="absolute h-[min(56vw,14rem)] w-[min(44vw,12rem)] -translate-y-6 rounded-[50%] bg-fresh-green/10 blur-2xl md:h-[min(72vw,20rem)] md:w-[min(56vw,16rem)]" />
                </div>
                <div
                  className="absolute z-[1] h-[min(72vw,19rem)] w-[min(72vw,19rem)] rounded-full border border-espresso/15 bg-[radial-gradient(circle_at_35%_30%,#FFFDF8_0%,#F5F2EB_55%,#EBE6D9_100%)] shadow-[0_28px_60px_-18px_rgba(62,39,35,0.28)] md:h-[30rem] md:w-[30rem]"
                  style={{
                    transform: `translateY(${HERO_PHONE_SCENE.plateOffsetYRem}rem) rotate(${HERO_PHONE_SCENE.plateTiltDeg}deg)`,
                  }}
                  aria-hidden
                >
                  <div className="absolute inset-[10%] rounded-full border border-espresso/10 bg-parchment/70 shadow-[inset_0_10px_24px_rgba(62,39,35,0.08)]" />
                  <div className="absolute inset-[22%] rounded-full border border-dashed border-espresso/10" />
                </div>
                <div
                  ref={heroPhoneAnchorRef}
                  className={`relative z-[2] shrink-0 ${HERO_PHONE_SIZE_CLASSES}`}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </section>

        <div
          ref={phoneLayerRef}
          className="hero-phone-flight-layer pointer-events-none fixed left-0 top-0 z-30 will-change-transform"
        >
          <div
            ref={phoneShellRef}
            className={`hero-phone-shell-3d pointer-events-auto relative z-10 rounded-[3rem] bg-[#1a1a1a] p-3 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.45)] hero-phone-float ${HERO_PHONE_SIZE_CLASSES}`}
            style={
              {
                "--hero-phone-tilt": `${HERO_PHONE_SCENE.phoneTiltDeg}deg`,
                "--hero-phone-float-y": `-${HERO_PHONE_SCENE.phoneFloatPx}px`,
                "--hero-phone-float-duration": `${HERO_PHONE_SCENE.phoneFloatDurationSec}s`,
                "--hero-phone-side-depth": `${HERO_PHONE_SCENE.phoneSideDepthPx}px`,
              } as React.CSSProperties
            }
          >
            <div className="hero-phone-flip-body">
              <div className="hero-phone-side-edge" aria-hidden />
              <div className="hero-phone-front-face relative h-full w-full overflow-hidden rounded-[2.25rem] bg-kraft shadow-inner">
                <div className="absolute inset-x-0 top-0 z-50 mx-auto h-6 w-32 rounded-b-2xl bg-[#1a1a1a]" />
                <HeroMagicDemo locale={locale} />
              </div>
            </div>
          </div>
        </div>

        <section
          ref={howItWorksRef}
          className="bg-kraft py-24 lg:py-32"
        >
          <div className="mx-auto grid max-w-[1400px] gap-12 ps-8 pe-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:ps-12 lg:pe-12">
            <div className="flex flex-col items-start">
              <h2 className="text-4xl font-black leading-tight tracking-tight text-espresso md:text-5xl">
                {t.howItWorksTitle}
              </h2>
              <p className="mt-6 max-w-xl text-lg font-medium leading-snug tracking-tight text-warm-brown">
                {t.howItWorksBody}
              </p>
              <button
                type="button"
                onClick={() => setLeadOpen(true)}
                className="mt-10 rounded-sm border-b-4 border-fresh-green/80 bg-fresh-green py-4 ps-10 pe-10 text-sm font-bold uppercase tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-1"
              >
                {t.howItWorksCta}
              </button>
            </div>

            <div className="relative">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-espresso/10 bg-parchment shadow-[0_24px_60px_rgba(62,39,35,0.12)]">
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,127,23,0.12),transparent_55%),linear-gradient(135deg,#FFFDF8_0%,#EBE6D9_100%)]"
                  aria-hidden
                />
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center"
                  aria-label={t.howItWorksVideoLabel}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-espresso/15 bg-kraft/90 text-espresso shadow-[0_12px_30px_rgba(62,39,35,0.14)] transition hover:scale-105">
                    <Play className="ms-0.5 h-7 w-7 fill-espresso text-espresso" strokeWidth={1.5} aria-hidden />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-x-clip sm:overflow-hidden bg-gradient-to-r from-[#FFFDF8] via-[#E8E1D4] to-[#14100E] pt-24 pb-16 sm:pt-32 sm:pb-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,127,23,0.14),transparent_55%)]" aria-hidden />
          <div className="relative mx-auto max-w-[1200px] px-8 text-center">
            <span className="text-xs font-bold uppercase tracking-tight text-espresso/70 sm:text-sm">{t.featuresTitle}</span>
          </div>

          <div
            ref={featuresOrbitRef}
            className="features-orbit-scene relative mx-auto mt-8 flex min-h-[min(88vh,720px)] w-full max-w-[1400px] items-center justify-center px-4 sm:mt-12 sm:min-h-[min(92vh,760px)] sm:px-6 lg:min-h-[min(95vh,820px)]"
          >
            <div
              ref={featuresCenterRef}
              className="pointer-events-none absolute left-1/2 top-[calc(50%+var(--orbit-center-y-shift))] h-0 w-0 -translate-x-1/2 -translate-y-1/2"
              aria-hidden
            />

            <div
              className="features-orbit-halo pointer-events-none absolute left-1/2 top-[calc(50%+var(--orbit-center-y-shift))] z-0 h-[min(64vw,16rem)] w-[min(64vw,16rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-warm-gold/20 blur-3xl md:h-[min(58vw,22rem)] md:w-[min(58vw,22rem)]"
              aria-hidden
            />
            <div
              className="features-orbit-halo pointer-events-none absolute left-1/2 top-[calc(50%+var(--orbit-center-y-shift))] z-0 h-[min(52vw,13rem)] w-[min(52vw,13rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-warm-gold/25 bg-warm-gold/5 shadow-[0_0_60px_rgba(245,127,23,0.18)] md:h-[min(46vw,17rem)] md:w-[min(46vw,17rem)]"
              aria-hidden
            />

            {FEATURE_ORBIT.map((feature) => {
              const badgeAboveCenter = feature.angleDeg > -90 && feature.angleDeg < 90;

              return (
                <div
                  key={feature.key}
                  className={`features-orbit-badge absolute left-1/2 top-[calc(50%+var(--orbit-center-y-shift))] ${badgeAboveCenter ? "z-40" : "z-10"}`}
                  style={{
                    transform: `translate(-50%, -50%) rotate(${feature.angleDeg}deg) translateY(calc(-1 * var(--orbit-radius))) rotate(${-feature.angleDeg}deg)`,
                  }}
                >
                  <span
                    className={`features-orbit-badge-float flex h-20 w-20 items-center justify-center rounded-full border-2 px-2 text-center text-[11px] font-bold leading-tight sm:h-24 sm:w-24 sm:px-3 sm:text-sm lg:h-28 lg:w-28 lg:text-base ${feature.theme.surface} ${feature.theme.border} ${feature.theme.text} ${feature.theme.shadow}`}
                    style={
                      {
                        "--orbit-float-delay": `${feature.floatDelaySec}s`,
                      } as React.CSSProperties
                    }
                  >
                    {t[feature.key]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-[#EBE6D9] py-24">
          <div className="mx-auto max-w-[1200px] ps-8 pe-8">
            <p className="mb-8 text-center text-xs font-bold uppercase tracking-tight text-warm-brown/70">
              {t.socialProofTrustedBy}
            </p>

            <div className="mb-16 flex flex-wrap items-center justify-center gap-4 md:gap-8">
              {TRUSTED_LOGO_PLACEHOLDERS.map((logoIndex) => (
                <div
                  key={logoIndex}
                  className="h-12 w-28 shrink-0 rounded-sm border border-espresso/15 bg-parchment/80"
                  aria-hidden
                />
              ))}
            </div>

            <div className="grid gap-10 md:grid-cols-3 md:gap-8">
              {TESTIMONIAL_TICKETS.map((ticket) => (
                <div
                  key={ticket.quoteKey}
                  className={`bg-white p-8 font-mono shadow-[0_16px_40px_rgba(62,39,35,0.1)] border-t-[8px] border-b-[8px] border-dashed border-[#D7CCC8] ${ticket.rotationClass}`}
                >
                  <div className="flex gap-1" aria-hidden>
                    {Array.from({ length: 5 }, (_, starIndex) => (
                      <Star
                        key={starIndex}
                        className="h-4 w-4 fill-warm-gold text-warm-gold"
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>

                  <p className="mt-6 text-base leading-snug text-espresso">{t[ticket.quoteKey]}</p>

                  <div className="mt-8 border-t border-dashed border-[#D7CCC8] pt-6">
                    <p className="font-bold text-espresso">{t[ticket.customerKey]}</p>
                    <p className="mt-1 font-bold text-warm-brown">{t[ticket.restaurantKey]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="landing-faq-pricing-stack">
          <LandingFaq locale={locale} />

          <section className="pricing-below-faq border-b border-espresso/10 pb-24">
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
        </div>
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
