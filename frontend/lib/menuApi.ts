import type { MenuItem, MenuPayload } from "../types/menu";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchMenuBySlug(slug: string): Promise<MenuPayload> {
  const response = await fetch(`${API_BASE_URL}/api/diner/menus/${slug}`);

  if (!response.ok) {
    throw new Error(`Failed to load menu (${response.status})`);
  }

  return response.json() as Promise<MenuPayload>;
}

export async function updateItemAvailability(
  itemId: string,
  isAvailable: boolean,
): Promise<void> {
  await updateMenuItem(itemId, { is_available: isAvailable });
}

export async function updateMenuItem(
  itemId: string,
  data: Partial<
    Pick<MenuItem, "name" | "description" | "base_price" | "translations" | "is_available">
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

  const response = await fetch(`${API_BASE_URL}/api/owner/items/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to update item (${response.status})`);
  }
}
