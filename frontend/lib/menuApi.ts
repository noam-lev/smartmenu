import type { Locale, MenuCategory, MenuItem, MenuPayload } from "../types/menu";
import {
  logMenuFetchFailure,
  MenuFetchError,
  parseApiErrorBody,
} from "./menuFetchError";
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

async function getOwnerAuthHeaders(includeJsonContentType = true): Promise<HeadersInit> {
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

export async function fetchMenuBySlug(slug: string): Promise<MenuPayload> {
  const url = `${API_BASE_URL}/api/diner/menus/${encodeURIComponent(slug)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    const error = new MenuFetchError({
      kind: "network",
      slug,
      url,
      message: cause instanceof Error ? cause.message : "Network request failed",
      cause,
    });
    logMenuFetchFailure(error);
    throw error;
  }

  if (!response.ok) {
    const body = await parseApiErrorBody(response);

    if (response.status === 404) {
      const error = new MenuFetchError({
        kind: "not_found",
        slug,
        url,
        status: response.status,
        code: body.code,
        detail: body.detail,
        message: body.detail ?? "Menu not found",
      });
      logMenuFetchFailure(error);
      throw error;
    }

    const error = new MenuFetchError({
      kind: "server",
      slug,
      url,
      status: response.status,
      code: body.code,
      detail: body.detail,
      message: body.detail ?? `Failed to load menu (${response.status})`,
    });
    logMenuFetchFailure(error);
    throw error;
  }

  return response.json() as Promise<MenuPayload>;
}

export async function updateItemAvailability(
  restaurantSlug: string,
  itemId: string,
  isAvailable: boolean,
): Promise<void> {
  await updateMenuItem(restaurantSlug, itemId, { is_available: isAvailable });
}

export async function updateMenuItem(
  restaurantSlug: string,
  itemId: string,
  data: Partial<
    Pick<
      MenuItem,
      "name" | "description" | "base_price" | "translations" | "is_available" | "image_url"
    >
  >,
): Promise<void> {
  const body: Record<string, unknown> = {};

  if (data.name !== undefined) {
    body.name = data.name;
  }
  if (data.description !== undefined) {
    body.description = data.description;
  }
  if (data.base_price !== undefined) {
    body.base_price = data.base_price;
  }
  if (data.translations !== undefined) {
    body.translations = data.translations;
  }
  if (data.is_available !== undefined) {
    body.is_available = data.is_available;
  }
  if (data.image_url !== undefined) {
    body.image_url = data.image_url;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/items/${encodeURIComponent(itemId)}`,
    {
    method: "PATCH",
    headers: await getOwnerAuthHeaders(true),
    body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update item (${response.status})`);
  }
}

export async function uploadOwnerImage(
  restaurantSlug: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/upload-image`,
    {
      method: "POST",
      headers: await getOwnerAuthHeaders(false),
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to upload image (${response.status})`);
  }

  const payload = (await response.json()) as { public_url?: string };
  if (!payload.public_url) {
    throw new Error("Upload succeeded but no public URL was returned.");
  }

  return payload.public_url;
}

export async function deleteOwnerImage(
  restaurantSlug: string,
  fileUrl: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/delete-image`,
    {
      method: "POST",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify({ file_url: fileUrl }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete image (${response.status})`);
  }
}

export async function updateRestaurantBannerUrl(
  restaurantSlug: string,
  bannerUrl: string | null,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/restaurant`,
    {
      method: "PATCH",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify({ banner_url: bannerUrl }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update restaurant banner (${response.status})`);
  }
}

export async function createMenuItem(
  restaurantSlug: string,
  categoryId: string,
  data: Partial<MenuItem>,
): Promise<MenuItem> {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    throw new Error("Name is required.");
  }

  const rawPrice = data.base_price;
  const base_price =
    typeof rawPrice === "number" ? rawPrice : Number(rawPrice ?? NaN);
  if (!Number.isFinite(base_price) || base_price < 0) {
    throw new Error("Price must be a number greater than or equal to 0.");
  }

  const body: Record<string, unknown> = {
    name,
    base_price,
  };

  if (typeof data.description === "string" && data.description.trim().length > 0) {
    body.description = data.description.trim();
  }
  if (typeof data.image_url === "string") {
    body.image_url = data.image_url.trim();
  } else if (data.image_url === null) {
    body.image_url = null;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/categories/${encodeURIComponent(categoryId)}/items`,
    {
      method: "POST",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create item (${response.status})`);
  }

  const payload = (await response.json()) as { item?: MenuItem };
  if (!payload.item) {
    throw new Error("Invalid response from server.");
  }

  return payload.item;
}

export async function deleteMenuItem(
  restaurantSlug: string,
  itemId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/items/${encodeURIComponent(itemId)}`,
    {
    method: "DELETE",
    headers: await getOwnerAuthHeaders(false),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete item (${response.status})`);
  }
}

/** Updates `translations[locale].custom_message` (and base `custom_message` when locale is the restaurant default). */
export async function updateUpsellRule(
  restaurantSlug: string,
  ruleId: string,
  locale: Locale,
  data: { message: string },
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/upsells/${encodeURIComponent(ruleId)}`,
    {
      method: "PATCH",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify({
        message: data.message,
        locale,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update upsell (${response.status})`);
  }
}

export async function createUpsellRule(
  restaurantSlug: string,
  triggerItemId: string,
  data: { offer_item_id: string; discount_price: number; custom_message?: string },
): Promise<void> {
  const body: Record<string, unknown> = {
    offer_item_id: data.offer_item_id,
    discount_price: data.discount_price,
  };
  if (data.custom_message !== undefined && data.custom_message.trim().length > 0) {
    body.custom_message = data.custom_message.trim();
  }

  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/items/${encodeURIComponent(triggerItemId)}/upsells`,
    {
      method: "POST",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create upsell (${response.status})`);
  }
}

export async function deleteUpsellRule(
  restaurantSlug: string,
  ruleId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/upsells/${encodeURIComponent(ruleId)}`,
    {
      method: "DELETE",
      headers: await getOwnerAuthHeaders(false),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete upsell (${response.status})`);
  }
}

export async function createCategory(data: {
  restaurantSlug: string;
  name: string;
  locale: Locale;
}): Promise<MenuCategory> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(data.restaurantSlug)}/categories`,
    {
    method: "POST",
    headers: await getOwnerAuthHeaders(true),
    body: JSON.stringify({
      name: data.name.trim(),
      locale: data.locale,
    }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create category (${response.status})`);
  }

  const payload = (await response.json()) as {
    category?: { id: string; name: string; sort_order: number; translations?: MenuCategory["translations"] };
  };
  if (!payload.category?.id) {
    throw new Error("Invalid response from server.");
  }

  return {
    id: payload.category.id,
    name: payload.category.name,
    sort_order: payload.category.sort_order,
    translations: payload.category.translations,
    items: [],
  };
}

export async function updateCategory(
  restaurantSlug: string,
  categoryId: string,
  locale: Locale,
  data: { name: string },
): Promise<Pick<MenuCategory, "id" | "name" | "sort_order" | "translations">> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify({
        name: data.name.trim(),
        locale,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update category (${response.status})`);
  }

  const payload = (await response.json()) as {
    category?: { id: string; name: string; sort_order: number; translations?: MenuCategory["translations"] };
  };
  if (!payload.category?.id) {
    throw new Error("Invalid response from server.");
  }

  return payload.category;
}

export async function deleteCategory(
  restaurantSlug: string,
  categoryId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "DELETE",
      headers: await getOwnerAuthHeaders(false),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete category (${response.status})`);
  }
}

export async function reorderCategoryItems(
  restaurantSlug: string,
  categoryId: string,
  items: { id: string; sort_order: number }[],
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/categories/${encodeURIComponent(categoryId)}/items/reorder`,
    {
      method: "PATCH",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify({
        items: items.map((row) => ({
          item_id: row.id,
          sort_order: row.sort_order,
        })),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to reorder items (${response.status})`);
  }
}

export async function reorderCategories(
  restaurantSlug: string,
  categoryIds: string[],
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/categories/reorder`,
    {
      method: "PUT",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify({ category_ids: categoryIds }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to reorder categories (${response.status})`);
  }
}
