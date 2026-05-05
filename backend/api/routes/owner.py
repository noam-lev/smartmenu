from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_db
from db.repository import MenuRepository
from models.schemas import (
    CategoryCreateRequest,
    CategoryUpdateRequest,
    ItemReorderRequest,
    MenuItemCreateRequest,
)


router = APIRouter(tags=["owner"])

_ALLOWED_UPSELL_LOCALES = frozenset({"en", "he"})


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


class UpsellRulePatchPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str
    locale: str

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("locale")
    @classmethod
    def normalize_locale(cls, value: str) -> str:
        low = value.strip().lower()
        if low not in _ALLOWED_UPSELL_LOCALES:
            raise ValueError("locale must be 'en' or 'he'.")
        return low


class UpsellRuleCreatePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    offer_item_id: str
    discount_price: float = Field(..., ge=0)
    custom_message: str | None = None

    @field_validator("custom_message", mode="before")
    @classmethod
    def strip_optional_message(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip()
        return value


async def _resolve_restaurant_uuid(
    restaurant_slug: str,
    db: MenuRepository,
) -> str:
    tenant_restaurant_uuid = await db.get_restaurant_id_by_slug(restaurant_slug)
    if tenant_restaurant_uuid is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return tenant_restaurant_uuid


@router.get("/ping")
async def ping_owner() -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}


# TODO: ADD AUTH
@router.post("/{restaurant_slug}/categories")
async def create_category(
    restaurant_slug: str,
    payload: CategoryCreateRequest,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    created = await db.create_category(
        tenant_restaurant_uuid,
        payload.model_dump(),
    )
    if created is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create category.",
        )

    return {"success": True, "category": created}


# TODO: ADD AUTH
@router.patch("/{restaurant_slug}/categories/{category_id}")
async def patch_category(
    restaurant_slug: str,
    category_id: str,
    payload: CategoryUpdateRequest,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    updated = await db.update_category(
        category_id,
        tenant_restaurant_uuid,
        payload.locale,
        payload.name,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    return {"success": True, "category": updated}


# TODO: ADD AUTH
@router.delete("/{restaurant_slug}/categories/{category_id}")
async def delete_category_route(
    restaurant_slug: str,
    category_id: str,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    deleted = await db.delete_category(category_id, tenant_restaurant_uuid)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    return {"success": True, "deleted_id": category_id}


# TODO: ADD AUTH
@router.patch("/{restaurant_slug}/categories/{category_id}/items/reorder")
async def reorder_category_items(
    restaurant_slug: str,
    category_id: str,
    payload: ItemReorderRequest,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    body = [row.model_dump() for row in payload.items]
    ok = await db.bulk_update_item_orders(category_id, tenant_restaurant_uuid, body)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not reorder items. Check category and item ids.",
        )

    return {"success": True}


# TODO: ADD AUTH
@router.post("/{restaurant_slug}/categories/{category_id}/items")
async def create_menu_item(
    restaurant_slug: str,
    category_id: str,
    payload: MenuItemCreateRequest,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    _ = await _resolve_restaurant_uuid(restaurant_slug, db)
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
@router.patch("/{restaurant_slug}/items/{item_id}")
async def patch_menu_item(
    restaurant_slug: str,
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

    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)
    updated_item = await db.update_menu_item(item_id, patch, tenant_restaurant_uuid)

    if updated_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return {"success": True, "item": updated_item}


# TODO: ADD AUTH
@router.delete("/{restaurant_slug}/items/{item_id}")
async def delete_menu_item(
    restaurant_slug: str,
    item_id: str,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)
    deleted = await db.delete_menu_item(item_id, tenant_restaurant_uuid)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )

    return {"success": True, "deleted_id": item_id}


# TODO: ADD AUTH
@router.patch("/{restaurant_slug}/upsells/{rule_id}")
async def patch_upsell_rule(
    restaurant_slug: str,
    rule_id: str,
    payload: UpsellRulePatchPayload,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    updated = await db.patch_upsell_rule_message(
        rule_id,
        tenant_restaurant_uuid,
        payload.locale,
        payload.message,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upsell rule not found.",
        )

    return {"success": True, "id": rule_id}


# TODO: ADD AUTH
@router.post("/{restaurant_slug}/items/{item_id}/upsells")
async def create_item_upsell_rule(
    restaurant_slug: str,
    item_id: str,
    payload: UpsellRuleCreatePayload,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    body = payload.model_dump(exclude_none=True)
    new_id = await db.create_upsell_rule(item_id, tenant_restaurant_uuid, body)
    if new_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create upsell rule. Check trigger and offer items.",
        )

    return {"success": True, "id": new_id}


# TODO: ADD AUTH
@router.delete("/{restaurant_slug}/upsells/{rule_id}")
async def delete_upsell_rule_route(
    restaurant_slug: str,
    rule_id: str,
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    tenant_restaurant_uuid = await _resolve_restaurant_uuid(restaurant_slug, db)

    deleted = await db.delete_upsell_rule(rule_id, tenant_restaurant_uuid)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upsell rule not found.",
        )

    return {"success": True, "deleted_id": rule_id}
