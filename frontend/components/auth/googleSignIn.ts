import { createClient } from "../../utils/supabase/client";

export function normalizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }
  return nextPath;
}

export function getCurrentPathForAuthReturn(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}`;
}

export function getAuthCallbackUrl(nextPath: string, origin?: string): string {
  const baseOrigin =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const url = new URL("/auth/callback", baseOrigin);
  url.searchParams.set("next", normalizeNextPath(nextPath));
  return url.toString();
}

export async function signInWithGoogle(nextPath?: string): Promise<void> {
  const supabase = createClient();
  const returnPath = nextPath ?? getCurrentPathForAuthReturn();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthCallbackUrl(returnPath),
    },
  });
  if (error) {
    throw error;
  }
}
