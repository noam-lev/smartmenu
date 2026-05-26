"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { STEPS } from "./types";

type Props = {
  currentStep: number;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextBusy?: boolean;
  hideBack?: boolean;
};

export default function WizardShell({
  currentStep,
  children,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  nextBusy,
  hideBack,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <nav className="overflow-x-auto" aria-label="Wizard progress">
        <ol className="flex min-w-max gap-1 px-1 py-2">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <li key={step.label} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <div
                    className={`h-px w-5 shrink-0 sm:w-8 ${
                      isCompleted ? "bg-zinc-900" : "bg-zinc-300"
                    }`}
                  />
                )}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    isCompleted
                      ? "bg-zinc-900 text-white"
                      : isCurrent
                        ? "border-2 border-zinc-900 text-zinc-900"
                        : "border border-zinc-300 text-zinc-400"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span
                  className={`whitespace-nowrap text-xs font-medium ${
                    isCurrent ? "text-zinc-900" : isCompleted ? "text-zinc-600" : "text-zinc-400"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        {children}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        {hideBack ? (
          <div />
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || nextBusy}
          className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextBusy ? "Working…" : nextLabel ?? "Next"}
        </button>
      </div>
    </div>
  );
}
