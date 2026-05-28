"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { signInWithGoogle, getCurrentPathForAuthReturn } from "../auth/googleSignIn";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";

type LandingLoginDialogProps = {
  open: boolean;
  onClose: () => void;
  locale: LandingLocale;
  /** Where to return after OAuth; defaults to current page when sign-in starts. */
  nextPath?: string;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LandingLoginDialog({
  open,
  onClose,
  locale,
  nextPath: nextPathProp,
}: LandingLoginDialogProps) {
  const t = landingCopy[locale];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    const returnPath = nextPathProp ?? getCurrentPathForAuthReturn();
    try {
      await signInWithGoogle(returnPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onBackdropPointerDown={onClose}
      ariaLabel={t.loginModalTitle}
      labelledBy="landing-login-modal-title"
    >
      <div className="text-start">
        <h2
          id="landing-login-modal-title"
          className="text-xl font-bold tracking-tight text-espresso"
        >
          {t.loginModalTitle}
        </h2>
        <p className="mt-2 text-sm leading-snug text-warm-brown">{t.loginModalSub}</p>
      </div>

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={isLoading}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-3 rounded-sm border border-espresso/20 bg-transparent px-4 py-3 text-sm font-bold tracking-tight text-espresso transition hover:bg-espresso/5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
      >
        <GoogleIcon />
        {isLoading ? t.loginModalRedirecting : t.loginModalGoogle}
      </button>

      {error ? (
        <p className="mt-3 text-center text-sm leading-snug text-terracotta" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="mt-4 w-full cursor-pointer rounded-sm border border-ticket-rule py-2 text-sm text-warm-brown transition hover:bg-kraft disabled:opacity-70"
      >
        {t.leadClose}
      </button>
    </Modal>
  );
}
