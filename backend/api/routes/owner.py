from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.dietary_icons import normalize_dietary_icons
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from api.dependencies import (
    RestaurantAccessContext,
    get_current_user,
    get_db,
    get_supabase_client,
    verify_restaurant_access,
)
from db.repository import MenuRepository
from supabase import Client
from core.social_links import SOCIAL_PLATFORMS, SocialLinksValidationError
from core.exceptions import MenuNotFoundError
from models.schemas import (
    CategoryCreateRequest,
    CategoryUpdateRequest,
    ItemReorderRequest,
    MenuItemCreateRequest,
    MenuPayload,
)
from services.image_service import upload_image as cloudinary_upload, delete_image as cloudinary_delete


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
    dietary_icons: list[str] | None = None

    @field_validator("dietary_icons")
    @classmethod
    def validate_dietary_icons(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return normalize_dietary_icons(value)

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

    model_config = ConfigDict(extra="ignore")


_ALLOWED_RESTAURANT_LOCALES = frozenset({"en", "he"})


class RestaurantPatchPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    banner_url: str | None = None
    qr_logo_url: str | None = None
    social_links: dict[str, str | None] | None = None
    default_locale: str | None = None

    @field_validator("default_locale")
    @classmethod
    def validate_default_locale(cls, value: str | None) -> str | None:
        if value is None:
            return None
        low = value.strip().lower()
        if low not in _ALLOWED_RESTAURANT_LOCALES:
            raise ValueError("default_locale must be 'en' or 'he'.")
        return low

    @field_validator("banner_url", "qr_logo_url", mode="before")
    @classmethod
    def normalize_nullable_url(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @field_validator("social_links")
    @classmethod
    def validate_social_link_keys(
        cls,
        value: dict[str, str | None] | None,
    ) -> dict[str, str | None] | None:
        if value is None:
            return None
        for key in value:
            platform = str(key or "").strip().lower()
            if platform not in SOCIAL_PLATFORMS:
                raise ValueError(f"Unknown social platform: {platform}")
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



@router.get("/ping")
async def ping_owner(_user_id: str = Depends(get_current_user)) -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}


@router.get("/{restaurant_slug}/menu", response_model=MenuPayload)
async def get_owner_menu(
    restaurant_slug: str,
    _access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> MenuPayload:
    """Full multilingual menu tree for owner admin / editors."""
    menu = await db.get_fat_menu_by_slug(restaurant_slug)
    if menu is None:
        code = await db.diagnose_menu_not_found_reason(restaurant_slug)
        raise MenuNotFoundError(code=code)
    return menu


@router.get("/me/restaurants")
async def list_my_restaurants(
    current_slug: str | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    supabase_client: Client = Depends(get_supabase_client),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    profile_resp = (
        supabase_client.table("profiles")
        .select("role")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile_row = (profile_resp.data or [None])[0]
    user_role = str((profile_row or {}).get("role") or "").strip().lower()
    is_superadmin = user_role == "superadmin"

    restaurants = await db.list_restaurants_for_user(
        user_id,
        is_superadmin,
        current_slug=current_slug,
    )
    return {"restaurants": restaurants}


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


@router.patch("/{restaurant_slug}/restaurant")
async def patch_restaurant(
    restaurant_slug: str,
    payload: RestaurantPatchPayload,
    access: RestaurantAccessContext = Depends(verify_restaurant_access),
    db: MenuRepository = Depends(get_db),
) -> dict[str, object]:
    patch_fields = payload.model_dump(exclude_unset=True)
    if not patch_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    banner_url = patch_fields.get("banner_url", ...)
    qr_logo_url = patch_fields.get("qr_logo_url", ...)
    social_links = patch_fields.get("social_links", ...)
    default_locale = patch_fields.get("default_locale", ...)
    try:
        updated = await db.patch_restaurant_settings(
            access["restaurant_id"],
            banner_url=banner_url,
            qr_logo_url=qr_logo_url,
            social_links=social_links,
            default_locale=default_locale,
        )
    except SocialLinksValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return {"success": True, "restaurant": updated}


@router.post("/{restaurant_slug}/upload-image")
async def upload_image(
    restaurant_slug: str,
    file: UploadFile = File(...),
    _access: RestaurantAccessContext = Depends(verify_restaurant_access),
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

    public_url = cloudinary_upload(
        raw_bytes,
        folder=f"smartmenu/{restaurant_slug}",
        content_type=file.content_type or "image/jpeg",
    )
    return {"public_url": public_url}


@router.post("/{restaurant_slug}/delete-image")
async def delete_image(
    restaurant_slug: str,
    payload: DeleteImagePayload,
    _access: RestaurantAccessContext = Depends(verify_restaurant_access),
) -> dict[str, object]:
    if f"smartmenu/{restaurant_slug}/" not in payload.file_url:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete images outside this restaurant scope.",
        )

    deleted = cloudinary_delete(payload.file_url)
    return {"success": deleted}


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
