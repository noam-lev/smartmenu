from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator
from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_db
from db.repository import MenuRepository


router = APIRouter(tags=["owner"])


class MenuItemPatchPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    is_available: bool | None = None
    name: str | None = None
    description: str | None = None
    base_price: float | None = None
    translations: dict[str, Any] | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


@router.get("/ping")
async def ping_owner() -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}


# TODO: ADD AUTH
@router.patch("/items/{item_id}")
async def patch_menu_item(
    item_id: str,
    payload: MenuItemPatchPayload,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    patch = payload.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    updated_item = await db.update_menu_item(item_id, patch)

    if updated_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return {"success": True, "item": updated_item}
