"""Unit tests for localized name merge logic (mirrors DAL _patch_localized_name_sync)."""

from __future__ import annotations

from typing import Any


def _merge_localized_name(
    row: dict[str, Any],
    *,
    restaurant_id: str,
    locale: str,
    name: str,
    default_locale: str,
) -> dict[str, Any]:
    translations = dict(row.get("translations") or {})
    bucket = dict(translations.get(locale) or {})
    bucket["name"] = name
    translations[locale] = bucket

    patch: dict[str, Any] = {"translations": translations}
    if locale == default_locale:
        patch["name"] = name
    return patch


def test_merge_default_locale_updates_base_name() -> None:
    row = {"name": "Old", "translations": {"he": {"name": "ישן"}}}
    patch = _merge_localized_name(
        row,
        restaurant_id="r1",
        locale="he",
        name="חדש",
        default_locale="he",
    )
    assert patch["name"] == "חדש"
    assert patch["translations"]["he"]["name"] == "חדש"


def test_merge_non_default_locale_keeps_base_name() -> None:
    row = {"name": "Base EN", "translations": {}}
    patch = _merge_localized_name(
        row,
        restaurant_id="r1",
        locale="he",
        name="עברית",
        default_locale="en",
    )
    assert "name" not in patch or patch.get("name") != "עברית"
    assert patch["translations"]["he"]["name"] == "עברית"


def test_merge_preserves_other_locale_buckets() -> None:
    row = {
        "name": "Menu EN",
        "translations": {"en": {"name": "Menu EN"}, "he": {"name": "ישן"}},
    }
    patch = _merge_localized_name(
        row,
        restaurant_id="r1",
        locale="he",
        name="חדש",
        default_locale="en",
    )
    assert patch["translations"]["en"]["name"] == "Menu EN"
    assert patch["translations"]["he"]["name"] == "חדש"
