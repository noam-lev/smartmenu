import type { MenuPayload } from "../types/menu";

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
  const response = await fetch(`${API_BASE_URL}/api/owner/items/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_available: isAvailable }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update availability (${response.status})`);
  }
}
