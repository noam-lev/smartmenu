"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";

type AuthUserState = {
  userId: string | null;
  isLoading: boolean;
};

/**
 * Tracks Supabase auth state.
 *
 * Accepts an optional `initialUserId` from SSR to avoid an auth flash
 * on first render. Client-side `onAuthStateChange` keeps it reactive
 * for login/logout after hydration.
 */
export function useAuthUser(initialUserId: string | null = null): AuthUserState {
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [isLoading, setIsLoading] = useState(initialUserId === null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { userId, isLoading };
}
