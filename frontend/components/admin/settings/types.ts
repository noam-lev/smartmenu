import type { LucideIcon } from "lucide-react";
import type { Locale, MenuPayload } from "../../../types/menu";
import type { UiMessageKey } from "../../../utils/i18n";

/** Extend this union when adding new owner settings sections. */
export type AdminSettingsSectionId = "social-links";

export type AdminSettingsNavItem = {
  id: AdminSettingsSectionId;
  labelKey: UiMessageKey;
  icon: LucideIcon;
};

export type AdminSettingsSectionProps = {
  locale: Locale;
  onClose: () => void;
};

export type AdminSettingsSectionContext = {
  restaurantSlug: string;
  menuPayload: MenuPayload;
  onSettingsSaved: (settings: Record<string, unknown>) => void;
};
