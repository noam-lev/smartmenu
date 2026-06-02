"""Tests for hex color normalization."""

from core.colors import normalize_hex_color


def test_normalize_hex_color_six_digit() -> None:
    assert normalize_hex_color("#FF5733") == "#ff5733"
    assert normalize_hex_color("  #AABBCC  ") == "#aabbcc"


def test_normalize_hex_color_three_digit() -> None:
    assert normalize_hex_color("#F0A") == "#ff00aa"


def test_normalize_hex_color_empty_or_invalid() -> None:
    assert normalize_hex_color(None) is None
    assert normalize_hex_color("") is None
    assert normalize_hex_color("red") is None
    assert normalize_hex_color("#GGGGGG") is None
