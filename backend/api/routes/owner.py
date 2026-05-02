from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator
from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_db
from db.repository import MenuRepository
from models.schemas import MenuItemCreateRequest


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
@router.post("/categories/{category_id}/items")
async def create_menu_item(
    category_id: str,
    payload: MenuItemCreateRequest,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    created = await db.create_menu_item(
        category_id,
        payload.model_dump(exclude_none=True),
    )

    if created is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    return {"success": True, "item": created}


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

    # TODO: ADD AUTH — slug placeholder until authenticated tenant context (resolved to UUID for writes).
    restaurant_id = "yossis-hummus"
    tenant_restaurant_uuid = await db.get_restaurant_id_by_slug(restaurant_id)
    if tenant_restaurant_uuid is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    updated_item = await db.update_menu_item(item_id, patch, tenant_restaurant_uuid)

    if updated_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return {"success": True, "item": updated_item}


# TODO: ADD AUTH
@router.delete("/items/{item_id}")
async def delete_menu_item(
    item_id: str,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    # TODO: ADD AUTH — slug placeholder until authenticated tenant context (resolved to UUID for writes).
    restaurant_id = "yossis-hummus"
    tenant_restaurant_uuid = await db.get_restaurant_id_by_slug(restaurant_id)
    if tenant_restaurant_uuid is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    deleted = await db.delete_menu_item(item_id, tenant_restaurant_uuid)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )

    return {"success": True, "deleted_id": item_id}
