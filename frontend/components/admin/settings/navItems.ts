import { Share2 } from "lucide-react";
import type { AdminSettingsNavItem } from "./types";

/** Sidebar navigation entries — add new items here when introducing sections. */
export const ADMIN_SETTINGS_NAV_ITEMS: AdminSettingsNavItem[] = [
  {
    id: "social-links",
    labelKey: "socialLinksTitle",
    icon: Share2,
  },
];
