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

// ---------------------------------------------------------------------------
// Restaurant management types
// ---------------------------------------------------------------------------

export type RestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  plan_tier: string;
  member_count: number;
  menu_count: number;
  active_menu_count: number;
};

export type RestaurantDetail = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  theme_color: string;
  currency: string;
  default_locale: string | null;
  translations: Record<string, Record<string, string>> | null;
  banner_image_url: string | null;
  social_links: Record<string, string> | null;
};

export type RestaurantMember = {
  user_id: string;
  role: string;
  email: string | null;
};

export type RestaurantSubscription = {
  plan_tier: string;
  status: string;
};

export type RestaurantMenu = {
  id: string;
  name: string;
  is_active: boolean;
  item_count: number;
};

export type RestaurantDetailResponse = {
  restaurant: RestaurantDetail;
  members: RestaurantMember[];
  subscription: RestaurantSubscription;
  menus: RestaurantMenu[];
};

// ---------------------------------------------------------------------------
// Restaurant management API helpers
// ---------------------------------------------------------------------------

export async function fetchRestaurants(params: {
  search?: string;
  is_active?: boolean;
  offset?: number;
  limit?: number;
}): Promise<{ restaurants: RestaurantListItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  const query = qs.toString();
  const response = await superadminFetch(
    `/api/superadmin/restaurants${query ? `?${query}` : ""}`,
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { restaurants: RestaurantListItem[]; total: number };
}

export async function fetchRestaurantDetail(
  slug: string,
): Promise<RestaurantDetailResponse> {
  const response = await superadminFetch(`/api/superadmin/restaurants/${slug}`);
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as RestaurantDetailResponse;
}

export async function patchRestaurant(
  slug: string,
  fields: {
    name?: string;
    slug?: string;
    is_active?: boolean;
    theme_color?: string;
    currency?: string;
    default_locale?: string;
  },
): Promise<{ success: boolean; slug: string }> {
  const response = await superadminFetch(`/api/superadmin/restaurants/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { success: boolean; slug: string };
}

export async function addRestaurantMember(
  slug: string,
  email: string,
  role: string,
): Promise<{ success: boolean; member: RestaurantMember }> {
  const response = await superadminFetch(
    `/api/superadmin/restaurants/${slug}/members`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { success: boolean; member: RestaurantMember };
}

export async function updateMemberRole(
  slug: string,
  userId: string,
  role: string,
): Promise<{ success: boolean; role: string }> {
  const response = await superadminFetch(
    `/api/superadmin/restaurants/${slug}/members/${userId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { success: boolean; role: string };
}

export async function removeMember(
  slug: string,
  userId: string,
): Promise<{ success: boolean }> {
  const response = await superadminFetch(
    `/api/superadmin/restaurants/${slug}/members/${userId}`,
    { method: "DELETE" },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { success: boolean };
}

export async function updateSubscription(
  slug: string,
  planTier: string,
  subscriptionStatus: string = "active",
): Promise<{ success: boolean; subscription: RestaurantSubscription }> {
  const response = await superadminFetch(
    `/api/superadmin/restaurants/${slug}/subscription`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_tier: planTier,
        subscription_status: subscriptionStatus,
      }),
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as {
    success: boolean;
    subscription: RestaurantSubscription;
  };
}
