"use client";

import type { Locale } from "../types/menu";
import type { SocialLinkEntry } from "../lib/socialLinks";
import { SOCIAL_PLATFORM_META } from "../lib/socialLinks";
import SocialPlatformIcon from "./SocialPlatformIcon";
import { getUiMessage } from "../utils/i18n";

type SocialLinksFooterProps = {
  locale: Locale;
  links: SocialLinkEntry[];
};

export default function SocialLinksFooter({ locale, links }: SocialLinksFooterProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-md flex-col items-center justify-center gap-1 px-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {getUiMessage("socialFollowUs", locale)}
        </p>
        <nav
          className="flex items-center justify-center gap-4"
          aria-label={getUiMessage("socialLinksNavAria", locale)}
        >
          {links.map(({ platform, url }) => {
            const label = getUiMessage(SOCIAL_PLATFORM_META[platform].labelKey, locale);
            return (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full p-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label={label}
              >
                <SocialPlatformIcon platform={platform} />
              </a>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
