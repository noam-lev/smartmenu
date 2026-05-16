from abc import ABC, abstractmethod
from typing import Any

from models.schemas import MenuPayload


class MenuRepository(ABC):
    @abstractmethod
    async def get_fat_menu_by_slug(self, slug: str) -> MenuPayload | None:
        """Fetch the complete diner menu payload by restaurant slug."""
        raise NotImplementedError

    @abstractmethod
    async def get_restaurant_id_by_slug(self, slug: str) -> str | None:
        """Resolve restaurant primary key UUID from slug, or None if not found."""
        raise NotImplementedError

    @abstractmethod
    async def diagnose_menu_not_found_reason(self, slug: str) -> str:
        """Return a machine-readable reason when get_fat_menu_by_slug would return None."""
        raise NotImplementedError

    @abstractmethod
    async def update_menu_item(
        self,
        item_id: str,
        fields: dict[str, Any],
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        """Apply a partial update to one menu item scoped to restaurant_id."""
        raise NotImplementedError

    @abstractmethod
    async def update_item_availability(
        self,
        item_id: str,
        is_available: bool,
        restaurant_id: str,
    ) -> dict[str, Any] | None:
        """Update availability for one menu item scoped to restaurant_id."""
        raise NotImplementedError

    @abstractmethod
    async def create_menu_item(
        self,
        category_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Insert a menu item under category_id; returns owner-facing item snapshot or None if category missing."""
        raise NotImplementedError

    @abstractmethod
    async def delete_menu_item(self, item_id: str, restaurant_id: str) -> bool:
        """Hard-delete a menu item by id scoped to restaurant_id. Returns True if deleted."""
        raise NotImplementedError

    @abstractmethod
    async def patch_upsell_rule_message(
        self,
        rule_id: str,
        restaurant_id: str,
        locale: str,
        message: str,
    ) -> bool:
        """Merge custom_message for locale into upsell_rules.translations; optionally sync base column."""
        raise NotImplementedError

    @abstractmethod
    async def create_upsell_rule(
        self,
        trigger_item_id: str,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> str | None:
        """Insert upsell rule; returns new rule id or None if validation failed."""
        raise NotImplementedError

    @abstractmethod
    async def delete_upsell_rule(self, rule_id: str, restaurant_id: str) -> bool:
        """Delete upsell rule scoped to restaurant_id."""
        raise NotImplementedError

    @abstractmethod
    async def create_category(
        self,
        restaurant_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Insert category on active menu; returns owner snapshot or None."""
        raise NotImplementedError

    @abstractmethod
    async def update_category(
        self,
        category_id: str,
        restaurant_id: str,
        locale: str,
        name: str,
    ) -> dict[str, Any] | None:
        """Merge name for locale into translations; sync base name when locale is default."""
        raise NotImplementedError

    @abstractmethod
    async def delete_category(self, category_id: str, restaurant_id: str) -> bool:
        """Hard-delete category and its menu items (scoped to restaurant)."""
        raise NotImplementedError

    @abstractmethod
    async def bulk_update_item_orders(
        self,
        category_id: str,
        restaurant_id: str,
        updates: list[dict[str, Any]],
    ) -> bool:
        """Set sort_order for menu items in category_id; all must belong to restaurant_id."""
        raise NotImplementedError

    @abstractmethod
    async def update_categories_order(
        self,
        restaurant_id: str,
        category_ids: list[str],
    ) -> bool:
        """Set category sort_order values according to provided category id order."""
        raise NotImplementedError

    @abstractmethod
    async def import_full_restaurant(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Import a full restaurant/category/items tree from parsed onboarding payload."""
        raise NotImplementedError

    @abstractmethod
    async def update_restaurant_banner_url(
        self,
        restaurant_id: str,
        banner_url: str | None,
    ) -> dict[str, Any] | None:
        """Patch restaurants.banner_url scoped by restaurant_id."""
        raise NotImplementedError
