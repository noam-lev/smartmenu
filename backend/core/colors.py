"""Hex color normalization for category headers and similar UI fields."""

from __future__ import annotations

import re

_HEX6_RE = re.compile(r"^#([0-9a-fA-F]{6})$")
_HEX3_RE = re.compile(r"^#([0-9a-fA-F]{3})$")


def normalize_hex_color(value: str | None) -> str | None:
    """Return lowercase #rrggbb or None when value is empty/invalid."""
    if value is None:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    match6 = _HEX6_RE.match(stripped)
    if match6:
        return f"#{match6.group(1).lower()}"

    match3 = _HEX3_RE.match(stripped)
    if match3:
        triple = match3.group(1).lower()
        return f"#{triple[0]}{triple[0]}{triple[1]}{triple[1]}{triple[2]}{triple[2]}"

    return None
