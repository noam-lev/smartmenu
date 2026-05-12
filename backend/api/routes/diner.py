from fastapi import APIRouter, Depends

from api.dependencies import get_db
from core.exceptions import MenuNotFoundError
from db.repository import MenuRepository
from models.schemas import MenuPayload


router = APIRouter(tags=["diner"])


@router.get("/menus/{restaurant_slug}", response_model=MenuPayload)
async def get_diner_menu(
    restaurant_slug: str,
    db: MenuRepository = Depends(get_db),
) -> MenuPayload:
    menu = await db.get_fat_menu_by_slug(restaurant_slug)

    if menu is None:
        raise MenuNotFoundError()

    return menu
