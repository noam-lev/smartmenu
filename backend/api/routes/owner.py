from typing import Any
from pathlib import Path
from urllib.parse import unquote, urlparse
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from api.dependencies import (
    RestaurantAccessContext,
    get_current_user,
    get_db,
    get_supabase_client,
    verify_restaurant_access,
)
from db.repository import MenuRepository
from supabase import Client
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
    image_url: str | None = None
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


class DeleteImagePayload(BaseModel):
    file_url: str

    @field_validator("file_url")
    @classmethod
    def normalize_file_url(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("file_url is required.")
        return trimmed


class RestaurantPatchPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    banner_url: str | None = None

    @field_validator("banner_url", mode="before")
    @classmethod
    def normalize_banner_url(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class CategoryReorderPayload(BaseModel):
    category_ids: list[str] = Field(default_factory=list, min_length=1)

    @field_validator("category_ids")
    @classmethod
    def validate_category_ids(cls, value: list[str]) -> list[str]:
        normalized = [str(item or "").strip() for item in value]
        if any(not item for item in normalized):
            raise ValueError("category_ids must contain non-empty ids.")
        if len(normalized) != len(set(normalized)):
            raise ValueError("category_ids must not contain duplicates.")
        return normalized


def _extract_storage_path_from_public_url(file_url: str) -> str:
    parsed = urlparse(file_url)
    path = unquote(parsed.path or "")
    marker = "/storage/v1/object/public/menu-images/"
    marker_index = path.find(marker)
    if marker_index == -1:
        raise ValueError("Could not parse storage path from file_url.")
    relative_path = path[marker_index + len(marker) :].strip("/")
    if not relative_path:
        raise ValueError("Invalid storage path.")
    return relative_path


@router.get("/ping")
async def ping_owner(_user_id: str = Depends(get_current_user)) -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}


# TODO: ADD AUTH
@router.post("/{restaurant_slug}/categories")
async def create_category(
    restaurant_slug: str,
    payload: CategoryCreateRequest,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    created = await db.create_category(
        access["restaurant_id"],
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
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    updated = await db.update_category(
        category_id,
        access["restaurant_id"],
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
@router.put("/{restaurant_slug}/categories/reorder")
async def reorder_categories(
    restaurant_slug: str,
    payload: CategoryReorderPayload,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    ok = await db.update_categories_order(
        access["restaurant_id"],
        payload.category_ids,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not reorder categories. Check category ids.",
        )
    return {"success": True}


# TODO: ADD AUTH
@router.delete("/{restaurant_slug}/categories/{category_id}")
async def delete_category_route(
    restaurant_slug: str,
    category_id: str,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    deleted = await db.delete_category(category_id, access["restaurant_id"])
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
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    body = [row.model_dump() for row in payload.items]
    ok = await db.bulk_update_item_orders(category_id, access["restaurant_id"], body)
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
    _access: RestaurantAccessContext = Depends(verify_restaurant_access),
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
@router.patch("/{restaurant_slug}/items/{item_id}")
async def patch_menu_item(
    restaurant_slug: str,
    item_id: str,
    payload: MenuItemPatchPayload,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    patch = payload.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    updated_item = await db.update_menu_item(item_id, patch, access["restaurant_id"])

    if updated_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found.",
        )
    return {"success": True, "item": updated_item}


# TODO: ADD AUTH
@router.patch("/{restaurant_slug}/restaurant")
async def patch_restaurant(
    restaurant_slug: str,
    payload: RestaurantPatchPayload,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    updated = await db.update_restaurant_banner_url(
        access["restaurant_id"],
        payload.banner_url,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return {"success": True, "restaurant": updated}


# TODO: ADD AUTH
@router.post("/{restaurant_slug}/upload-image")
async def upload_image(
    restaurant_slug: str,
    file: UploadFile = File(...),
    _access: RestaurantAccessContext = Depends(verify_restaurant_access),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, str]:
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be an image.",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    object_path = f"{restaurant_slug}/{uuid.uuid4()}{ext}"
    bucket = supabase_client.storage.from_("menu-images")
    bucket.upload(
        path=object_path,
        file=raw_bytes,
        file_options={"content-type": file.content_type or "image/jpeg", "upsert": "false"},
    )
    public_url = bucket.get_public_url(object_path)
    return {"public_url": public_url}


# TODO: ADD AUTH
@router.post("/{restaurant_slug}/delete-image")
async def delete_image(
    restaurant_slug: str,
    payload: DeleteImagePayload,
    _access: RestaurantAccessContext = Depends(verify_restaurant_access),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, object]:
    try:
        object_path = _extract_storage_path_from_public_url(payload.file_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if not object_path.startswith(f"{restaurant_slug}/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete images outside this restaurant scope.",
        )

    supabase_client.storage.from_("menu-images").remove([object_path])
    return {"success": True, "deleted_path": object_path}


# TODO: ADD AUTH
@router.delete("/{restaurant_slug}/items/{item_id}")
async def delete_menu_item(
    restaurant_slug: str,
    item_id: str,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    deleted = await db.delete_menu_item(item_id, access["restaurant_id"])

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
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    updated = await db.patch_upsell_rule_message(
        rule_id,
        access["restaurant_id"],
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
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    body = payload.model_dump(exclude_none=True)
    new_id = await db.create_upsell_rule(item_id, access["restaurant_id"], body)
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
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    deleted = await db.delete_upsell_rule(rule_id, access["restaurant_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upsell rule not found.",
        )

    return {"success": True, "deleted_id": rule_id}
