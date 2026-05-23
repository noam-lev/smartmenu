"use client";

import { useMemo, useState } from "react";
import type { Locale } from "../types/menu";
import SocialPlatformIcon from "./SocialPlatformIcon";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_META,
  type SocialLinksMap,
  getSocialPlatformPlaceholder,
  parseSocialLinksForDisplay,
  socialLinksMapToPayload,
  validateSocialUrlClient,
} from "../lib/socialLinks";
import { getUiMessage, getUiTemplate } from "../utils/i18n";

type SocialLinksEditorProps = {
  locale: Locale;
  initialLinks: SocialLinksMap;
  onSave: (payload: Record<string, string | null>) => Promise<void>;
};

export default function SocialLinksEditor({
  locale,
  initialLinks,
  onSave,
}: SocialLinksEditorProps) {
  const [links, setLinks] = useState<SocialLinksMap>(initialLinks);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const previewLinks = useMemo(
    () =>
      parseSocialLinksForDisplay({
        social_links: Object.fromEntries(
          SOCIAL_PLATFORMS.map((platform) => [platform, links[platform] ?? ""]),
        ),
      }),
    [links],
  );

  const handleChange = (platform: (typeof SOCIAL_PLATFORMS)[number], value: string) => {
    setLinks((prev) => ({ ...prev, [platform]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    const errors: Partial<Record<string, string>> = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const code = validateSocialUrlClient(links[platform] ?? "");
      if (code) {
        errors[platform] = getUiMessage(
          code === "invalidHttps" ? "socialInvalidHttps" : "socialInvalidUrl",
          locale,
        );
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(socialLinksMapToPayload(links));
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : getUiMessage("socialSaveFailed", locale),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {getUiMessage("socialLinksTitle", locale)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{getUiMessage("socialLinksHint", locale)}</p>

      <div className="mt-3 space-y-2">
        {SOCIAL_PLATFORMS.map((platform) => {
          const { labelKey } = SOCIAL_PLATFORM_META[platform];
          const label = getUiMessage(labelKey, locale);
          return (
            <label key={platform} className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                <SocialPlatformIcon platform={platform} className="h-3.5 w-3.5" />
                {label}
              </span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                dir="ltr"
                value={links[platform] ?? ""}
                onChange={(event) => handleChange(platform, event.target.value)}
                placeholder={getSocialPlatformPlaceholder(platform)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              />
              {fieldErrors[platform] ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors[platform]}</p>
              ) : null}
            </label>
          );
        })}
      </div>

      {previewLinks.length > 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          {getUiTemplate("socialPreviewCount", locale, {
            count: String(previewLinks.length),
          })}
        </p>
      ) : null}

      {saveError ? <p className="mt-2 text-xs text-red-600">{saveError}</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {isSaving ? getUiMessage("saving", locale) : getUiMessage("socialSaveLinks", locale)}
      </button>
    </div>
  );
}
