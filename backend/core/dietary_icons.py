"""Dietary / spicy labels stored in menu_items.metadata.dietary_icons."""

from __future__ import annotations

from typing import Any

ALLOWED_DIETARY_ICONS = frozenset({"gluten_free", "vegetarian", "vegan", "spicy"})
DIETARY_ICON_ORDER = ("gluten_free", "vegetarian", "vegan", "spicy")


def normalize_dietary_icons(value: Any) -> list[str]:
    """Validate and dedupe dietary icon ids; preserve canonical order."""
    if value is None:
        return []
    if not isinstance(value, list):
        return []

    seen: set[str] = set()
    ordered: list[str] = []
    for entry in value:
        code = str(entry or "").strip().lower()
        if code not in ALLOWED_DIETARY_ICONS or code in seen:
            continue
        seen.add(code)
        ordered.append(code)

    return [code for code in DIETARY_ICON_ORDER if code in seen]


def merge_dietary_icons_into_metadata(
    existing: dict[str, Any] | None,
    dietary_icons: Any,
) -> dict[str, Any]:
    """Merge dietary_icons into metadata, preserving tags and other keys."""
    base = dict(existing) if isinstance(existing, dict) else {}
    icons = normalize_dietary_icons(dietary_icons)
    if icons:
        base["dietary_icons"] = icons
    else:
        base.pop("dietary_icons", None)
    return base
