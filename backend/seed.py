import argparse
import json
import os
from pathlib import Path
from typing import Any

from api.dependencies import get_supabase_client
from postgrest.exceptions import APIError


MOCK_MENU_PATH = Path(__file__).resolve().parent.parent / "frontend" / "data" / "mockMenu.json"
SEEDED_RESTAURANT_SLUG = "yossis-hummus"


def main() -> None:
    args = _parse_args()
    payload = _load_mock_menu()
    supabase = get_supabase_client()
    _assert_required_schema(supabase)
    if args.reset:
        _cleanup_seeded_data(supabase, SEEDED_RESTAURANT_SLUG)

    restaurant_data = payload["restaurant"]
    menu_data = payload["menu"]

    restaurant = _insert_restaurant(supabase, restaurant_data)
    menu = _insert_menu(supabase, restaurant_id=restaurant["id"], menu_data=menu_data)

    category_id_by_mock_id: dict[str, str] = {}
    item_id_by_mock_id: dict[str, str] = {}

    for category_data in menu_data["categories"]:
        category = _insert_category(
            supabase=supabase,
            menu_id=menu["id"],
            category_data=category_data,
        )
        category_id_by_mock_id[category_data["id"]] = category["id"]

        for item_data in category_data["items"]:
            item = _insert_menu_item(
                supabase=supabase,
                restaurant_id=restaurant["id"],
                menu_id=menu["id"],
                category_id=category["id"],
                item_data=item_data,
            )
            item_id_by_mock_id[item_data["id"]] = item["id"]

            _insert_item_variants(
                supabase=supabase,
                menu_item_id=item["id"],
                variants=item_data.get("variants", []),
            )

    _insert_upsell_rules(
        supabase=supabase,
        restaurant_id=restaurant["id"],
        categories=menu_data["categories"],
        item_id_by_mock_id=item_id_by_mock_id,
    )

    print("Seed completed successfully.")
    print(f"Restaurant slug: {restaurant['slug']}")
    print(f"Inserted categories: {len(category_id_by_mock_id)}")
    print(f"Inserted menu items: {len(item_id_by_mock_id)}")


def _load_mock_menu() -> dict[str, Any]:
    with MOCK_MENU_PATH.open(encoding="utf-8") as file:
        return json.load(file)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed SmartMenu data from frontend mock JSON."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing data for the seeded restaurant slug before insert.",
    )
    return parser.parse_args()


def _assert_required_schema(supabase: Any) -> None:
    required_translation_columns = {
        "menus": "translations",
        "categories": "translations",
        "upsell_rules": "translations",
    }

    for table_name, column_name in required_translation_columns.items():
        try:
            (
                supabase.table(table_name)
                .select(column_name)
                .limit(1)
                .execute()
            )
        except APIError as exc:
            raise RuntimeError(
                f"Schema preflight failed: '{table_name}.{column_name}' is required "
                "for this seed flow. Apply the migration first."
            ) from exc


def _cleanup_seeded_data(supabase: Any, restaurant_slug: str) -> None:
    restaurants_response = (
        supabase.table("restaurants")
        .select("id")
        .eq("slug", restaurant_slug)
        .execute()
    )
    restaurant_rows = restaurants_response.data or []
    if not restaurant_rows:
        return

    restaurant_ids = [row["id"] for row in restaurant_rows]

    menus_response = (
        supabase.table("menus")
        .select("id")
        .in_("restaurant_id", restaurant_ids)
        .execute()
    )
    menu_ids = [row["id"] for row in (menus_response.data or [])]

    menu_items_response = (
        supabase.table("menu_items")
        .select("id")
        .in_("restaurant_id", restaurant_ids)
        .execute()
    )
    menu_item_ids = [row["id"] for row in (menu_items_response.data or [])]

    if menu_item_ids:
        supabase.table("item_variants").delete().in_("menu_item_id", menu_item_ids).execute()

    supabase.table("upsell_rules").delete().in_("restaurant_id", restaurant_ids).execute()
    supabase.table("menu_items").delete().in_("restaurant_id", restaurant_ids).execute()

    if menu_ids:
        supabase.table("categories").delete().in_("menu_id", menu_ids).execute()
        supabase.table("menus").delete().in_("id", menu_ids).execute()

    supabase.table("restaurants").delete().eq("slug", restaurant_slug).execute()


