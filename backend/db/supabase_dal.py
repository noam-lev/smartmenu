import asyncio
from typing import Any

from supabase import Client

from core.menu_lookup import (
    MENU_NOT_PUBLISHABLE,
    NO_ACTIVE_MENU,
    RESTAURANT_INACTIVE,
    RESTAURANT_NOT_FOUND,
)
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

    async def diagnose_menu_not_found_reason(self, slug: str) -> str:
        return await asyncio.to_thread(self._diagnose_menu_not_found_reason_sync, slug)

    async def get_restaurant_id_by_slug(self, slug: str) -> str | None:
        return await asyncio.to_thread(self._fetch_restaurant_id_by_slug, slug)

    async def update_item_availability(
        self,
        item_id: str,
        is_available: bool,
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        return await self.update_menu_item(
            item_id,
            {"is_available": is_available},
            restaurant_id,
        )

    async def update_menu_item(
        self,
        item_id: str,
        fields: dict[str, Any],
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        updated = await asyncio.to_thread(
            self._apply_menu_item_patch,
            item_id,
            fields,
            restaurant_id,
        )
        if updated is None:
            return None

        return await asyncio.to_thread(
            self._fetch_menu_item_patch_snapshot,
            item_id,
            restaurant_id,
        )

    async def create_menu_item(
        self,
        category_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        resolved = await asyncio.to_thread(
            self._resolve_category_restaurant_menu,
            category_id,
        )
        if resolved is None:
            return None

        restaurant_id, menu_id = resolved
        next_sort = await asyncio.to_thread(
            self._next_sort_order_for_category,
            category_id,
        )

        description = fields.get("description")
        row = {
            "restaurant_id": restaurant_id,
            "menu_id": menu_id,
            "category_id": category_id,
            "name": fields["name"],
            "description": description if isinstance(description, str) else "",
            "base_price": float(fields["base_price"]),
            "image_url": _as_optional_string(fields.get("image_url")),
            "is_available": True,
            "is_visible": True,
            "sort_order": next_sort,
            "metadata": {},
            "translations": {},
        }

        inserted = await asyncio.to_thread(self._insert_menu_item_row, row)
        if inserted is None:
            return None

        item_id = str(inserted.get("id") or "")
        if not item_id:
            return None

        return await asyncio.to_thread(self._fetch_menu_item_owner_snapshot_full, item_id)

    async def delete_menu_item(self, item_id: str, restaurant_id: str) -> bool:
        return await asyncio.to_thread(self._delete_menu_item_row, item_id, restaurant_id)

    async def patch_upsell_rule_message(
        self,
        rule_id: str,
        restaurant_id: str,
        locale: str,
        message: str,
    ) -> bool:
        return await asyncio.to_thread(
            self._patch_upsell_rule_message_sync,
            rule_id,
            restaurant_id,
            locale,
            message.strip(),
        )

    async def create_upsell_rule(
        self,
        trigger_item_id: str,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> str | None:
        return await asyncio.to_thread(
            self._insert_upsell_rule_sync,
            trigger_item_id,
            restaurant_id,
            fields,
        )

    async def delete_upsell_rule(self, rule_id: str, restaurant_id: str) -> bool:
        return await asyncio.to_thread(self._delete_upsell_rule_sync, rule_id, restaurant_id)

    async def create_category(
        self,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._insert_category_sync, restaurant_id, fields)

    async def update_category(
        self,
        category_id: str,
        restaurant_id: str,
        locale: str,
        name: str,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._patch_category_name_sync,
            category_id,
            restaurant_id,
            locale,
            name.strip(),
        )

    async def delete_category(self, category_id: str, restaurant_id: str) -> bool:
        return await asyncio.to_thread(
            self._delete_category_cascade_sync,
            category_id,
            restaurant_id,
        )

    async def bulk_update_item_orders(
        self,
        category_id: str,
        restaurant_id: str,
        updates: list[dict[str, Any]],
    ) -> bool:
        return await asyncio.to_thread(
            self._bulk_update_item_orders_sync,
            category_id,
            restaurant_id,
            updates,
        )

    async def update_categories_order(
        self,
        restaurant_id: str,
        category_ids: list[str],
    ) -> bool:
        return await asyncio.to_thread(
            self._bulk_update_category_orders_sync,
            restaurant_id,
            category_ids,
        )

    async def import_full_restaurant(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._import_full_restaurant_sync, payload)

    async def patch_restaurant_settings(
        self,
        restaurant_id: str,
        *,
        banner_url: str | None | object = ...,
        social_links: dict[str, object] | None | object = ...,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._patch_restaurant_settings_sync,
            restaurant_id,
            banner_url,
            social_links,
        )

    def _diagnose_menu_not_found_reason_sync(self, slug: str) -> str:
        normalized = slug.lower()
        response = (
            self._client.table("restaurants")
            .select("id,is_active")
            .eq("slug", normalized)
            .limit(1)
            .execute()
        )
        restaurant = _first(response.data or [])
        if restaurant is None:
            return RESTAURANT_NOT_FOUND

        if not bool(restaurant.get("is_active")):
            return RESTAURANT_INACTIVE

        restaurant_id = str(restaurant.get("id") or "")
        if not restaurant_id:
            return RESTAURANT_NOT_FOUND

        menu_response = (
            self._client.table("menus")
            .select("id")
            .eq("restaurant_id", restaurant_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if _first(menu_response.data or []) is None:
            return NO_ACTIVE_MENU

        return MENU_NOT_PUBLISHABLE

    def _fetch_restaurant_id_by_slug(self, slug: str) -> str | None:
        response = (
            self._client.table("restaurants")
            .select("id")
            .eq("slug", slug.lower())
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return None
        rid = row.get("id")
        return str(rid) if rid else None

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
                    translations,
                    is_active,
                    updated_at,
                    categories(
                        id,
                        name,
                        translations,
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
                                translations,
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

    def _patch_restaurant_settings_sync(
        self,
        restaurant_id: str,
        banner_url: str | None | object,
        social_links: dict[str, object] | None | object,
    ) -> dict[str, Any] | None:
        from core.social_links import (
            apply_social_links_patch,
            parse_social_links_from_settings,
        )

        probe = (
            self._client.table("restaurants")
            .select("id,settings")
            .eq("id", restaurant_id)
            .limit(1)
            .execute()
        )
        row = _first(probe.data or [])
        if row is None:
            return None

        settings = _as_dict(row.get("settings"))
        if banner_url is not ...:
            settings["banner_image_url"] = banner_url
        if social_links is not ...:
            if social_links is None:
                settings["social_links"] = {}
            else:
                current = parse_social_links_from_settings(settings)
                settings["social_links"] = apply_social_links_patch(
                    current,
                    social_links,
                )

        response = (
            self._client.table("restaurants")
            .update({"settings": settings})
            .eq("id", restaurant_id)
            .execute()
        )
        updated_row = _first(response.data or [])
        if updated_row is None:
            return None

        return {
            "id": str(updated_row.get("id") or ""),
            "banner_url": _as_optional_string(settings.get("banner_image_url")),
            "settings": settings,
        }

    def _apply_menu_item_patch(
        self,
        item_id: str,
        fields: dict[str, Any],
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        response = (
            self._client.table("menu_items")
            .update(fields)
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        return _first(response.data or []) if response.data else None

    def _fetch_menu_item_patch_snapshot(
        self,
        item_id: str,
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        response = (
            self._client.table("menu_items")
            .select("id,name,description,base_price,is_available,translations")
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        return _first(response.data or [])

    def _resolve_category_restaurant_menu(
        self,
        category_id: str,
    ) -> tuple[str, str] | None:
        cat_resp = (
            self._client.table("categories")
            .select("menu_id")
            .eq("id", category_id)
            .limit(1)
            .execute()
        )
        cat_row = _first(cat_resp.data or [])
        if not cat_row:
            return None

        menu_id = str(cat_row.get("menu_id") or "")
        if not menu_id:
            return None

        menu_resp = (
            self._client.table("menus")
            .select("restaurant_id")
            .eq("id", menu_id)
            .limit(1)
            .execute()
        )
        menu_row = _first(menu_resp.data or [])
        if not menu_row:
            return None

        restaurant_id = str(menu_row.get("restaurant_id") or "")
        if not restaurant_id:
            return None

        return restaurant_id, menu_id

    def _next_sort_order_for_category(self, category_id: str) -> int:
        response = (
            self._client.table("menu_items")
            .select("sort_order")
            .eq("category_id", category_id)
            .order("sort_order", desc=True)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return 0

        return int(row.get("sort_order") or 0) + 1

    def _insert_menu_item_row(self, row: dict[str, Any]) -> dict[str, Any] | None:
        response = self._client.table("menu_items").insert(row).execute()
        return _first(response.data or [])

    def _delete_menu_item_row(self, item_id: str, restaurant_id: str) -> bool:
        probe = (
            self._client.table("menu_items")
            .select("id")
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        if _first(probe.data or []) is None:
            return False

        self._client.table("menu_items").delete().eq("id", item_id).eq(
            "restaurant_id",
            restaurant_id,
        ).execute()
        return True

    def _fetch_menu_item_owner_snapshot_full(self, item_id: str) -> dict[str, Any] | None:
        response = (
            self._client.table("menu_items")
            .select(
                """
                id,
                name,
                description,
                base_price,
                is_available,
                sort_order,
                image_url,
                metadata,
                translations,
                item_variants(
                    id,
                    name,
                    price
                )
                """
            )
            .eq("id", item_id)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return None

        metadata = _as_dict(row.get("metadata"))
        variants_raw = _as_list(row.get("item_variants"))
        variants = [
            {
                "id": str(v.get("id") or ""),
                "name": str(v.get("name") or ""),
                "price": _to_float(v.get("price")),
            }
            for v in variants_raw
        ]

        image_val = row.get("image_url")
        image_out: str | None
        if isinstance(image_val, str) and image_val.strip():
            image_out = image_val.strip()
        else:
            image_out = None

        return {
            "id": str(row.get("id") or ""),
            "name": str(row.get("name") or ""),
            "description": str(row.get("description") or ""),
            "base_price": _to_float(row.get("base_price")),
            "is_available": bool(row.get("is_available")),
            "sort_order": int(row.get("sort_order") or 0),
            "image_url": image_out,
            "tags": _as_string_list(metadata.get("tags")),
            "metadata": metadata if metadata else None,
            "translations": _as_optional_dict(row.get("translations")),
            "variants": variants,
            "upsell_rules": [],
        }

    def _menu_item_restaurant_id(self, item_id: str) -> str | None:
        response = (
            self._client.table("menu_items")
            .select("restaurant_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return None
        rid = row.get("restaurant_id")
        return str(rid) if rid else None

    def _restaurant_default_locale(self, restaurant_id: str) -> str:
        response = (
            self._client.table("restaurants")
            .select("settings")
            .eq("id", restaurant_id)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return "en"
        settings = _as_dict(row.get("settings"))
        loc = settings.get("default_locale")
        if isinstance(loc, str) and loc.strip():
            return loc.strip().lower()
        return "en"

    def _patch_upsell_rule_message_sync(
        self,
        rule_id: str,
        restaurant_id: str,
        locale: str,
        message: str,
    ) -> bool:
        probe = (
            self._client.table("upsell_rules")
            .select("id,translations")
            .eq("id", rule_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        row = _first(probe.data or [])
        if row is None:
            return False

        translations = _as_dict(row.get("translations"))
        bucket = _as_dict(translations.get(locale))
        bucket["custom_message"] = message
        translations[locale] = bucket

        default_locale = self._restaurant_default_locale(restaurant_id)
        patch: dict[str, Any] = {"translations": translations}
        if locale == default_locale:
            patch["custom_message"] = message

        response = (
            self._client.table("upsell_rules")
            .update(patch)
            .eq("id", rule_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        return bool(response.data)

    def _insert_upsell_rule_sync(
        self,
        trigger_item_id: str,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> str | None:
        trigger_rid = self._menu_item_restaurant_id(trigger_item_id)
        if trigger_rid != restaurant_id:
            return None

        offer_id = str(fields.get("offer_item_id") or "")
        if not offer_id or offer_id == trigger_item_id:
            return None

        offer_rid = self._menu_item_restaurant_id(offer_id)
        if offer_rid != restaurant_id:
            return None

        discount_price = float(fields["discount_price"])
        cm = fields.get("custom_message")
        custom_message = cm.strip() if isinstance(cm, str) else ""

        row = {
            "restaurant_id": restaurant_id,
            "trigger_item_id": trigger_item_id,
            "offer_item_id": offer_id,
            "custom_message": custom_message,
            "discount_price": discount_price,
            "translations": {},
        }
        response = self._client.table("upsell_rules").insert(row).execute()
        inserted = _first(response.data or [])
        if inserted is None:
            return None
        new_id = inserted.get("id")
        return str(new_id) if new_id else None

    def _delete_upsell_rule_sync(self, rule_id: str, restaurant_id: str) -> bool:
        probe = (
            self._client.table("upsell_rules")
            .select("id")
            .eq("id", rule_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        if _first(probe.data or []) is None:
            return False

        self._client.table("upsell_rules").delete().eq("id", rule_id).eq(
            "restaurant_id",
            restaurant_id,
        ).execute()
        return True

    def _get_active_menu_id_for_restaurant(self, restaurant_id: str) -> str | None:
        response = (
            self._client.table("menus")
            .select("id")
            .eq("restaurant_id", restaurant_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return None
        mid = row.get("id")
        return str(mid) if mid else None

    def _next_category_sort_order_for_menu(self, menu_id: str) -> int:
        response = (
            self._client.table("categories")
            .select("sort_order")
            .eq("menu_id", menu_id)
            .order("sort_order", desc=True)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return 0
        return int(row.get("sort_order") or 0) + 1

    def _category_restaurant_id(self, category_id: str) -> str | None:
        cat_resp = (
            self._client.table("categories")
            .select("menu_id")
            .eq("id", category_id)
            .limit(1)
            .execute()
        )
        cat_row = _first(cat_resp.data or [])
        if not cat_row:
            return None
        menu_id = str(cat_row.get("menu_id") or "")
        if not menu_id:
            return None
        menu_resp = (
            self._client.table("menus")
            .select("restaurant_id")
            .eq("id", menu_id)
            .limit(1)
            .execute()
        )
        menu_row = _first(menu_resp.data or [])
        if not menu_row:
            return None
        rid = menu_row.get("restaurant_id")
        return str(rid) if rid else None

    def _insert_category_sync(
        self,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        menu_id = self._get_active_menu_id_for_restaurant(restaurant_id)
        if not menu_id:
            return None

        locale = str(fields.get("locale") or "en")
        name = str(fields.get("name") or "").strip()
        if not name:
            return None

        next_sort = self._next_category_sort_order_for_menu(menu_id)
        default_locale = self._restaurant_default_locale(restaurant_id)
        translations: dict[str, Any] = {locale: {"name": name}}

        row = {
            "menu_id": menu_id,
            "name": name,
            "sort_order": next_sort,
            "is_visible": True,
            "translations": translations,
        }
        response = self._client.table("categories").insert(row).execute()
        inserted = _first(response.data or [])
        if inserted is None:
            return None
        cid = str(inserted.get("id") or "")
        if not cid:
            return None
        return {
            "id": cid,
            "name": str(inserted.get("name") or ""),
            "sort_order": int(inserted.get("sort_order") or 0),
            "translations": _as_optional_dict(inserted.get("translations")),
        }

    def _patch_category_name_sync(
        self,
        category_id: str,
        restaurant_id: str,
        locale: str,
        name: str,
    ) -> dict[str, Any] | None:
        if self._category_restaurant_id(category_id) != restaurant_id:
            return None

        probe = (
            self._client.table("categories")
            .select("id,name,translations,sort_order")
            .eq("id", category_id)
            .limit(1)
            .execute()
        )
        row = _first(probe.data or [])
        if row is None:
            return None

        translations = _as_dict(row.get("translations"))
        bucket = _as_dict(translations.get(locale))
        bucket["name"] = name
        translations[locale] = bucket

        default_locale = self._restaurant_default_locale(restaurant_id)
        patch: dict[str, Any] = {"translations": translations}
        if locale == default_locale:
            patch["name"] = name

        response = (
            self._client.table("categories")
            .update(patch)
            .eq("id", category_id)
            .execute()
        )
        if not response.data:
            return None
        updated = _first(response.data or [])
        if updated is None:
            return None
        return {
            "id": str(updated.get("id") or ""),
            "name": str(updated.get("name") or ""),
            "sort_order": int(updated.get("sort_order") or 0),
            "translations": _as_optional_dict(updated.get("translations")),
        }

    def _delete_category_cascade_sync(self, category_id: str, restaurant_id: str) -> bool:
        if self._category_restaurant_id(category_id) != restaurant_id:
            return False

        probe = (
            self._client.table("categories")
            .select("id")
            .eq("id", category_id)
            .limit(1)
            .execute()
        )
        if _first(probe.data or []) is None:
            return False

        items_resp = (
            self._client.table("menu_items")
            .select("id")
            .eq("category_id", category_id)
            .execute()
        )
        item_ids = [str(r.get("id")) for r in (items_resp.data or []) if r.get("id")]

        if item_ids:
            self._client.table("item_variants").delete().in_("menu_item_id", item_ids).execute()
            self._client.table("upsell_rules").delete().in_("trigger_item_id", item_ids).execute()
            self._client.table("upsell_rules").delete().in_("offer_item_id", item_ids).execute()
            self._client.table("menu_items").delete().in_("id", item_ids).execute()

        self._client.table("categories").delete().eq("id", category_id).execute()
        return True

    def _bulk_update_item_orders_sync(
        self,
        category_id: str,
        restaurant_id: str,
        updates: list[dict[str, Any]],
    ) -> bool:
        if self._category_restaurant_id(category_id) != restaurant_id:
            return False

        requested_ids: list[str] = []
        for u in updates:
            iid = str(u.get("item_id") or "")
            if not iid:
                return False
            requested_ids.append(iid)

        if len(requested_ids) != len(set(requested_ids)):
            return False

        probe = (
            self._client.table("menu_items")
            .select("id,category_id,restaurant_id")
            .eq("category_id", category_id)
            .in_("id", requested_ids)
            .execute()
        )
        rows = probe.data or []
        if len(rows) != len(set(requested_ids)):
            return False

        for row in rows:
            if str(row.get("restaurant_id") or "") != restaurant_id:
                return False

        for entry in updates:
            item_id = str(entry["item_id"])
            sort_order = int(entry["sort_order"])
            self._client.table("menu_items").update({"sort_order": sort_order}).eq(
                "id", item_id
            ).eq("restaurant_id", restaurant_id).eq("category_id", category_id).execute()

        return True

    def _bulk_update_category_orders_sync(
        self,
        restaurant_id: str,
        category_ids: list[str],
    ) -> bool:
        clean_ids: list[str] = []
        for category_id in category_ids:
            normalized = str(category_id or "").strip()
            if not normalized:
                return False
            clean_ids.append(normalized)

        if not clean_ids:
            return True
        if len(clean_ids) != len(set(clean_ids)):
            return False

        menu_id = self._get_active_menu_id_for_restaurant(restaurant_id)
        if not menu_id:
            return False

        probe = (
            self._client.table("categories")
            .select("id")
            .eq("menu_id", menu_id)
            .in_("id", clean_ids)
            .execute()
        )
        found_ids = {str(row.get("id") or "") for row in (probe.data or [])}
        if len(found_ids) != len(clean_ids):
            return False

        for index, category_id in enumerate(clean_ids):
            self._client.table("categories").update({"sort_order": index}).eq(
                "id",
                category_id,
            ).eq("menu_id", menu_id).execute()
        return True

    def _import_full_restaurant_sync(self, payload: dict[str, Any]) -> dict[str, Any]:
        restaurant_name = str(payload.get("restaurant_name") or "").strip()
        restaurant_slug = str(payload.get("restaurant_slug") or "").strip().lower()
        categories = payload.get("categories")
        if not restaurant_name:
            raise RuntimeError("restaurant_name is required.")
        if not restaurant_slug:
            raise RuntimeError("restaurant_slug is required.")
        if not isinstance(categories, list):
            raise RuntimeError("categories must be a list.")

        existing = (
            self._client.table("restaurants")
            .select("id")
            .eq("slug", restaurant_slug)
            .limit(1)
            .execute()
        )
        if _first(existing.data or []) is not None:
            raise RuntimeError(f"Restaurant slug already exists: {restaurant_slug}")

        try:
            restaurant_id = self._insert_import_restaurant_row(restaurant_name, restaurant_slug)

            menu_insert = (
                self._client.table("menus")
                .insert(
                    {
                        "restaurant_id": restaurant_id,
                        "name": "Main Menu",
                        "is_active": True,
                        "translations": {},
                    }
                )
                .execute()
            )
            menu_row = _first(menu_insert.data or [])
            if menu_row is None:
                raise RuntimeError("Failed to create menu for imported restaurant.")
            menu_id = str(menu_row.get("id") or "")
            if not menu_id:
                raise RuntimeError("Created menu has no id.")

            inserted_categories = 0
            inserted_items = 0

            for category_index, category in enumerate(categories):
                if not isinstance(category, dict):
                    continue
                name_he = str(category.get("name_he") or "").strip()
                name_en = str(category.get("name_en") or "").strip()
                if not name_he:
                    continue

                category_insert = (
                    self._client.table("categories")
                    .insert(
                        {
                            "menu_id": menu_id,
                            "name": name_he,
                            "sort_order": category_index,
                            "is_visible": True,
                            "translations": {"en": {"name": name_en}},
                        }
                    )
                    .execute()
                )
                category_row = _first(category_insert.data or [])
                if category_row is None:
                    raise RuntimeError(f"Failed to create category: {name_he}")
                category_id = str(category_row.get("id") or "")
                if not category_id:
                    raise RuntimeError("Created category has no id.")
                inserted_categories += 1

                items = category.get("items")
                if not isinstance(items, list):
                    continue

                for item_index, item in enumerate(items):
                    if not isinstance(item, dict):
                        continue
                    item_name_he = str(item.get("name_he") or "").strip()
                    if not item_name_he:
                        continue

                    description_he_raw = item.get("description_he")
                    description_he = (
                        str(description_he_raw).strip()
                        if isinstance(description_he_raw, str)
                        else ""
                    )
                    description_en_raw = item.get("description_en")
                    description_en = (
                        str(description_en_raw).strip()
                        if isinstance(description_en_raw, str)
                        else ""
                    )

                    base_price = float(item.get("base_price") or 0)
                    item_insert = (
                        self._client.table("menu_items")
                        .insert(
                            {
                                "restaurant_id": restaurant_id,
                                "menu_id": menu_id,
                                "category_id": category_id,
                                "name": item_name_he,
                                "description": description_he,
                                "base_price": base_price,
                                "is_available": True,
                                "is_visible": True,
                                "sort_order": item_index,
                                "metadata": {},
                                "translations": {
                                    "en": {
                                        "name": str(item.get("name_en") or "").strip(),
                                        "description": description_en,
                                    }
                                },
                            }
                        )
                        .execute()
                    )
                    if _first(item_insert.data or []) is None:
                        raise RuntimeError(f"Failed to create item: {item_name_he}")
                    inserted_items += 1

            return {
                "restaurant_slug": restaurant_slug,
                "restaurant_name": restaurant_name,
                "categories_imported": inserted_categories,
                "items_imported": inserted_items,
            }
        except Exception as exc:
            raise RuntimeError(f"Restaurant import failed: {exc}") from exc

    def _insert_import_restaurant_row(self, restaurant_name: str, restaurant_slug: str) -> str:
        base_row = {
            "name": restaurant_name,
            "slug": restaurant_slug,
            "is_active": True,
            "settings": {
                "default_locale": "he",
                "theme_color": "#111827",
                "currency": "ILS",
            },
        }
        try:
            response = self._client.table("restaurants").insert(
                {
                    **base_row,
                    "default_locale": "he",
                }
            ).execute()
        except Exception:
            # Some schemas store default_locale inside settings only.
            response = self._client.table("restaurants").insert(base_row).execute()

        inserted = _first(response.data or [])
        if inserted is None:
            raise RuntimeError("Failed to create restaurant.")
        restaurant_id = str(inserted.get("id") or "")
        if not restaurant_id:
            raise RuntimeError("Created restaurant has no id.")
        return restaurant_id


def _build_menu_payload(
    restaurant: dict[str, Any],
    menu: dict[str, Any],
) -> MenuPayload:
    settings = _as_dict(restaurant.get("settings"))
    restaurant_id = str(restaurant.get("id") or "")
    banner_url = _as_optional_string(restaurant.get("banner_url"))
    if banner_url is None:
        banner_url = _as_optional_string(settings.get("banner_image_url"))

    return MenuPayload(
        restaurant=RestaurantResponse(
            name=str(restaurant.get("name") or ""),
            slug=str(restaurant.get("slug") or ""),
            theme_color=str(settings.get("theme_color") or "#111827"),
            currency=str(settings.get("currency") or "ILS"),
            banner_url=banner_url,
            banner_image_url=banner_url,
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
                _build_category(category, restaurant_id)
                for category in sorted(
                    _as_list(menu.get("categories")),
                    key=lambda row: (
                        int(row.get("sort_order") or 0),
                        str(row.get("id") or ""),
                    ),
                )
            ],
        ),
    )


def _build_category(
    category: dict[str, Any],
    restaurant_id: str,
) -> CategoryResponse:
    return CategoryResponse(
        id=str(category.get("id") or ""),
        name=str(category.get("name") or ""),
        sort_order=int(category.get("sort_order") or 0),
        translations=_as_optional_dict(category.get("translations")),
        items=[
            _build_menu_item(item, restaurant_id)
            for item in sorted(
                _as_list(category.get("menu_items")),
                key=lambda row: (
                    int(row.get("sort_order") or 0),
                    str(row.get("id") or ""),
                ),
            )
        ],
    )


def _build_menu_item(item: dict[str, Any], restaurant_id: str) -> MenuItemResponse:
    metadata = _as_dict(item.get("metadata"))

    return MenuItemResponse(
        id=str(item.get("id") or ""),
        name=str(item.get("name") or ""),
        description=str(item.get("description") or ""),
        base_price=_to_float(item.get("base_price")),
        is_available=bool(item.get("is_available")),
        sort_order=int(item.get("sort_order") or 0),
        image_url=_as_optional_string(item.get("image_url")),
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
                _build_upsell_rule(row, restaurant_id)
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


def _build_upsell_rule(
    rule: dict[str, Any],
    restaurant_id: str,
) -> UpsellRuleResponse | None:
    snapshot = _as_dict(rule.get("offer_item_snapshot"))
    offer_item = _as_dict(rule.get("offer_item"))
    offer_item_restaurant_id = str(offer_item.get("restaurant_id") or "")

    if offer_item and offer_item_restaurant_id != restaurant_id:
        return None

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

    rule_id = str(rule.get("id") or "")
    if not rule_id:
        return None

    return UpsellRuleResponse(
        id=rule_id,
        offer_item_snapshot=OfferItemSnapshotResponse(
            id=str(snapshot.get("id") or ""),
            name=str(snapshot.get("name") or ""),
            image_url=_as_optional_string(snapshot.get("image_url")),
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


def _as_optional_string(value: Any) -> str | None:
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return None


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
