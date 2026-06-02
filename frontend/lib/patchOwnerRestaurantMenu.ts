import type { TranslationsMap } from "../types/menu";
import type { OwnerRestaurant } from "../types/owner";

export type OwnerMenuNamePatch = {
  name: string;
  translations?: TranslationsMap;
};

/** Update one menu entry in the owner restaurant list (optimistic UI). */
export function patchOwnerRestaurantMenu(
  restaurants: OwnerRestaurant[],
  menuId: string,
  patch: OwnerMenuNamePatch,
): OwnerRestaurant[] {
  return restaurants.map((restaurant) => ({
    ...restaurant,
    menus: restaurant.menus.map((menu) =>
      menu.id === menuId ? { ...menu, ...patch } : menu,
    ),
  }));
}
