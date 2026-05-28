"use client";

import { useState } from "react";
import { signInWithGoogle } from "./googleSignIn";

type LoginButtonProps = {
  nextPath?: string;
};

export default function LoginButton({ nextPath = "/" }: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-center text-sm text-zinc-600">Sign in to continue to your admin dashboard</p>
      <button
        type="button"
        onClick={() => void handleLogin()}
        disabled={isLoading}
        className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isLoading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error ? <p className="mt-3 text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
