import asyncio
import logging
from collections.abc import Callable
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

logger = logging.getLogger(__name__)

_MODIFIER_ASSIGNMENT_SELECT_HINTS = """
menu_item_id,
sort_order,
min_select_override,
max_select_override,
modifier_groups!menu_item_modifier_groups_modifier_group_id_fkey(
    id,
    restaurant_id,
    name,
    translations,
    selection_mode,
    min_select,
    max_select,
    is_active,
    sort_order,
    modifier_options!modifier_options_modifier_group_id_fkey(
        id,
        name,
        translations,
        price_delta,
        is_default,
        is_available,
        sort_order
    )
)
"""

_MODIFIER_ASSIGNMENT_SELECT_PLAIN = """
menu_item_id,
sort_order,
min_select_override,
max_select_override,
modifier_groups(
    id,
    restaurant_id,
    name,
    translations,
    selection_mode,
    min_select,
    max_select,
    is_active,
    sort_order,
    modifier_options(
        id,
        name,
        translations,
        price_delta,
        is_default,
        is_available,
        sort_order
    )
)
"""

_MENU_ITEM_IDS_BATCH_SIZE = 80

_MENU_SELECT = """
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
                        header_color,
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

_MENU_SELECT_LEGACY = _MENU_SELECT.replace("                        header_color,\n", "")

_HEADER_COLOR_MISSING = "header_color"

from core.colors import normalize_hex_color
from core.dietary_icons import merge_dietary_icons_into_metadata
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
    ModifierGroupResponse,
    ModifierOptionResponse,
    OfferItemSnapshotResponse,
    RestaurantResponse,
    UpsellRuleResponse,
    VariantResponse,
)


class SupabaseDAL(MenuRepository):
    _categories_header_color_supported: bool | None = None

    def __init__(self, client: Client) -> None:
        self._client = client

    @classmethod
    def _header_color_api_error(cls, error: APIError) -> bool:
        payload = error.args[0] if error.args else {}
        if isinstance(payload, dict):
            message = str(payload.get("message") or "")
            code = str(payload.get("code") or "")
            return code == "42703" and _HEADER_COLOR_MISSING in message
        return _HEADER_COLOR_MISSING in str(error)

    def _probe_categories_header_color_support(self) -> bool:
        if SupabaseDAL._categories_header_color_supported is True:
            return True

        try:
            (
                self._client.table("categories")
                .select("header_color")
                .limit(1)
                .execute()
            )
            SupabaseDAL._categories_header_color_supported = True
        except APIError as error:
            if self._header_color_api_error(error):
                logger.warning(
                    "categories.header_color column missing; apply migration "
                    "20260602120000_category_header_color.sql in Supabase."
                )
                SupabaseDAL._categories_header_color_supported = False
                return False
            raise

        return True

    async def get_fat_menu_by_slug(self, slug: str) -> MenuPayload | None:
        response_data = await asyncio.to_thread(self._fetch_restaurant_menu, slug)
        restaurant = _first(response_data)

        if restaurant is None:
            return None

        item_ids = _collect_menu_item_ids_from_restaurant(restaurant)
        if item_ids:
            by_item_id = await asyncio.to_thread(
                self._fetch_modifier_assignments_by_item_ids,
                item_ids,
            )
            if by_item_id:
                _inject_modifier_groups_into_restaurant(restaurant, by_item_id)

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
        dietary_icons = fields.get("dietary_icons")
        metadata = merge_dietary_icons_into_metadata({}, dietary_icons)
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
            "metadata": metadata,
            "translations": fields.get("translations") or {},
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

    async def list_modifier_groups(self, restaurant_id: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_modifier_groups_sync, restaurant_id)

    async def create_modifier_group_atomic(
        self,
        restaurant_id: str,
        attach_to_item_id: str,
        fields: dict[str, Any],
    ) -> str | None:
        return await asyncio.to_thread(
            self._create_modifier_group_atomic_sync,
            restaurant_id,
            attach_to_item_id,
            fields,
        )

    async def attach_modifier_group(
        self,
        menu_item_id: str,
        modifier_group_id: str,
        restaurant_id: str,
    ) -> bool:
        return await asyncio.to_thread(
            self._attach_modifier_group_sync,
            menu_item_id,
            modifier_group_id,
            restaurant_id,
        )

    async def detach_modifier_group(
        self,
        menu_item_id: str,
        modifier_group_id: str,
        restaurant_id: str,
    ) -> bool:
        return await asyncio.to_thread(
            self._detach_modifier_group_sync,
            menu_item_id,
            modifier_group_id,
            restaurant_id,
        )

    async def update_modifier_group(
        self,
        group_id: str,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> bool:
        return await asyncio.to_thread(
            self._update_modifier_group_sync,
            group_id,
            restaurant_id,
            fields,
        )

    async def delete_modifier_group(self, group_id: str, restaurant_id: str) -> str | None:
        return await asyncio.to_thread(
            self._delete_modifier_group_sync,
            group_id,
            restaurant_id,
        )

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
        locale: str | None = None,
        name: str | None = None,
        header_color: str | None = None,
        *,
        update_header_color: bool = False,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._patch_category_sync,
            category_id,
            restaurant_id,
            locale,
            name.strip() if isinstance(name, str) else None,
            header_color,
            update_header_color,
        )

    async def update_active_menu_name(
        self,
        restaurant_id: str,
        locale: str,
        name: str,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._update_active_menu_name_sync,
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

    async def list_restaurants_for_user(
        self,
        user_id: str,
        is_superadmin: bool,
        current_slug: str | None = None,
    ) -> list[dict[str, Any]]:
        return await asyncio.to_thread(
            self._list_restaurants_for_user_sync,
            user_id,
            is_superadmin,
            current_slug,
        )

    async def patch_restaurant_settings(
        self,
        restaurant_id: str,
        *,
        banner_url: str | None | object = ...,
        qr_logo_url: str | None | object = ...,
        social_links: dict[str, object] | None | object = ...,
        default_locale: str | None | object = ...,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._patch_restaurant_settings_sync,
            restaurant_id,
            banner_url,
            qr_logo_url,
            social_links,
            default_locale,
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

    def _execute_restaurant_menu_query(
        self,
        slug: str,
        select_graph: str,
    ) -> list[dict[str, Any]]:
        try:
            response = (
                self._client.table("restaurants")
                .select(select_graph)
                .eq("slug", slug.lower())
                .eq("is_active", True)
                .eq("menus.is_active", True)
                .eq("menus.categories.is_visible", True)
                .eq("menus.categories.menu_items.is_visible", True)
                .limit(1)
                .execute()
            )
            if select_graph is _MENU_SELECT:
                SupabaseDAL._categories_header_color_supported = True
            return response.data or []
        except APIError as error:
            if (
                self._header_color_api_error(error)
                and select_graph is _MENU_SELECT
            ):
                SupabaseDAL._categories_header_color_supported = False
                logger.warning(
                    "Retrying menu fetch without categories.header_color "
                    "(run migration 20260602120000_category_header_color.sql)."
                )
                return self._execute_restaurant_menu_query(slug, _MENU_SELECT_LEGACY)
            raise

    def _fetch_restaurant_menu(self, slug: str) -> list[dict[str, Any]]:
        return self._execute_restaurant_menu_query(slug, _MENU_SELECT)

    def _fetch_modifier_assignments_by_item_ids(
        self,
        item_ids: list[str],
    ) -> dict[str, list[dict[str, Any]]]:
        """Load junction + groups + options in a separate query (avoids menu_items embed)."""
        if not item_ids:
            return {}

        by_item: dict[str, list[dict[str, Any]]] = {}
        for offset in range(0, len(item_ids), _MENU_ITEM_IDS_BATCH_SIZE):
            batch = item_ids[offset : offset + _MENU_ITEM_IDS_BATCH_SIZE]
            rows = self._fetch_modifier_assignment_rows(batch)
            for row in rows:
                item_id = str(row.get("menu_item_id") or "")
                if not item_id:
                    continue
                by_item.setdefault(item_id, []).append(row)

        for assignments in by_item.values():
            assignments.sort(
                key=lambda row: (
                    int(row.get("sort_order") or 0),
                    str(row.get("id") or ""),
                ),
            )

        return by_item

    def _fetch_modifier_assignment_rows(self, item_ids: list[str]) -> list[dict[str, Any]]:
        for select_graph in (
            _MODIFIER_ASSIGNMENT_SELECT_HINTS,
            _MODIFIER_ASSIGNMENT_SELECT_PLAIN,
        ):
            try:
                response = (
                    self._client.table("menu_item_modifier_groups")
                    .select(select_graph)
                    .in_("menu_item_id", item_ids)
                    .execute()
                )
                return list(response.data or [])
            except APIError as error:
                logger.warning(
                    "Modifier assignment fetch failed (batch=%s): %s",
                    len(item_ids),
                    error,
                )
        return []

    def _patch_restaurant_settings_sync(
        self,
        restaurant_id: str,
        banner_url: str | None | object,
        qr_logo_url: str | None | object,
        social_links: dict[str, object] | None | object,
        default_locale: str | None | object,
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
        if qr_logo_url is not ...:
            settings["qr_logo_url"] = qr_logo_url
        if social_links is not ...:
            if social_links is None:
                settings["social_links"] = {}
            else:
                current = parse_social_links_from_settings(settings)
                settings["social_links"] = apply_social_links_patch(
                    current,
                    social_links,
                )
        if default_locale is not ...:
            if default_locale is None:
                settings.pop("default_locale", None)
            else:
                settings["default_locale"] = str(default_locale).strip().lower()

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

    def _list_restaurants_for_user_sync(
        self,
        user_id: str,
        is_superadmin: bool,
        current_slug: str | None = None,
    ) -> list[dict[str, Any]]:
        if is_superadmin:
            if not current_slug:
                return []
            response = (
                self._client.table("restaurants")
                .select("id,name,slug,is_active,settings")
                .eq("slug", current_slug.lower())
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            restaurants = response.data or []
            role = "superadmin"
        else:
            membership_resp = (
                self._client.table("restaurant_members")
                .select("restaurant_id,role")
                .eq("user_id", user_id)
                .execute()
            )
            memberships = membership_resp.data or []
            if not memberships:
                return []

            membership_map: dict[str, str] = {}
            restaurant_ids: list[str] = []
            for row in memberships:
                rid = str(row.get("restaurant_id") or "")
                if rid:
                    restaurant_ids.append(rid)
                    membership_map[rid] = str(row.get("role") or "member")

            response = (
                self._client.table("restaurants")
                .select("id,name,slug,is_active,settings")
                .in_("id", restaurant_ids)
                .eq("is_active", True)
                .order("name")
                .execute()
            )
            restaurants = response.data or []
            role = None

        result: list[dict[str, Any]] = []
        for restaurant in restaurants:
            rid = str(restaurant.get("id") or "")
            if not rid:
                continue

            menus_resp = (
                self._client.table("menus")
                .select("id,name,is_active,translations")
                .eq("restaurant_id", rid)
                .order("name")
                .execute()
            )

            member_role = role if is_superadmin else membership_map.get(rid, "member")

            result.append({
                "id": rid,
                "name": str(restaurant.get("name") or ""),
                "slug": str(restaurant.get("slug") or ""),
                "role": member_role,
                "menus": [
                    {
                        "id": str(m.get("id") or ""),
                        "name": str(m.get("name") or ""),
                        "is_active": bool(m.get("is_active")),
                        "translations": _as_optional_dict(m.get("translations")),
                    }
                    for m in (menus_resp.data or [])
                    if m.get("id")
                ],
            })

        return result

    def _apply_menu_item_patch(
        self,
        item_id: str,
        fields: dict[str, Any],
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        patch_fields = dict(fields)
        if "dietary_icons" in patch_fields:
            dietary_icons = patch_fields.pop("dietary_icons")
            current_meta = self._fetch_menu_item_metadata(item_id, restaurant_id) or {}
            patch_fields["metadata"] = merge_dietary_icons_into_metadata(
                current_meta,
                dietary_icons,
            )

        response = (
            self._client.table("menu_items")
            .update(patch_fields)
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        return _first(response.data or []) if response.data else None

    def _fetch_menu_item_metadata(
        self,
        item_id: str,
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        response = (
            self._client.table("menu_items")
            .select("metadata")
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return None
        metadata = _as_dict(row.get("metadata"))
        return metadata if metadata else {}

    def _fetch_menu_item_patch_snapshot(
        self,
        item_id: str,
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        response = (
            self._client.table("menu_items")
            .select(
                "id,name,description,base_price,is_available,image_url,metadata,translations"
            )
            .eq("id", item_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        row = _first(response.data or [])
        if row is None:
            return None
        metadata = _as_dict(row.get("metadata"))
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
            "image_url": image_out,
            "tags": _as_string_list(metadata.get("tags")),
            "metadata": metadata if metadata else None,
            "translations": _as_optional_dict(row.get("translations")),
        }

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

    def _modifier_attachment_counts(self, restaurant_id: str) -> dict[str, int]:
        groups = (
            self._client.table("modifier_groups")
            .select("id")
            .eq("restaurant_id", restaurant_id)
            .execute()
        )
        group_ids = [str(row.get("id")) for row in (groups.data or []) if row.get("id")]
        if not group_ids:
            return {}

        links = (
            self._client.table("menu_item_modifier_groups")
            .select("modifier_group_id, menu_item_id")
            .in_("modifier_group_id", group_ids)
            .execute()
        )
        counts: dict[str, set[str]] = {}
        for row in links.data or []:
            gid = str(row.get("modifier_group_id") or "")
            iid = str(row.get("menu_item_id") or "")
            if gid and iid:
                counts.setdefault(gid, set()).add(iid)
        return {gid: len(items) for gid, items in counts.items()}

    def _list_modifier_groups_sync(self, restaurant_id: str) -> list[dict[str, Any]]:
        response = (
            self._client.table("modifier_groups")
            .select(
                "id, name, translations, selection_mode, min_select, max_select, sort_order, "
                "modifier_options(id, name, translations, price_delta, is_default, is_available, sort_order)"
            )
            .eq("restaurant_id", restaurant_id)
            .order("name")
            .execute()
        )
        attachment_counts = self._modifier_attachment_counts(restaurant_id)
        rows: list[dict[str, Any]] = []
        for group in response.data or []:
            gid = str(group.get("id") or "")
            options = sorted(
                _as_list(group.get("modifier_options")),
                key=lambda row: (
                    int(row.get("sort_order") or 0),
                    str(row.get("id") or ""),
                ),
            )
            rows.append(
                {
                    "id": gid,
                    "name": str(group.get("name") or ""),
                    "selection_mode": str(group.get("selection_mode") or "single"),
                    "min_select": int(group.get("min_select") or 0),
                    "max_select": int(group.get("max_select") or 1),
                    "sort_order": int(group.get("sort_order") or 0),
                    "translations": group.get("translations"),
                    "options": options,
                    "attached_item_count": attachment_counts.get(gid, 0),
                }
            )
        return rows

    def _create_modifier_group_atomic_sync(
        self,
        restaurant_id: str,
        attach_to_item_id: str,
        fields: dict[str, Any],
    ) -> str | None:
        if self._menu_item_restaurant_id(attach_to_item_id) != restaurant_id:
            return None

        options = fields.get("options") or []
        if not isinstance(options, list) or len(options) < 1:
            return None

        selection_mode = str(fields.get("selection_mode") or "single").strip().lower()
        if selection_mode not in ("single", "multi"):
            selection_mode = "single"

        min_select = int(fields.get("min_select") or 0)
        max_select = int(fields.get("max_select") or 1)
        if max_select < min_select:
            return None

        name = str(fields.get("name") or "").strip()
        if not name:
            return None

        options_json: list[dict[str, Any]] = []
        for idx, opt in enumerate(options):
            if not isinstance(opt, dict):
                continue
            opt_name = str(opt.get("name") or "").strip()
            if not opt_name:
                continue
            options_json.append(
                {
                    "name": opt_name,
                    "translations": opt.get("translations") or {},
                    "price_delta": float(opt.get("price_delta") or 0),
                    "is_default": bool(opt.get("is_default", False)),
                    "is_available": bool(opt.get("is_available", True)),
                    "sort_order": idx,
                }
            )

        if not options_json:
            return None

        try:
            response = self._client.rpc(
                "create_modifier_group_atomic",
                {
                    "p_restaurant_id": restaurant_id,
                    "p_menu_item_id": attach_to_item_id,
                    "p_name": name,
                    "p_translations": fields.get("translations") or {},
                    "p_selection_mode": selection_mode,
                    "p_min_select": min_select,
                    "p_max_select": max_select,
                    "p_options": options_json,
                },
            ).execute()
            raw = response.data
            if isinstance(raw, str):
                return raw
            if raw is not None:
                return str(raw)
            return None
        except APIError as error:
            logger.warning(
                "create_modifier_group_atomic RPC failed; trying sequential insert (%s)",
                error,
            )
            return self._create_modifier_group_sequential(
                restaurant_id,
                attach_to_item_id,
                name,
                fields.get("translations") or {},
                selection_mode,
                min_select,
                max_select,
                options_json,
            )

    def _create_modifier_group_sequential(
        self,
        restaurant_id: str,
        attach_to_item_id: str,
        name: str,
        translations: dict[str, Any],
        selection_mode: str,
        min_select: int,
        max_select: int,
        options_json: list[dict[str, Any]],
    ) -> str | None:
        """Fallback when RPC migration is not applied yet."""
        group_row = {
            "restaurant_id": restaurant_id,
            "name": name,
            "translations": translations,
            "selection_mode": selection_mode,
            "min_select": min_select,
            "max_select": max_select,
            "sort_order": 0,
        }
        inserted_group = (
            self._client.table("modifier_groups").insert(group_row).execute()
        )
        group = _first(inserted_group.data or [])
        if group is None:
            return None
        group_id = str(group.get("id") or "")
        if not group_id:
            return None

        for opt in options_json:
            opt_row = {
                "modifier_group_id": group_id,
                "name": opt["name"],
                "translations": opt.get("translations") or {},
                "price_delta": opt.get("price_delta", 0),
                "is_default": opt.get("is_default", False),
                "is_available": opt.get("is_available", True),
                "sort_order": int(opt.get("sort_order") or 0),
            }
            self._client.table("modifier_options").insert(opt_row).execute()

        sort_response = (
            self._client.table("menu_item_modifier_groups")
            .select("sort_order")
            .eq("menu_item_id", attach_to_item_id)
            .order("sort_order", desc=True)
            .limit(1)
            .execute()
        )
        top = _first(sort_response.data or [])
        next_sort = int(top.get("sort_order") or -1) + 1 if top else 0

        link = (
            self._client.table("menu_item_modifier_groups")
            .insert(
                {
                    "menu_item_id": attach_to_item_id,
                    "modifier_group_id": group_id,
                    "sort_order": next_sort,
                }
            )
            .execute()
        )
        if not link.data:
            return None
        return group_id

    def _attach_modifier_group_sync(
        self,
        menu_item_id: str,
        modifier_group_id: str,
        restaurant_id: str,
    ) -> bool:
        if self._menu_item_restaurant_id(menu_item_id) != restaurant_id:
            return False
        group = (
            self._client.table("modifier_groups")
            .select("id")
            .eq("id", modifier_group_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        if _first(group.data or []) is None:
            return False

        existing = (
            self._client.table("menu_item_modifier_groups")
            .select("id")
            .eq("menu_item_id", menu_item_id)
            .eq("modifier_group_id", modifier_group_id)
            .limit(1)
            .execute()
        )
        if _first(existing.data or []) is not None:
            return False

        sort_response = (
            self._client.table("menu_item_modifier_groups")
            .select("sort_order")
            .eq("menu_item_id", menu_item_id)
            .order("sort_order", desc=True)
            .limit(1)
            .execute()
        )
        top = _first(sort_response.data or [])
        next_sort = int(top.get("sort_order") or -1) + 1 if top else 0

        inserted = (
            self._client.table("menu_item_modifier_groups")
            .insert(
                {
                    "menu_item_id": menu_item_id,
                    "modifier_group_id": modifier_group_id,
                    "sort_order": next_sort,
                }
            )
            .execute()
        )
        return bool(inserted.data)

    def _detach_modifier_group_sync(
        self,
        menu_item_id: str,
        modifier_group_id: str,
        restaurant_id: str,
    ) -> bool:
        if self._menu_item_restaurant_id(menu_item_id) != restaurant_id:
            return False
        probe = (
            self._client.table("menu_item_modifier_groups")
            .select("id")
            .eq("menu_item_id", menu_item_id)
            .eq("modifier_group_id", modifier_group_id)
            .limit(1)
            .execute()
        )
        if _first(probe.data or []) is None:
            return False

        self._client.table("menu_item_modifier_groups").delete().eq(
            "menu_item_id",
            menu_item_id,
        ).eq("modifier_group_id", modifier_group_id).execute()
        return True

    def _update_modifier_group_sync(
        self,
        group_id: str,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> bool:
        probe = (
            self._client.table("modifier_groups")
            .select("id")
            .eq("id", group_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        if _first(probe.data or []) is None:
            return False

        selection_mode = str(fields.get("selection_mode") or "single").strip().lower()
        if selection_mode not in ("single", "multi"):
            selection_mode = "single"

        min_select = int(fields.get("min_select") or 0)
        max_select = int(fields.get("max_select") or 1)
        if max_select < min_select:
            return False

        name = str(fields.get("name") or "").strip()
        if not name:
            return False

        patch = {
            "name": name,
            "translations": fields.get("translations") or {},
            "selection_mode": selection_mode,
            "min_select": min_select,
            "max_select": max_select,
        }
        self._client.table("modifier_groups").update(patch).eq("id", group_id).eq(
            "restaurant_id",
            restaurant_id,
        ).execute()

        options = fields.get("options") or []
        if not isinstance(options, list):
            return True

        existing_resp = (
            self._client.table("modifier_options")
            .select("id")
            .eq("modifier_group_id", group_id)
            .execute()
        )
        existing_ids = {
            str(row.get("id"))
            for row in (existing_resp.data or [])
            if row.get("id")
        }
        kept_ids: set[str] = set()

        for idx, opt in enumerate(options):
            if not isinstance(opt, dict):
                continue
            opt_name = str(opt.get("name") or "").strip()
            if not opt_name:
                continue
            row = {
                "name": opt_name,
                "translations": opt.get("translations") or {},
                "price_delta": float(opt.get("price_delta") or 0),
                "is_default": bool(opt.get("is_default", False)),
                "is_available": bool(opt.get("is_available", True)),
                "sort_order": idx,
            }
            opt_id = opt.get("id")
            if isinstance(opt_id, str) and opt_id.strip():
                oid = opt_id.strip()
                if oid not in existing_ids:
                    continue
                kept_ids.add(oid)
                self._client.table("modifier_options").update(row).eq("id", oid).eq(
                    "modifier_group_id",
                    group_id,
                ).execute()
            else:
                row["modifier_group_id"] = group_id
                self._client.table("modifier_options").insert(row).execute()

        for orphan_id in existing_ids - kept_ids:
            self._client.table("modifier_options").delete().eq("id", orphan_id).eq(
                "modifier_group_id",
                group_id,
            ).execute()

        return True

    def _delete_modifier_group_sync(self, group_id: str, restaurant_id: str) -> str | None:
        probe = (
            self._client.table("modifier_groups")
            .select("id")
            .eq("id", group_id)
            .eq("restaurant_id", restaurant_id)
            .limit(1)
            .execute()
        )
        if _first(probe.data or []) is None:
            return "not_found"

        counts = self._modifier_attachment_counts(restaurant_id)
        if counts.get(group_id, 0) > 0:
            return "attached"

        self._client.table("modifier_groups").delete().eq("id", group_id).eq(
            "restaurant_id",
            restaurant_id,
        ).execute()
        return None

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

        header_color = normalize_hex_color(fields.get("header_color"))

        row = {
            "menu_id": menu_id,
            "name": name,
            "sort_order": next_sort,
            "is_visible": True,
            "translations": translations,
        }
        if self._probe_categories_header_color_support():
            row["header_color"] = header_color

        try:
            response = self._client.table("categories").insert(row).execute()
        except APIError as error:
            if self._header_color_api_error(error) and "header_color" in row:
                SupabaseDAL._categories_header_color_supported = False
                row.pop("header_color", None)
                response = self._client.table("categories").insert(row).execute()
            else:
                raise
        inserted = _first(response.data or [])
        if inserted is None:
            return None
        cid = str(inserted.get("id") or "")
        if not cid:
            return None
        self._bump_active_menus_updated_at_sync(restaurant_id)
        return self._category_owner_snapshot(inserted)

    def _patch_localized_name_sync(
        self,
        *,
        table: str,
        row_id: str,
        restaurant_id: str,
        locale: str,
        name: str,
        select: str,
        row_allowed: Callable[[dict[str, Any]], bool] | None = None,
        extra_update_eq: dict[str, Any] | None = None,
        shape: Callable[[dict[str, Any]], dict[str, Any]],
    ) -> dict[str, Any] | None:
        probe = (
            self._client.table(table)
            .select(select)
            .eq("id", row_id)
            .limit(1)
            .execute()
        )
        row = _first(probe.data or [])
        if row is None:
            return None
        if row_allowed is not None and not row_allowed(row):
            return None

        translations = _as_dict(row.get("translations"))
        bucket = _as_dict(translations.get(locale))
        bucket["name"] = name
        translations[locale] = bucket

        default_locale = self._restaurant_default_locale(restaurant_id)
        patch: dict[str, Any] = {"translations": translations}
        if locale == default_locale:
            patch["name"] = name

        query = self._client.table(table).update(patch).eq("id", row_id)
        for column, value in (extra_update_eq or {}).items():
            query = query.eq(column, value)

        response = query.execute()
        if not response.data:
            return None
        updated = _first(response.data or [])
        if updated is None:
            return None
        return shape(updated)

    def _category_owner_snapshot(self, row: dict[str, Any]) -> dict[str, Any]:
        raw_color = row.get("header_color")
        header_color = normalize_hex_color(str(raw_color)) if raw_color else None
        return {
            "id": str(row.get("id") or ""),
            "name": str(row.get("name") or ""),
            "sort_order": int(row.get("sort_order") or 0),
            "header_color": header_color,
            "translations": _as_optional_dict(row.get("translations")),
        }

    def _bump_active_menus_updated_at_sync(self, restaurant_id: str) -> None:
        try:
            self._client.rpc(
                "bump_active_menus_updated_at",
                {"p_restaurant_id": restaurant_id},
            ).execute()
        except APIError:
            self._client.table("menus").update({"updated_at": "now()"}).eq(
                "restaurant_id",
                restaurant_id,
            ).eq("is_active", True).execute()

    def _patch_category_sync(
        self,
        category_id: str,
        restaurant_id: str,
        locale: str | None,
        name: str | None,
        header_color: str | None,
        update_header_color: bool,
    ) -> dict[str, Any] | None:
        if self._category_restaurant_id(category_id) != restaurant_id:
            return None

        category_select = (
            "id,name,translations,sort_order,header_color"
            if self._probe_categories_header_color_support()
            else "id,name,translations,sort_order"
        )
        try:
            probe = (
                self._client.table("categories")
                .select(category_select)
                .eq("id", category_id)
                .limit(1)
                .execute()
            )
        except APIError as error:
            if self._header_color_api_error(error):
                SupabaseDAL._categories_header_color_supported = False
                probe = (
                    self._client.table("categories")
                    .select("id,name,translations,sort_order")
                    .eq("id", category_id)
                    .limit(1)
                    .execute()
                )
            else:
                raise
        row = _first(probe.data or [])
        if row is None:
            return None

        patch: dict[str, Any] = {}

        if name is not None and locale is not None:
            translations = _as_dict(row.get("translations"))
            bucket = _as_dict(translations.get(locale))
            bucket["name"] = name
            translations[locale] = bucket
            patch["translations"] = translations

            default_locale = self._restaurant_default_locale(restaurant_id)
            if locale == default_locale:
                patch["name"] = name

        if update_header_color and self._probe_categories_header_color_support():
            patch["header_color"] = header_color

        if not patch:
            return self._category_owner_snapshot(row)

        try:
            response = (
                self._client.table("categories")
                .update(patch)
                .eq("id", category_id)
                .execute()
            )
        except APIError as error:
            if self._header_color_api_error(error) and "header_color" in patch:
                SupabaseDAL._categories_header_color_supported = False
                patch.pop("header_color", None)
                if not patch:
                    return self._category_owner_snapshot(row)
                response = (
                    self._client.table("categories")
                    .update(patch)
                    .eq("id", category_id)
                    .execute()
                )
            else:
                raise
        if not response.data:
            return None
        updated = _first(response.data or [])
        if updated is None:
            return None

        self._bump_active_menus_updated_at_sync(restaurant_id)
        return self._category_owner_snapshot(updated)

    def _update_active_menu_name_sync(
        self,
        restaurant_id: str,
        locale: str,
        name: str,
    ) -> dict[str, Any] | None:
        menu_id = self._get_active_menu_id_for_restaurant(restaurant_id)
        if not menu_id:
            return None

        return self._patch_menu_name_sync(menu_id, restaurant_id, locale, name)

    def _patch_menu_name_sync(
        self,
        menu_id: str,
        restaurant_id: str,
        locale: str,
        name: str,
    ) -> dict[str, Any] | None:
        return self._patch_localized_name_sync(
            table="menus",
            row_id=menu_id,
            restaurant_id=restaurant_id,
            locale=locale,
            name=name,
            select="id,name,translations,restaurant_id,updated_at",
            row_allowed=lambda row: str(row.get("restaurant_id") or "") == restaurant_id,
            extra_update_eq={"restaurant_id": restaurant_id},
            shape=lambda updated: {
                "id": str(updated.get("id") or ""),
                "name": str(updated.get("name") or ""),
                "last_updated": str(updated.get("updated_at") or ""),
                "translations": _as_optional_dict(updated.get("translations")),
            },
        )

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
                "supported_locales": ["he", "en"],
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


def _collect_menu_item_ids_from_restaurant(restaurant: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for menu in _as_list(restaurant.get("menus")):
        for category in _as_list(menu.get("categories")):
            for item in _as_list(category.get("menu_items")):
                item_id = str(item.get("id") or "")
                if item_id and item_id not in seen:
                    seen.add(item_id)
                    ids.append(item_id)
    return ids


def _inject_modifier_groups_into_restaurant(
    restaurant: dict[str, Any],
    by_item_id: dict[str, list[dict[str, Any]]],
) -> None:
    for menu in _as_list(restaurant.get("menus")):
        for category in _as_list(menu.get("categories")):
            for item in _as_list(category.get("menu_items")):
                item_id = str(item.get("id") or "")
                item["menu_item_modifier_groups"] = by_item_id.get(item_id, [])


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
    raw_color = category.get("header_color")
    header_color = normalize_hex_color(str(raw_color)) if raw_color else None

    return CategoryResponse(
        id=str(category.get("id") or ""),
        name=str(category.get("name") or ""),
        sort_order=int(category.get("sort_order") or 0),
        header_color=header_color,
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


def _effective_min_max_select(
    group: dict[str, Any],
    assignment: dict[str, Any],
) -> tuple[int, int]:
    min_select = assignment.get("min_select_override")
    if min_select is None:
        min_select = group.get("min_select")
    max_select = assignment.get("max_select_override")
    if max_select is None:
        max_select = group.get("max_select")
    min_val = int(min_select if min_select is not None else 0)
    max_val = int(max_select if max_select is not None else 1)
    if max_val < min_val:
        max_val = min_val
    return min_val, max_val


def _build_modifier_option(option: dict[str, Any]) -> ModifierOptionResponse | None:
    if not bool(option.get("is_available", True)):
        return None
    option_id = str(option.get("id") or "")
    if not option_id:
        return None
    return ModifierOptionResponse(
        id=option_id,
        name=str(option.get("name") or ""),
        price_delta=_to_float(option.get("price_delta")),
        is_default=bool(option.get("is_default")),
        is_available=True,
        sort_order=int(option.get("sort_order") or 0),
        translations=_as_optional_dict(option.get("translations")),
    )


def _build_modifier_group(
    assignment: dict[str, Any],
    restaurant_id: str,
) -> ModifierGroupResponse | None:
    group = _as_dict(assignment.get("modifier_groups"))
    if not group:
        return None
    if not bool(group.get("is_active", True)):
        return None
    group_restaurant_id = str(group.get("restaurant_id") or "")
    if group_restaurant_id and group_restaurant_id != restaurant_id:
        return None

    group_id = str(group.get("id") or "")
    if not group_id:
        return None

    min_select, max_select = _effective_min_max_select(group, assignment)
    options = [
        built
        for built in (
            _build_modifier_option(row)
            for row in sorted(
                _as_list(group.get("modifier_options")),
                key=lambda row: (
                    int(row.get("sort_order") or 0),
                    str(row.get("id") or ""),
                ),
            )
        )
        if built is not None
    ]
    if not options:
        return None

    selection_mode = str(group.get("selection_mode") or "single").strip().lower()
    if selection_mode not in ("single", "multi"):
        selection_mode = "single"

    return ModifierGroupResponse(
        id=group_id,
        name=str(group.get("name") or ""),
        selection_mode=selection_mode,
        min_select=min_select,
        max_select=max_select,
        sort_order=int(assignment.get("sort_order") or 0),
        options=options,
        translations=_as_optional_dict(group.get("translations")),
    )


def _build_modifier_groups(
    item: dict[str, Any],
    restaurant_id: str,
) -> list[ModifierGroupResponse]:
    return [
        built
        for built in (
            _build_modifier_group(row, restaurant_id)
            for row in sorted(
                _as_list(item.get("menu_item_modifier_groups")),
                key=lambda row: (
                    int(row.get("sort_order") or 0),
                    str(row.get("id") or ""),
                ),
            )
        )
        if built is not None
    ]


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
        modifier_groups=_build_modifier_groups(item, restaurant_id),
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
