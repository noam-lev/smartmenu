import type { Locale, ModifierGroupLibrary, TranslationsMap } from "../types/menu";
import { API_BASE_URL } from "./apiBase";
import { createClient as createSupabaseBrowserClient } from "../utils/supabase/client";

export type ModifierOptionInput = {
  id?: string;
  name: string;
  translations?: TranslationsMap;
  price_delta: number;
  is_default?: boolean;
  is_available?: boolean;
};

export type ModifierGroupWriteInput = {
  name: string;
  translations?: TranslationsMap;
  selection_mode: "single" | "multi";
  min_select: number;
  max_select: number;
  options: ModifierOptionInput[];
};

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

export async function listModifierGroups(
  restaurantSlug: string,
): Promise<ModifierGroupLibrary[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/modifier-groups`,
    { headers: await getOwnerAuthHeaders(false) },
  );
  if (!response.ok) {
    throw new Error(`Failed to load modifier groups (${response.status})`);
  }
  const payload = (await response.json()) as { groups?: ModifierGroupLibrary[] };
  return payload.groups ?? [];
}

export async function createModifierGroup(
  restaurantSlug: string,
  data: ModifierGroupWriteInput & { attach_to_item_id: string },
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/modifier-groups`,
    {
      method: "POST",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create modifier group (${response.status})`);
  }
  const payload = (await response.json()) as { group_id?: string };
  if (!payload.group_id) {
    throw new Error("Invalid response from server.");
  }
  return payload.group_id;
}

export async function updateModifierGroup(
  restaurantSlug: string,
  groupId: string,
  data: ModifierGroupWriteInput,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/modifier-groups/${encodeURIComponent(groupId)}`,
    {
      method: "PATCH",
      headers: await getOwnerAuthHeaders(true),
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update modifier group (${response.status})`);
  }
}

export async function deleteModifierGroup(
  restaurantSlug: string,
  groupId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/modifier-groups/${encodeURIComponent(groupId)}`,
    {
      method: "DELETE",
      headers: await getOwnerAuthHeaders(false),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete modifier group (${response.status})`);
  }
}

export async function attachModifierGroup(
  restaurantSlug: string,
  itemId: string,
  groupId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/items/${encodeURIComponent(itemId)}/modifier-groups/${encodeURIComponent(groupId)}`,
    {
      method: "POST",
      headers: await getOwnerAuthHeaders(false),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to attach modifier group (${response.status})`);
  }
}

export async function detachModifierGroup(
  restaurantSlug: string,
  itemId: string,
  groupId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/owner/${encodeURIComponent(restaurantSlug)}/items/${encodeURIComponent(itemId)}/modifier-groups/${encodeURIComponent(groupId)}`,
    {
      method: "DELETE",
      headers: await getOwnerAuthHeaders(false),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to detach modifier group (${response.status})`);
  }
}

/** Build API name + translations from bilingual name fields. */
export function buildModifierNamePayload(
  nameHe: string,
  nameEn: string,
  defaultLocale: Locale,
): { name: string; translations: TranslationsMap } {
  const he = nameHe.trim();
  const en = nameEn.trim();
  const translations: TranslationsMap = {};
  if (he) {
    translations.he = { name: he };
  }
  if (en) {
    translations.en = { name: en };
  }
  const name =
    defaultLocale === "he" ? he || en : en || he;
  return { name, translations };
}

export function readModifierNameFields(
  group: { name: string; translations?: TranslationsMap },
): { nameHe: string; nameEn: string } {
  return {
    nameHe: group.translations?.he?.name?.trim() || group.name,
    nameEn: group.translations?.en?.name?.trim() || group.name,
  };
}
