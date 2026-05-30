"""Tests for slim menu payload localization."""

from core.menu_localize import resolve_effective_locale, slim_menu_payload
from models.schemas import (
    CategoryResponse,
    MenuItemResponse,
    MenuPayload,
    MenuResponse,
    RestaurantResponse,
)


def test_resolve_effective_locale_prefers_query() -> None:
    assert resolve_effective_locale("en", "he") == "en"
    assert resolve_effective_locale(None, "he") == "he"
    assert resolve_effective_locale("xx", "en") == "en"


def test_slim_menu_payload_strips_translations() -> None:
    fat = MenuPayload(
        restaurant=RestaurantResponse(
            name="Base Name",
            slug="cafe",
            theme_color="#000",
            currency="ILS",
            default_locale="he",
            translations={"en": {"name": "English Name"}},
        ),
        menu=MenuResponse(
            id="m1",
            name="Menu HE",
            last_updated="2024-01-01T00:00:00Z",
            translations={"en": {"name": "Menu EN"}},
            categories=[
                CategoryResponse(
                    id="c1",
                    name="Cat HE",
                    sort_order=0,
                    translations={"en": {"name": "Cat EN"}},
                    items=[
                        MenuItemResponse(
                            id="i1",
                            name="Item HE",
                            description="Desc HE",
                            base_price=10.0,
                            is_available=True,
                            translations={
                                "en": {
                                    "name": "Item EN",
                                    "description": "Desc EN",
                                }
                            },
                        ),
                    ],
                ),
            ],
        ),
    )

    slim = slim_menu_payload(fat, "en")

    assert slim.restaurant.translations is None
    assert slim.restaurant.name == "English Name"
    assert slim.menu.translations is None
    assert slim.menu.name == "Menu EN"
    assert slim.menu.categories[0].translations is None
    assert slim.menu.categories[0].name == "Cat EN"
    assert slim.menu.categories[0].items[0].translations is None
    assert slim.menu.categories[0].items[0].name == "Item EN"
    assert slim.menu.categories[0].items[0].description == "Desc EN"
