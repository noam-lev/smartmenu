export type OwnerMenu = {
  id: string;
  name: string;
  is_active: boolean;
};

export type OwnerRestaurant = {
  id: string;
  name: string;
  slug: string;
  role: string;
  menus: OwnerMenu[];
};
