import type { UiMessageKey } from "../utils/i18n";

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "website",
  "waze",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialLinkEntry = {
  platform: SocialPlatform;
  url: string;
};

export type SocialLinksMap = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_PLATFORM_META: Record<SocialPlatform, { labelKey: UiMessageKey }> = {
  instagram: { labelKey: "socialPlatformInstagram" },
  facebook: { labelKey: "socialPlatformFacebook" },
  tiktok: { labelKey: "socialPlatformTiktok" },
  whatsapp: { labelKey: "socialPlatformWhatsapp" },
  website: { labelKey: "socialPlatformWebsite" },
  waze: { labelKey: "socialPlatformWaze" },
};

const PLATFORM_PLACEHOLDERS: Record<SocialPlatform, string> = {
  instagram: "https://instagram.com/your-page",
  facebook: "https://facebook.com/your-page",
  tiktok: "https://tiktok.com/@your-page",
  whatsapp: "https://wa.me/972501234567",
  website: "https://your-restaurant.com",
  waze: "https://waze.com/ul/...",
};

export function emptySocialLinksMap(): SocialLinksMap {
  return {
    instagram: "",
    facebook: "",
    tiktok: "",
    whatsapp: "",
    website: "",
    waze: "",
  };
}

export function socialLinksFromSettings(
  settings: Record<string, unknown> | null | undefined,
): SocialLinksMap {
  const base = emptySocialLinksMap();
  const raw = settings?.social_links;
  if (!raw || typeof raw !== "object") {
    return base;
  }
  for (const platform of SOCIAL_PLATFORMS) {
    const value = (raw as Record<string, unknown>)[platform];
    if (typeof value === "string" && value.trim()) {
      base[platform] = value.trim();
    }
  }
  return base;
}

export function parseSocialLinksForDisplay(
  settings: Record<string, unknown> | null | undefined,
): SocialLinkEntry[] {
  const map = socialLinksFromSettings(settings);
  return SOCIAL_PLATFORMS.filter((platform) => Boolean(map[platform]?.trim())).map(
    (platform) => ({
      platform,
      url: map[platform]!.trim(),
    }),
  );
}

export function socialLinksMapToPayload(map: SocialLinksMap): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const trimmed = (map[platform] ?? "").trim();
    payload[platform] = trimmed || null;
  }
  return payload;
}

export function getSocialPlatformPlaceholder(platform: SocialPlatform): string {
  return PLATFORM_PLACEHOLDERS[platform];
}

export function validateSocialUrlClient(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return "invalidHttps";
    }
    return null;
  } catch {
    return "invalidUrl";
  }
}
