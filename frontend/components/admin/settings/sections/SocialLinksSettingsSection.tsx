"use client";

import { useMemo } from "react";
import SocialLinksEditor from "../../../SocialLinksEditor";
import { socialLinksFromSettings } from "../../../../lib/socialLinks";
import { updateRestaurantSocialLinks } from "../../../../lib/menuApi";
import type { AdminSettingsSectionContext, AdminSettingsSectionProps } from "../types";

type SocialLinksSettingsSectionProps = AdminSettingsSectionProps & AdminSettingsSectionContext;

export default function SocialLinksSettingsSection({
  locale,
  restaurantSlug,
  menuPayload,
  onSettingsSaved,
}: SocialLinksSettingsSectionProps) {
  const initialLinks = useMemo(
    () => socialLinksFromSettings(menuPayload.restaurant.settings),
    [menuPayload.restaurant.settings],
  );

  const handleSave = async (payload: Record<string, string | null>) => {
    const settings = await updateRestaurantSocialLinks(restaurantSlug, payload);
    onSettingsSaved(settings);
  };

  return (
    <SocialLinksEditor
      key={JSON.stringify(initialLinks)}
      locale={locale}
      initialLinks={initialLinks}
      onSave={handleSave}
    />
  );
}
