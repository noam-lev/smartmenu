import logging

from fastapi import APIRouter, Depends

from api.dependencies import get_db
from core.exceptions import MenuNotFoundError
from db.repository import MenuRepository
from models.schemas import MenuPayload


logger = logging.getLogger(__name__)

router = APIRouter(tags=["diner"])


@router.get("/menus/{restaurant_slug}", response_model=MenuPayload)
async def get_diner_menu(
    restaurant_slug: str,
    db: MenuRepository = Depends(get_db),
) -> MenuPayload:
    try:
        menu = await db.get_fat_menu_by_slug(restaurant_slug)

        if menu is None:
            code = await db.diagnose_menu_not_found_reason(restaurant_slug)
            logger.warning(
                "Diner menu not found slug=%s code=%s",
                restaurant_slug,
                code,
            )
            raise MenuNotFoundError(code=code)

        return menu
    except MenuNotFoundError:
        raise
    except Exception:
        logger.exception(
            "Diner menu fetch failed slug=%s",
            restaurant_slug,
        )
        raise
