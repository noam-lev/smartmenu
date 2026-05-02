from abc import ABC, abstractmethod
from typing import Any

from models.schemas import MenuPayload


class MenuRepository(ABC):
    @abstractmethod
    async def get_fat_menu_by_slug(self, slug: str) -> MenuPayload | None:
        """Fetch the complete diner menu payload by restaurant slug."""
        raise NotImplementedError

    @abstractmethod
    async def update_menu_item(
        self,
        item_id: str,
        fields: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Apply a partial update to one menu item (e.g. availability, pricing, text)."""
        raise NotImplementedError

    @abstractmethod
    async def update_item_availability(
        self,
        item_id: str,
        is_available: bool,
    ) -> dict[str, Any] | None:
        """Update availability for one menu item."""
        raise NotImplementedError
