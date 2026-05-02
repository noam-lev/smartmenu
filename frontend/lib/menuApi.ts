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

export async function createMenuItem(
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

  const response = await fetch(
    `${API_BASE_URL}/api/owner/categories/${encodeURIComponent(categoryId)}/items`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

export async function deleteMenuItem(itemId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/owner/items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete item (${response.status})`);
  }
}
