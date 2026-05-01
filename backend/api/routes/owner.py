from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_db
from db.repository import MenuRepository


router = APIRouter(tags=["owner"])


class ItemAvailabilityPayload(BaseModel):
    is_available: bool


@router.get("/ping")
async def ping_owner() -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}


# TODO: ADD AUTH
@router.patch("/items/{item_id}")
async def update_item_availability(
    item_id: str,
    payload: ItemAvailabilityPayload,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    updated_item = await db.update_item_availability(item_id, payload.is_available)

    if updated_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return {"success": True, "item": updated_item}
