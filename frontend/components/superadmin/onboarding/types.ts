import type { ParsedMenu } from "../../../lib/superadminApi";

export const STEPS = [
  { label: "Restaurant Info" },
  { label: "Menu" },
  { label: "Images" },
  { label: "Settings" },
  { label: "Owner + Plan" },
  { label: "Review" },
] as const;

export type WizardState = {
  name: string;
  slug: string;
  isSlugManual: boolean;
  parsedMenu: ParsedMenu | null;
  bannerUrl: string | null;
  qrLogoUrl: string | null;
  itemImages: Record<string, string>;
  currency: string;
  defaultLocale: string;
  ownerEmail: string;
  planTier: string;
};

export const INITIAL_STATE: WizardState = {
  name: "",
  slug: "",
  isSlugManual: false,
  parsedMenu: null,
  bannerUrl: null,
  qrLogoUrl: null,
  itemImages: {},
  currency: "ILS",
  defaultLocale: "he",
  ownerEmail: "",
  planTier: "free",
};

export type StepProps = {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
};
