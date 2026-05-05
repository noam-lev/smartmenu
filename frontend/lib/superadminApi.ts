const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** localStorage key for Secure MVP superadmin session token */
export const SUPERADMIN_TOKEN_STORAGE_KEY = "superadmin_token";

function readDetailFromBody(text: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (parsed.detail !== undefined) {
      return JSON.stringify(parsed.detail);
    }
  } catch {
    /* ignore */
  }
  return text || "Request failed";
}

/** Clears token and reloads so the app returns to the lock screen (401 / 429 on authed calls). */
export function handleSuperadminAuthFailure(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SUPERADMIN_TOKEN_STORAGE_KEY);
  window.location.reload();
}

export function getStoredSuperadminToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(SUPERADMIN_TOKEN_STORAGE_KEY);
}

export function setStoredSuperadminToken(token: string): void {
  localStorage.setItem(SUPERADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearStoredSuperadminToken(): void {
  localStorage.removeItem(SUPERADMIN_TOKEN_STORAGE_KEY);
}

/** Login (no session header). Does not reload on 401/429 — caller shows errors. */
export async function superadminLogin(password: string): Promise<{ token: string }> {
  const response = await fetch(`${API_BASE_URL}/api/superadmin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(readDetailFromBody(raw));
  }

  return JSON.parse(raw) as { token: string };
}

/** Server-side logout + clear local token (no full-page reload). */
export async function superadminLogout(): Promise<void> {
  const token = getStoredSuperadminToken();
  if (!token) {
    clearStoredSuperadminToken();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/superadmin/logout`, {
      method: "POST",
      headers: { "X-Superadmin-Token": token },
    });

    clearStoredSuperadminToken();

    if (response.status === 401 || response.status === 429) {
      handleSuperadminAuthFailure();
    }
  } catch {
    clearStoredSuperadminToken();
  }
}

/**
 * Authenticated superadmin request. Injects `X-Superadmin-Token`.
 * On 401 or 429, clears storage and reloads (global session end).
 */
export async function superadminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getStoredSuperadminToken();
  if (!token) {
    handleSuperadminAuthFailure();
    throw new Error("No superadmin session");
  }

  const headers = new Headers(init.headers);
  headers.set("X-Superadmin-Token", token);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 || response.status === 429) {
    handleSuperadminAuthFailure();
  }

  return response;
}

export type ParsedItem = {
  name_he: string;
  name_en: string;
  description_he: string | null;
  description_en: string | null;
  base_price: number;
};

export type ParsedCategory = {
  name_he: string;
  name_en: string;
  items: ParsedItem[];
};

export type ParsedMenu = {
  categories: ParsedCategory[];
};

export type RestaurantImportPayload = {
  restaurant_name: string;
  restaurant_slug: string;
  categories: ParsedCategory[];
};

export async function parseMenuImage(file: File): Promise<ParsedMenu> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await superadminFetch("/api/superadmin/magic-parse", {
    method: "POST",
    body: formData,
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(readDetailFromBody(raw));
  }

  return JSON.parse(raw) as ParsedMenu;
}

export async function importRestaurant(
  data: RestaurantImportPayload,
): Promise<{ success: boolean; message: string; restaurant_slug: string }> {
  const response = await superadminFetch("/api/superadmin/restaurants/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(readDetailFromBody(raw));
  }

  return JSON.parse(raw) as {
    success: boolean;
    message: string;
    restaurant_slug: string;
  };
}
