import type { ComponentType } from "react";
import type {
  AdminSettingsSectionContext,
  AdminSettingsSectionId,
  AdminSettingsSectionProps,
} from "./types";
import SocialLinksSettingsSection from "./sections/SocialLinksSettingsSection";

type RegisteredSectionProps = AdminSettingsSectionProps & AdminSettingsSectionContext;

const SECTION_REGISTRY: Record<
  AdminSettingsSectionId,
  ComponentType<RegisteredSectionProps>
> = {
  "social-links": SocialLinksSettingsSection,
};

export function renderAdminSettingsSection(
  sectionId: AdminSettingsSectionId,
  props: RegisteredSectionProps,
) {
  const Section = SECTION_REGISTRY[sectionId];
  return <Section {...props} />;
}