def _insert_restaurant(supabase: Any, restaurant_data: dict[str, Any]) -> dict[str, Any]:
    settings = {
        "theme_color": restaurant_data.get("theme_color"),
        "currency": restaurant_data.get("currency"),
        "banner_image_url": restaurant_data.get("banner_image_url"),
        "default_locale": restaurant_data.get("default_locale"),
        "translations": restaurant_data.get("translations", {}),
    }
    row = {
        "name": restaurant_data["name"],
        "slug": SEEDED_RESTAURANT_SLUG,
        "settings": _without_none_values(settings),
        "is_active": True,
    }

    owner_id = os.getenv("SEED_OWNER_ID")
    if owner_id:
        row["owner_id"] = owner_id

    return _insert_one(supabase, "restaurants", row)


def _insert_menu(
    supabase: Any,
    restaurant_id: str,
    menu_data: dict[str, Any],
) -> dict[str, Any]:
    row = {
        "restaurant_id": restaurant_id,
        "name": menu_data["name"],
        "translations": menu_data.get("translations", {}),
        "is_active": True,
    }

    if menu_data.get("last_updated"):
        row["updated_at"] = menu_data["last_updated"]

    return _insert_one(supabase, "menus", row)


def _insert_category(
    supabase: Any,
    menu_id: str,
    category_data: dict[str, Any],
) -> dict[str, Any]:
    return _insert_one(
        supabase,
        "categories",
        {
            "menu_id": menu_id,
            "name": category_data["name"],
            "translations": category_data.get("translations", {}),
            "sort_order": category_data.get("sort_order", 0),
            "is_visible": True,
        },
    )


def _insert_menu_item(
    supabase: Any,
    restaurant_id: str,
    menu_id: str,
    category_id: str,
    item_data: dict[str, Any],
) -> dict[str, Any]:
    return _insert_one(
        supabase,
        "menu_items",
        {
            "restaurant_id": restaurant_id,
            "menu_id": menu_id,
            "category_id": category_id,
            "name": item_data["name"],
            "description": item_data.get("description", ""),
            "base_price": item_data["base_price"],
            "is_available": item_data.get("is_available", True),
            "is_visible": True,
            "sort_order": item_data.get("sort_order", 0),
            "image_url": item_data.get("image_url", ""),
            "metadata": {"tags": item_data.get("tags", [])},
            "translations": item_data.get("translations", {}),
        },
    )


def _insert_item_variants(
    supabase: Any,
    menu_item_id: str,
    variants: list[dict[str, Any]],
) -> None:
    for variant_data in variants:
        _insert_one(
            supabase,
            "item_variants",
            {
                "menu_item_id": menu_item_id,
                "name": variant_data.get("name", "Regular"),
                "price": variant_data["price"],
            },
        )


def _insert_upsell_rules(
    supabase: Any,
    restaurant_id: str,
    categories: list[dict[str, Any]],
    item_id_by_mock_id: dict[str, str],
) -> None:
    for category_data in categories:
        for item_data in category_data["items"]:
            trigger_item_id = item_id_by_mock_id[item_data["id"]]

            for rule_data in item_data.get("upsell_rules", []):
                offer_mock_id = rule_data["offer_item_snapshot"]["id"]
                offer_item_id = item_id_by_mock_id.get(offer_mock_id)

                if offer_item_id is None:
                    raise ValueError(
                        f"Upsell offer item '{offer_mock_id}' does not exist in mock items."
                    )

                _insert_one(
                    supabase,
                    "upsell_rules",
                    {
                        "restaurant_id": restaurant_id,
                        "trigger_item_id": trigger_item_id,
                        "offer_item_id": offer_item_id,
                        "custom_message": rule_data.get("custom_message", ""),
                        "discount_price": rule_data.get("discount_price"),
                        "translations": rule_data.get("translations", {}),
                    },
                )


def _insert_one(supabase: Any, table_name: str, row: dict[str, Any]) -> dict[str, Any]:
    response = supabase.table(table_name).insert(row).execute()

    if not response.data:
        raise RuntimeError(f"Insert into '{table_name}' returned no data.")

    return response.data[0]


def _without_none_values(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


if __name__ == "__main__":
    main()
