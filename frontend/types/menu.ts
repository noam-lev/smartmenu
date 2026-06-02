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

export type ModifierOption = {
  id: string;
  name: string;
  price_delta: number;
  is_default?: boolean;
  is_available?: boolean;
  sort_order?: number;
  translations?: TranslationsMap;
};

export type ModifierGroup = {
  id: string;
  name: string;
  selection_mode: "single" | "multi" | string;
  min_select: number;
  max_select: number;
  sort_order?: number;
  options: ModifierOption[];
  translations?: TranslationsMap;
};

/** Owner library listing (includes attachment count for delete guard). */
export type ModifierGroupLibrary = ModifierGroup & {
  attached_item_count: number;
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
  modifier_groups?: ModifierGroup[];
  upsell_rules: UpsellRule[];
};

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
  header_color?: string | null;
  translations?: TranslationsMap;
  items: MenuItem[];
};

export type RestaurantInfo = {
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

export type MenuInfo = {
  id: string;
  name: string;
  last_updated: string;
  translations?: TranslationsMap;
  categories: MenuCategory[];
};

/** Owner admin API: full tree with all translation buckets. */
export type FatMenuPayload = {
  restaurant: RestaurantInfo;
  menu: MenuInfo;
};

/** Public diner API: strings resolved for one locale; no translations blobs. */
export type SlimOfferItemSnapshot = Omit<OfferItemSnapshot, "translations">;
export type SlimUpsellRule = Omit<UpsellRule, "translations" | "offer_item_snapshot"> & {
  offer_item_snapshot: SlimOfferItemSnapshot;
};
export type SlimModifierOption = Omit<ModifierOption, "translations">;
export type SlimModifierGroup = Omit<ModifierGroup, "translations" | "options"> & {
  options: SlimModifierOption[];
};

export type SlimMenuItem = Omit<
  MenuItem,
  "translations" | "upsell_rules" | "modifier_groups"
> & {
  modifier_groups?: SlimModifierGroup[];
  upsell_rules: SlimUpsellRule[];
};
export type SlimMenuCategory = Omit<MenuCategory, "translations" | "items"> & {
  items: SlimMenuItem[];
};
export type SlimRestaurantInfo = Omit<RestaurantInfo, "translations">;
export type SlimMenuInfo = Omit<MenuInfo, "translations" | "categories"> & {
  categories: SlimMenuCategory[];
};

export type SlimMenuPayload = {
  restaurant: SlimRestaurantInfo;
  menu: SlimMenuInfo;
};

/** @deprecated Use FatMenuPayload or SlimMenuPayload explicitly. */
export type MenuPayload = FatMenuPayload;
