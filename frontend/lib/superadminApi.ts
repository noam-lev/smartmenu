import { createClient as createSupabaseBrowserClient } from "../utils/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

let supabaseClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseBrowserClient();
  }
  return supabaseClient;
}

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

async function getAuthHeaders(
  includeJsonContentType = true,
): Promise<HeadersInit> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Authentication required. Please log in.");
  }
  return {
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${accessToken}`,
  };
}

async function superadminApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = await getAuthHeaders(false);
  const merged = new Headers(init.headers);
  for (const [k, v] of Object.entries(headers)) {
    merged.set(k, v);
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers: merged });
}

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

export async function pingSuperadmin(): Promise<boolean> {
  try {
    const response = await superadminApiFetch("/api/superadmin/ping");
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Menu parsing & import
// ---------------------------------------------------------------------------

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

  const response = await superadminApiFetch("/api/superadmin/magic-parse", {
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
  const response = await superadminApiFetch(
    "/api/superadmin/restaurants/import",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

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
  if (params.is_active !== undefined)
    qs.set("is_active", String(params.is_active));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  const query = qs.toString();
  const response = await superadminApiFetch(
    `/api/superadmin/restaurants${query ? `?${query}` : ""}`,
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as {
    restaurants: RestaurantListItem[];
    total: number;
  };
}

export async function fetchRestaurantDetail(
  slug: string,
): Promise<RestaurantDetailResponse> {
  const response = await superadminApiFetch(
    `/api/superadmin/restaurants/${slug}`,
  );
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
  const response = await superadminApiFetch(
    `/api/superadmin/restaurants/${slug}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { success: boolean; slug: string };
}

export async function addRestaurantMember(
  slug: string,
  email: string,
  role: string,
): Promise<{ success: boolean; member: RestaurantMember }> {
  const response = await superadminApiFetch(
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
  const response = await superadminApiFetch(
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
  const response = await superadminApiFetch(
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
  const response = await superadminApiFetch(
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

// ---------------------------------------------------------------------------
// Onboarding wizard helpers
// ---------------------------------------------------------------------------

export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean }> {
  const response = await superadminApiFetch(
    `/api/superadmin/restaurants/check-slug/${encodeURIComponent(slug)}`,
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { available: boolean };
}

export async function superadminUploadImage(
  file: File,
): Promise<{ public_url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await superadminApiFetch("/api/superadmin/upload-image", {
    method: "POST",
    body: formData,
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as { public_url: string };
}

export type OnboardPayload = {
  restaurant_name: string;
  restaurant_slug: string;
  categories: ParsedCategory[];
  currency: string;
  default_locale: string;
  banner_image_url: string | null;
  item_images: Record<string, string>;
  owner_email: string | null;
  plan_tier: string;
};

export type OnboardResult = {
  success: boolean;
  restaurant_slug: string;
  restaurant_name: string;
  categories_imported: number;
  items_imported: number;
  owner_linked: boolean;
};

export async function onboardRestaurant(
  data: OnboardPayload,
): Promise<OnboardResult> {
  const response = await superadminApiFetch(
    "/api/superadmin/restaurants/onboard",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(readDetailFromBody(raw));
  return JSON.parse(raw) as OnboardResult;
}
