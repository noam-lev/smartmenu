import asyncio
from typing import Any

from supabase import Client

from db.repository import MenuRepository
from models.schemas import (
    CategoryResponse,
    MenuItemResponse,
    MenuPayload,
    MenuResponse,
    OfferItemSnapshotResponse,
    RestaurantResponse,
    UpsellRuleResponse,
    VariantResponse,
)


class SupabaseDAL(MenuRepository):
    def __init__(self, client: Client) -> None:
        self._client = client

    async def get_fat_menu_by_slug(self, slug: str) -> MenuPayload | None:
        response_data = await asyncio.to_thread(self._fetch_restaurant_menu, slug)
        restaurant = _first(response_data)

        if restaurant is None:
            return None

        active_menu = _first(_as_list(restaurant.get("menus")))
        if active_menu is None:
            return None

        return _build_menu_payload(restaurant=restaurant, menu=active_menu)

    def _fetch_restaurant_menu(self, slug: str) -> list[dict[str, Any]]:
        response = (
            self._client.table("restaurants")
            .select(
                """
                id,
                name,
                slug,
                settings,
                is_active,
                menus(
                    id,
                    name,
                    is_active,
                    updated_at,
                    categories(
                        id,
                        name,
                        sort_order,
                        is_visible,
                        menu_items(
                            id,
                            name,
                            description,
                            base_price,
                            is_available,
                            is_visible,
                            sort_order,
                            image_url,
                            metadata,
                            translations,
                            item_variants(
                                id,
                                name,
                                price
                            ),
                            upsell_rules!upsell_rules_trigger_item_id_fkey(
                                *,
                                offer_item:menu_items!upsell_rules_offer_item_id_fkey(*)
                            )
                        )
                    )
                )
                """
            )
            .eq("slug", slug.lower())
            .eq("is_active", True)
            .eq("menus.is_active", True)
            .eq("menus.categories.is_visible", True)
            .eq("menus.categories.menu_items.is_visible", True)
            .limit(1)
            .execute()
        )

        return response.data or []


def _build_menu_payload(
    restaurant: dict[str, Any],
    menu: dict[str, Any],
) -> MenuPayload:
    settings = _as_dict(restaurant.get("settings"))

    return MenuPayload(
        restaurant=RestaurantResponse(
            name=str(restaurant.get("name") or ""),
            slug=str(restaurant.get("slug") or ""),
            theme_color=str(settings.get("theme_color") or "#111827"),
            currency=str(settings.get("currency") or "ILS"),
            banner_image_url=settings.get("banner_image_url"),
            default_locale=settings.get("default_locale"),
            translations=_as_optional_dict(settings.get("translations")),
            settings=settings,
        ),
        menu=MenuResponse(
            id=str(menu.get("id") or ""),
            name=str(menu.get("name") or ""),
            last_updated=str(menu.get("updated_at") or ""),
            translations=_as_optional_dict(menu.get("translations")),
            categories=[
                _build_category(category)
                for category in sorted(
                    _as_list(menu.get("categories")),
                    key=lambda row: row.get("sort_order") or 0,
                )
            ],
        ),
    )


def _build_category(category: dict[str, Any]) -> CategoryResponse:
    return CategoryResponse(
        id=str(category.get("id") or ""),
        name=str(category.get("name") or ""),
        sort_order=int(category.get("sort_order") or 0),
        translations=_as_optional_dict(category.get("translations")),
        items=[
            _build_menu_item(item)
            for item in sorted(
                _as_list(category.get("menu_items")),
                key=lambda row: row.get("sort_order") or 0,
            )
        ],
    )


def _build_menu_item(item: dict[str, Any]) -> MenuItemResponse:
    metadata = _as_dict(item.get("metadata"))

    return MenuItemResponse(
        id=str(item.get("id") or ""),
        name=str(item.get("name") or ""),
        description=str(item.get("description") or ""),
        base_price=_to_float(item.get("base_price")),
        is_available=bool(item.get("is_available")),
        image_url=str(item.get("image_url") or ""),
        tags=_as_string_list(metadata.get("tags")),
        metadata=metadata,
        translations=_as_optional_dict(item.get("translations")),
        variants=[
            _build_variant(variant)
            for variant in _as_list(item.get("item_variants"))
        ],
        upsell_rules=[
            rule
            for rule in (
                _build_upsell_rule(row)
                for row in _as_list(item.get("upsell_rules"))
            )
            if rule is not None
        ],
    )


def _build_variant(variant: dict[str, Any]) -> VariantResponse:
    return VariantResponse(
        id=str(variant.get("id") or ""),
        name=str(variant.get("name") or ""),
        price=_to_float(variant.get("price")),
    )


def _build_upsell_rule(rule: dict[str, Any]) -> UpsellRuleResponse | None:
    snapshot = _as_dict(rule.get("offer_item_snapshot"))
    offer_item = _as_dict(rule.get("offer_item"))

    if not snapshot and offer_item:
        snapshot = {
            "id": offer_item.get("id"),
            "name": offer_item.get("name"),
            "image_url": offer_item.get("image_url"),
            "price": offer_item.get("base_price"),
            "translations": offer_item.get("translations"),
        }

    if not snapshot and rule.get("offer_item_id"):
        snapshot = {
            "id": rule.get("offer_item_id"),
            "name": "",
            "image_url": "",
            "price": rule.get("discount_price"),
        }

    if not snapshot:
        return None

    return UpsellRuleResponse(
        offer_item_snapshot=OfferItemSnapshotResponse(
            id=str(snapshot.get("id") or ""),
            name=str(snapshot.get("name") or ""),
            image_url=str(snapshot.get("image_url") or ""),
            price=_to_float(snapshot.get("price")),
            translations=_as_optional_dict(snapshot.get("translations")),
        ),
        custom_message=str(rule.get("custom_message") or ""),
        discount_price=_to_optional_float(rule.get("discount_price")),
        translations=_as_optional_dict(rule.get("translations")),
    )


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_optional_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _as_list(value: Any) -> list[dict[str, Any]]:
    return value if isinstance(value, list) else []


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    return [str(item) for item in value if item]


def _first(value: list[dict[str, Any]]) -> dict[str, Any] | None:
    return value[0] if value else None


def _to_float(value: Any) -> float:
    return float(value or 0)


def _to_optional_float(value: Any) -> float | None:
    return float(value) if value is not None else None
