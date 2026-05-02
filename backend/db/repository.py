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
