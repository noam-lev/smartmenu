import type { TranslationsMap } from "./menu";

export type OwnerMenu = {
  id: string;
  name: string;
  is_active: boolean;
  translations?: TranslationsMap;
};

export type OwnerRestaurant = {
  id: string;
  name: string;
  slug: string;
  role: string;
  menus: OwnerMenu[];
};
