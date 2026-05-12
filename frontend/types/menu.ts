export type Locale = "en" | "he";

export type LocalizedFields = Partial<Record<string, string>>;

export type TranslationsMap = Partial<Record<Locale, LocalizedFields>>;

export type OfferItemSnapshot = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  translations?: TranslationsMap;
};

export type UpsellRule = {
  /** Present when loaded from API; required for edit/delete upsell admin actions. */
  id?: string;
  offer_item_snapshot: OfferItemSnapshot;
  custom_message: string;
  discount_price: number | null;
  translations?: TranslationsMap;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  base_price: number;
  is_available: boolean;
  /** Server ordering within category; used for admin drag-and-drop. */
  sort_order?: number;
  image_url: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  translations?: TranslationsMap;
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
  translations?: TranslationsMap;
  items: MenuItem[];
};

export type MenuPayload = {
  restaurant: {
    name: string;
    slug: string;
    theme_color: string;
    currency: string;
    banner_url?: string | null;
    banner_image_url?: string | null;
    default_locale?: Locale;
    translations?: TranslationsMap;
    settings?: Record<string, unknown> | null;
  };
  menu: {
    id: string;
    name: string;
    last_updated: string;
    translations?: TranslationsMap;
    categories: MenuCategory[];
  };
};
