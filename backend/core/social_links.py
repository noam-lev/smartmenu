"""Restaurant social link settings stored in restaurants.settings.social_links."""

from __future__ import annotations

from typing import Final
from urllib.parse import urlparse

SOCIAL_PLATFORMS: Final[tuple[str, ...]] = (
    "instagram",
    "facebook",
    "tiktok",
    "whatsapp",
    "website",
    "waze",
)

# Empty tuple = any https host allowed (website).
_PLATFORM_HOST_HINTS: Final[dict[str, tuple[str, ...]]] = {
    "instagram": ("instagram.com",),
    "facebook": ("facebook.com", "fb.com", "fb.me",),
    "tiktok": ("tiktok.com",),
    "whatsapp": ("wa.me", "api.whatsapp.com", "chat.whatsapp.com",),
    "website": (),
    "waze": ("waze.com",),
}


class SocialLinksValidationError(ValueError):
  pass


def _normalize_url(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return ""
    parsed = urlparse(trimmed)
    if parsed.scheme.lower() != "https":
        raise SocialLinksValidationError("Links must use https://")
    if not parsed.netloc:
        raise SocialLinksValidationError("Invalid URL.")
    return trimmed


def _host_matches(platform: str, host: str) -> bool:
    hints = _PLATFORM_HOST_HINTS.get(platform, ())
    if not hints:
        return True
    host_lower = host.lower().removeprefix("www.")
    return any(host_lower == hint or host_lower.endswith(f".{hint}") for hint in hints)


def apply_social_links_patch(
    current: dict[str, str],
    patch: dict[str, object],
) -> dict[str, str]:
    """Merge a partial social_links patch (null clears a platform)."""
    result = dict(current)
    for key, value in patch.items():
        platform = str(key or "").strip().lower()
        if platform not in _PLATFORM_HOST_HINTS:
            raise SocialLinksValidationError(f"Unknown platform: {platform}")

        if value is None:
            result.pop(platform, None)
            continue
        if not isinstance(value, str):
            raise SocialLinksValidationError(f"Invalid URL for {platform}.")

        trimmed = value.strip()
        if not trimmed:
            result.pop(platform, None)
            continue

        url = _normalize_url(trimmed)
        host = urlparse(url).netloc
        if not _host_matches(platform, host):
            raise SocialLinksValidationError(
                f"URL does not match platform {platform}.",
            )
        result[platform] = url

    return result


def validate_social_links(raw: dict[str, object] | None) -> dict[str, str]:
    """Return normalized social_links dict (only non-empty URLs)."""
    if raw is None:
        return {}

    if not isinstance(raw, dict):
        raise SocialLinksValidationError("social_links must be an object.")

    normalized: dict[str, str] = {}
    for key, value in raw.items():
        platform = str(key or "").strip().lower()
        if platform not in _PLATFORM_HOST_HINTS:
            raise SocialLinksValidationError(f"Unknown platform: {platform}")

        if value is None:
            continue
        if not isinstance(value, str):
            raise SocialLinksValidationError(f"Invalid URL for {platform}.")

        url = _normalize_url(value)
        if not url:
            continue

        host = urlparse(url).netloc
        if not _host_matches(platform, host):
            raise SocialLinksValidationError(
                f"URL does not match platform {platform}.",
            )
        normalized[platform] = url

    return normalized


def parse_social_links_from_settings(settings: dict[str, object] | None) -> dict[str, str]:
    if not settings:
        return {}
    raw = settings.get("social_links")
    if not isinstance(raw, dict):
        return {}
    result: dict[str, str] = {}
    for platform in SOCIAL_PLATFORMS:
        value = raw.get(platform)
        if isinstance(value, str) and value.strip():
            result[platform] = value.strip()
    return result
