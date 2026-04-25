from abc import ABC, abstractmethod

from models.schemas import MenuPayload


class MenuRepository(ABC):
    @abstractmethod
    async def get_fat_menu_by_slug(self, slug: str) -> MenuPayload | None:
        """Fetch the complete diner menu payload by restaurant slug."""
        raise NotImplementedError
