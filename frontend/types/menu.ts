export type OfferItemSnapshot = {
  id: string;
  name: string;
  image_url: string;
  price: number;
};

export type UpsellRule = {
  offer_item_snapshot: OfferItemSnapshot;
  custom_message: string;
  discount_price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  base_price: number;
  is_available: boolean;
  image_url: string;
  tags?: string[];
  variants: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  upsell_rules: UpsellRule[];
};

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
  items: MenuItem[];
};

export type MenuPayload = {
  restaurant: {
    name: string;
    slug: string;
    theme_color: string;
    currency: string;
    banner_image_url?: string;
  };
  menu: {
    id: string;
    name: string;
    last_updated: string;
    categories: MenuCategory[];
  };
};
