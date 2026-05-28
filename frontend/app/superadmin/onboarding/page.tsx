"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  checkSlugAvailability,
  onboardRestaurant,
  type OnboardResult,
} from "../../../lib/superadminApi";
import { STEPS, INITIAL_STATE, type WizardState } from "../../../components/superadmin/onboarding/types";
import WizardShell from "../../../components/superadmin/onboarding/WizardShell";
import StepRestaurantInfo from "../../../components/superadmin/onboarding/StepRestaurantInfo";
import StepMenuUpload from "../../../components/superadmin/onboarding/StepMenuUpload";
import StepImages from "../../../components/superadmin/onboarding/StepImages";
import StepSettings from "../../../components/superadmin/onboarding/StepSettings";
import StepOwnerPlan from "../../../components/superadmin/onboarding/StepOwnerPlan";
import StepReview from "../../../components/superadmin/onboarding/StepReview";

export default function SuperadminOnboardingPage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);

  const handleChange = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
    setError(null);
  }, []);

  const validateAndNext = async () => {
    setError(null);

    if (step === 0) {
      if (!state.name.trim()) {
        setError("Restaurant name is required.");
        return;
      }
      if (!state.slug.trim()) {
        setError("Slug is required.");
        return;
      }
      setBusy(true);
      try {
        const { available } = await checkSlugAvailability(state.slug);
        if (!available) {
          setError(`Slug "${state.slug}" is already taken.`);
          return;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check slug availability.",
        );
        return;
      } finally {
        setBusy(false);
      }
    }

    if (step === 1) {
      if (
        !state.parsedMenu ||
        state.parsedMenu.categories.length === 0
      ) {
        setError("Please upload and parse a menu, or add at least one category.");
        return;
      }
    }

    if (step === STEPS.length - 1) {
      await handleCreate();
      return;
    }

    setStep((s) => s + 1);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await onboardRestaurant({
        restaurant_name: state.name.trim(),
        restaurant_slug: state.slug.trim(),
        categories: state.parsedMenu?.categories ?? [],
        currency: state.currency,
        default_locale: state.defaultLocale,
        banner_image_url: state.bannerUrl,
        qr_logo_url: state.qrLogoUrl,
        item_images: state.itemImages,
        owner_email: state.ownerEmail.trim() || null,
        plan_tier: state.planTier,
      });
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create restaurant.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-emerald-800">
            Restaurant Created!
          </h1>
          <p className="mt-2 text-sm text-emerald-700">
            <strong>{result.restaurant_name}</strong> was created with{" "}
            {result.categories_imported} categories and{" "}
            {result.items_imported} items.
            {result.owner_linked && " Owner has been linked."}
          </p>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/superadmin/restaurants/${result.restaurant_slug}`}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Manage Restaurant
            </Link>
            <Link
              href={`/${result.restaurant_slug}`}
              target="_blank"
              className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700"
            >
              View Diner Page
            </Link>
            <button
              type="button"
              onClick={() => {
                setState(INITIAL_STATE);
                setStep(0);
                setResult(null);
                setError(null);
              }}
              className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700"
            >
              Onboard Another
            </button>
          </div>
        </div>
      </main>
    );
  }

  const stepComponent = (() => {
    const props = { state, onChange: handleChange };
    switch (step) {
      case 0:
        return <StepRestaurantInfo {...props} />;
      case 1:
        return <StepMenuUpload {...props} />;
      case 2:
        return <StepImages {...props} />;
      case 3:
        return <StepSettings {...props} />;
      case 4:
        return <StepOwnerPlan {...props} />;
      case 5:
        return <StepReview {...props} />;
      default:
        return null;
    }
  })();

  return (
    <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
      <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
        Onboarding
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-500">
        Create a new restaurant step by step.
      </p>

      <div className="mt-6">
        <WizardShell
          currentStep={step}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={() => void validateAndNext()}
          nextLabel={step === STEPS.length - 1 ? "Create Restaurant" : "Next"}
          nextDisabled={false}
          nextBusy={busy}
          hideBack={step === 0}
        >
          {stepComponent}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </WizardShell>
      </div>
    </main>
  );
}
