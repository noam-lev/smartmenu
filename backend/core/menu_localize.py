"""Resolve and slim menu payloads for a single display locale."""

from __future__ import annotations

from typing import Any

from models.schemas import (
    CategoryResponse,
    MenuItemResponse,
    MenuPayload,
    MenuResponse,
    ModifierGroupResponse,
    ModifierOptionResponse,
    OfferItemSnapshotResponse,
    RestaurantResponse,
    UpsellRuleResponse,
)

_ALLOWED_LOCALES = frozenset({"en", "he"})


def normalize_locale(value: str | None, fallback: str = "en") -> str:
    if isinstance(value, str):
        low = value.strip().lower()
        if low in _ALLOWED_LOCALES:
            return low
    fb = (fallback or "en").strip().lower()
    return fb if fb in _ALLOWED_LOCALES else "en"


def resolve_effective_locale(
    lang_query: str | None,
    default_locale: str | None,
) -> str:
    """Pick display locale: explicit query wins, else restaurant default."""
    if isinstance(lang_query, str):
        low = lang_query.strip().lower()
        if low in _ALLOWED_LOCALES:
            return low
    return normalize_locale(default_locale, fallback="en")


def _localized_string(
    base_value: Any,
    translations: dict[str, Any] | None,
    locale: str,
    field: str,
) -> str:
    if isinstance(translations, dict):
        bucket = translations.get(locale)
        if isinstance(bucket, dict):
            translated = bucket.get(field)
            if isinstance(translated, str) and translated.strip():
                return translated.strip()
    if isinstance(base_value, str):
        return base_value.strip()
    return str(base_value or "")


def slim_menu_payload(payload: MenuPayload, locale: str) -> MenuPayload:
    """Return a copy with resolved base fields and no translations blobs."""
    loc = normalize_locale(locale, fallback=payload.restaurant.default_locale or "en")

    restaurant = payload.restaurant
    restaurant_translations = restaurant.translations
    restaurant_name = _localized_string(
        restaurant.name,
        restaurant_translations,
        loc,
        "name",
    )
    settings = dict(restaurant.settings or {})
    settings_translations = settings.get("translations")
    if isinstance(settings_translations, dict):
        settings = {**settings, "translations": None}

    menu = payload.menu
    menu_name = _localized_string(menu.name, menu.translations, loc, "name")

    return MenuPayload(
        restaurant=RestaurantResponse(
            name=restaurant_name,
            slug=restaurant.slug,
            theme_color=restaurant.theme_color,
            currency=restaurant.currency,
            banner_url=restaurant.banner_url,
            banner_image_url=restaurant.banner_image_url,
            default_locale=normalize_locale(
                restaurant.default_locale,
                fallback="en",
            ),
            translations=None,
            settings=settings,
        ),
        menu=MenuResponse(
            id=menu.id,
            name=menu_name,
            last_updated=menu.last_updated,
            translations=None,
            categories=[
                _slim_category(category, loc) for category in menu.categories
            ],
        ),
    )


def _slim_category(category: CategoryResponse, locale: str) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        name=_localized_string(category.name, category.translations, locale, "name"),
        sort_order=category.sort_order,
        header_color=category.header_color,
        translations=None,
        items=[_slim_menu_item(item, locale) for item in category.items],
    )


def _slim_menu_item(item: MenuItemResponse, locale: str) -> MenuItemResponse:
    return MenuItemResponse(
        id=item.id,
        name=_localized_string(item.name, item.translations, locale, "name"),
        description=_localized_string(
            item.description,
            item.translations,
            locale,
            "description",
        ),
        base_price=item.base_price,
        is_available=item.is_available,
        sort_order=item.sort_order,
        image_url=item.image_url,
        tags=item.tags,
        metadata=item.metadata,
        translations=None,
        variants=item.variants,
        modifier_groups=[
            _slim_modifier_group(group, locale) for group in item.modifier_groups
        ],
        upsell_rules=[
            rule
            for rule in (_slim_upsell_rule(row, locale) for row in item.upsell_rules)
            if rule is not None
        ],
    )


def _slim_modifier_option(
    option: ModifierOptionResponse,
    locale: str,
) -> ModifierOptionResponse:
    return ModifierOptionResponse(
        id=option.id,
        name=_localized_string(option.name, option.translations, locale, "name"),
        price_delta=option.price_delta,
        is_default=option.is_default,
        is_available=option.is_available,
        sort_order=option.sort_order,
        translations=None,
    )


def _slim_modifier_group(
    group: ModifierGroupResponse,
    locale: str,
) -> ModifierGroupResponse:
    return ModifierGroupResponse(
        id=group.id,
        name=_localized_string(group.name, group.translations, locale, "name"),
        selection_mode=group.selection_mode,
        min_select=group.min_select,
        max_select=group.max_select,
        sort_order=group.sort_order,
        options=[_slim_modifier_option(option, locale) for option in group.options],
        translations=None,
    )


def _slim_upsell_rule(
    rule: UpsellRuleResponse,
    locale: str,
) -> UpsellRuleResponse | None:
    snapshot = _slim_offer_snapshot(rule.offer_item_snapshot, locale)
    return UpsellRuleResponse(
        id=rule.id,
        offer_item_snapshot=snapshot,
        custom_message=_localized_string(
            rule.custom_message,
            rule.translations,
            locale,
            "custom_message",
        ),
        discount_price=rule.discount_price,
        translations=None,
    )


def _slim_offer_snapshot(
    snapshot: OfferItemSnapshotResponse,
    locale: str,
) -> OfferItemSnapshotResponse:
    return OfferItemSnapshotResponse(
        id=snapshot.id,
        name=_localized_string(snapshot.name, snapshot.translations, locale, "name"),
        image_url=snapshot.image_url,
        price=snapshot.price,
        translations=None,
    )
