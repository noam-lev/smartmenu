"""Superadmin restaurant management endpoints (JWT Bearer auth)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from supabase import Client

from api.dependencies import get_db, get_supabase_client, verify_superadmin
from db.repository import MenuRepository
from models.schemas import ParsedCategory
from services.image_service import upload_image as cloudinary_upload

logger = logging.getLogger(__name__)

router = APIRouter(tags=["superadmin-restaurants"])

_VALID_PLAN_TIERS = frozenset({"free", "starter", "pro", "enterprise"})
_VALID_SUB_STATUSES = frozenset({"active", "inactive"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_restaurant_id(
    supabase_client: Client,
    slug: str,
) -> str:
    resp = (
        supabase_client.table("restaurants")
        .select("id")
        .eq("slug", slug.lower())
        .limit(1)
        .execute()
    )
    row = (resp.data or [None])[0]
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    rid = str(row.get("id") or "")
    if not rid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    return rid


def _get_user_email(supabase_client: Client, user_id: str) -> str | None:
    try:
        resp = supabase_client.auth.admin.get_user_by_id(user_id)
        user = getattr(resp, "user", None)
        return str(getattr(user, "email", "") or "") or None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RestaurantPatchBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    slug: str | None = None
    is_active: bool | None = None
    theme_color: str | None = None
    currency: str | None = None
    default_locale: str | None = None

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().lower().replace(" ", "-")
        return value

    @field_validator("name", "theme_color", "currency", "default_locale", mode="before")
    @classmethod
    def strip_strings(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip() or None
        return value


class AddMemberBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    email: str
    role: str = "owner"

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class UpdateMemberRoleBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: str

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class UpdateSubscriptionBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    plan_tier: str
    subscription_status: str = "active"

    @field_validator("plan_tier")
    @classmethod
    def validate_tier(cls, value: str) -> str:
        v = value.strip().lower()
        if v not in _VALID_PLAN_TIERS:
            raise ValueError(f"plan_tier must be one of: {', '.join(sorted(_VALID_PLAN_TIERS))}")
        return v

    @field_validator("subscription_status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        v = value.strip().lower()
        if v not in _VALID_SUB_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(_VALID_SUB_STATUSES))}")
        return v


# ---------------------------------------------------------------------------
# 1. List restaurants
# ---------------------------------------------------------------------------

@router.get("/restaurants")
async def list_restaurants(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    query = supabase_client.table("restaurants").select(
        "id,name,slug,is_active,created_at,settings",
        count="exact",
    )

    if search:
        term = search.strip()
        if term:
            query = query.or_(f"name.ilike.%{term}%,slug.ilike.%{term}%")

    if is_active is not None:
        query = query.eq("is_active", is_active)

    query = query.order("created_at", desc=True)
    query = query.range(offset, offset + limit - 1)
    resp = query.execute()

    restaurants = resp.data or []
    total = getattr(resp, "count", None) or len(restaurants)

    restaurant_ids = [str(r.get("id") or "") for r in restaurants if r.get("id")]

    member_counts: dict[str, int] = {}
    menu_counts: dict[str, dict[str, int]] = {}

    if restaurant_ids:
        members_resp = (
            supabase_client.table("restaurant_members")
            .select("restaurant_id")
            .in_("restaurant_id", restaurant_ids)
            .execute()
        )
        for row in (members_resp.data or []):
            rid = str(row.get("restaurant_id") or "")
            member_counts[rid] = member_counts.get(rid, 0) + 1

        menus_resp = (
            supabase_client.table("menus")
            .select("restaurant_id,is_active")
            .in_("restaurant_id", restaurant_ids)
            .execute()
        )
        for row in (menus_resp.data or []):
            rid = str(row.get("restaurant_id") or "")
            if rid not in menu_counts:
                menu_counts[rid] = {"total": 0, "active": 0}
            menu_counts[rid]["total"] += 1
            if row.get("is_active"):
                menu_counts[rid]["active"] += 1

        subs_resp = (
            supabase_client.table("subscriptions")
            .select("restaurant_id,plan_tier")
            .in_("restaurant_id", restaurant_ids)
            .eq("status", "active")
            .execute()
        )
        plan_map: dict[str, str] = {}
        for row in (subs_resp.data or []):
            rid = str(row.get("restaurant_id") or "")
            plan_map[rid] = str(row.get("plan_tier") or "free")
    else:
        plan_map = {}

    result = []
    for r in restaurants:
        rid = str(r.get("id") or "")
        mc = menu_counts.get(rid, {"total": 0, "active": 0})
        result.append({
            "id": rid,
            "name": str(r.get("name") or ""),
            "slug": str(r.get("slug") or ""),
            "is_active": bool(r.get("is_active")),
            "created_at": r.get("created_at"),
            "plan_tier": plan_map.get(rid, "free"),
            "member_count": member_counts.get(rid, 0),
            "menu_count": mc["total"],
            "active_menu_count": mc["active"],
        })

    return {"restaurants": result, "total": total}


# ---------------------------------------------------------------------------
# 1b. Check slug availability (MUST be before /restaurants/{slug})
# ---------------------------------------------------------------------------

@router.get("/restaurants/check-slug/{slug}")
async def check_slug_availability(
    slug: str,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    normalized = slug.strip().lower()
    resp = (
        supabase_client.table("restaurants")
        .select("id")
        .eq("slug", normalized)
        .limit(1)
        .execute()
    )
    return {"available": not bool(resp.data)}


# ---------------------------------------------------------------------------
# 2. Get restaurant detail
# ---------------------------------------------------------------------------

@router.get("/restaurants/{slug}")
async def get_restaurant_detail(
    slug: str,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    resp = (
        supabase_client.table("restaurants")
        .select("id,name,slug,is_active,created_at,settings")
        .eq("slug", slug.lower())
        .limit(1)
        .execute()
    )
    restaurant = (resp.data or [None])[0]
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found.")

    rid = str(restaurant.get("id") or "")
    settings = restaurant.get("settings") or {}

    members_resp = (
        supabase_client.table("restaurant_members")
        .select("user_id,role")
        .eq("restaurant_id", rid)
        .execute()
    )
    members = []
    for row in (members_resp.data or []):
        uid = str(row.get("user_id") or "")
        email = _get_user_email(supabase_client, uid)
        members.append({
            "user_id": uid,
            "role": str(row.get("role") or "member"),
            "email": email,
        })

    sub_resp = (
        supabase_client.table("subscriptions")
        .select("plan_tier,status")
        .eq("restaurant_id", rid)
        .limit(1)
        .execute()
    )
    sub_row = (sub_resp.data or [None])[0]
    subscription = {
        "plan_tier": str((sub_row or {}).get("plan_tier") or "free"),
        "status": str((sub_row or {}).get("status") or "none"),
    }

    menus_resp = (
        supabase_client.table("menus")
        .select("id,name,is_active")
        .eq("restaurant_id", rid)
        .order("name")
        .execute()
    )
    menus = []
    for m in (menus_resp.data or []):
        mid = str(m.get("id") or "")
        items_resp = (
            supabase_client.table("menu_items")
            .select("id", count="exact")
            .eq("menu_id", mid)
            .execute()
        )
        item_count = getattr(items_resp, "count", None) or len(items_resp.data or [])
        menus.append({
            "id": mid,
            "name": str(m.get("name") or ""),
            "is_active": bool(m.get("is_active")),
            "item_count": item_count,
        })

    return {
        "restaurant": {
            "id": rid,
            "name": str(restaurant.get("name") or ""),
            "slug": str(restaurant.get("slug") or ""),
            "is_active": bool(restaurant.get("is_active")),
            "created_at": restaurant.get("created_at"),
            "theme_color": str(settings.get("theme_color") or "#111827"),
            "currency": str(settings.get("currency") or "ILS"),
            "default_locale": settings.get("default_locale"),
            "translations": settings.get("translations"),
            "banner_image_url": settings.get("banner_image_url"),
            "social_links": settings.get("social_links"),
        },
        "members": members,
        "subscription": subscription,
        "menus": menus,
    }


# ---------------------------------------------------------------------------
# 3. Update restaurant
# ---------------------------------------------------------------------------

@router.patch("/restaurants/{slug}")
async def patch_restaurant(
    slug: str,
    body: RestaurantPatchBody,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    resp = (
        supabase_client.table("restaurants")
        .select("id,name,slug,settings")
        .eq("slug", slug.lower())
        .limit(1)
        .execute()
    )
    row = (resp.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found.")

    rid = str(row.get("id") or "")
    current_settings = row.get("settings") or {}
    db_updates: dict[str, Any] = {}

    if "name" in fields and fields["name"]:
        db_updates["name"] = fields["name"]
        locale = str(current_settings.get("default_locale") or "he")
        translations = dict(current_settings.get("translations") or {})
        locale_block = dict(translations.get(locale) or {})
        locale_block["name"] = fields["name"]
        translations[locale] = locale_block
        current_settings["translations"] = translations

    if "slug" in fields and fields["slug"]:
        new_slug = fields["slug"]
        if new_slug != slug.lower():
            dup_resp = (
                supabase_client.table("restaurants")
                .select("id")
                .eq("slug", new_slug)
                .limit(1)
                .execute()
            )
            if dup_resp.data:
                raise HTTPException(status_code=409, detail="Slug already in use.")
        db_updates["slug"] = new_slug

    if "is_active" in fields:
        db_updates["is_active"] = fields["is_active"]

    settings_keys = {"theme_color", "currency", "default_locale"}
    for key in settings_keys:
        if key in fields and fields[key] is not None:
            current_settings[key] = fields[key]

    db_updates["settings"] = current_settings

    update_resp = (
        supabase_client.table("restaurants")
        .update(db_updates)
        .eq("id", rid)
        .execute()
    )
    updated = (update_resp.data or [None])[0]
    if not updated:
        raise HTTPException(status_code=500, detail="Update failed.")

    new_slug = str(updated.get("slug") or slug)
    return {"success": True, "slug": new_slug}


# ---------------------------------------------------------------------------
# 4. Member CRUD
# ---------------------------------------------------------------------------

@router.get("/restaurants/{slug}/members")
async def list_members(
    slug: str,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    rid = _resolve_restaurant_id(supabase_client, slug)
    resp = (
        supabase_client.table("restaurant_members")
        .select("user_id,role")
        .eq("restaurant_id", rid)
        .execute()
    )
    members = []
    for row in (resp.data or []):
        uid = str(row.get("user_id") or "")
        email = _get_user_email(supabase_client, uid)
        members.append({
            "user_id": uid,
            "role": str(row.get("role") or "member"),
            "email": email,
        })
    return {"members": members}


@router.post("/restaurants/{slug}/members", status_code=201)
async def add_member(
    slug: str,
    body: AddMemberBody,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    rid = _resolve_restaurant_id(supabase_client, slug)

    try:
        users_resp = supabase_client.auth.admin.list_users()
        users = getattr(users_resp, "users", []) or []
        target_user = None
        for u in users:
            if str(getattr(u, "email", "") or "").lower() == body.email:
                target_user = u
                break
    except Exception as exc:
        logger.error("Failed to list users for email lookup: %s", exc)
        raise HTTPException(status_code=500, detail="Could not look up user.") from exc

    if not target_user:
        raise HTTPException(status_code=404, detail=f"No user found with email: {body.email}")

    target_uid = str(getattr(target_user, "id", "") or "")
    if not target_uid:
        raise HTTPException(status_code=404, detail="User has no ID.")

    dup_resp = (
        supabase_client.table("restaurant_members")
        .select("user_id")
        .eq("restaurant_id", rid)
        .eq("user_id", target_uid)
        .limit(1)
        .execute()
    )
    if dup_resp.data:
        raise HTTPException(status_code=409, detail="User is already a member of this restaurant.")

    supabase_client.table("restaurant_members").insert({
        "restaurant_id": rid,
        "user_id": target_uid,
        "role": body.role,
    }).execute()

    return {
        "success": True,
        "member": {
            "user_id": target_uid,
            "email": body.email,
            "role": body.role,
        },
    }


@router.patch("/restaurants/{slug}/members/{user_id}")
async def update_member_role(
    slug: str,
    user_id: str,
    body: UpdateMemberRoleBody,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    rid = _resolve_restaurant_id(supabase_client, slug)

    resp = (
        supabase_client.table("restaurant_members")
        .update({"role": body.role})
        .eq("restaurant_id", rid)
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Member not found.")

    return {"success": True, "role": body.role}


@router.delete("/restaurants/{slug}/members/{user_id}")
async def remove_member(
    slug: str,
    user_id: str,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    rid = _resolve_restaurant_id(supabase_client, slug)

    resp = (
        supabase_client.table("restaurant_members")
        .delete()
        .eq("restaurant_id", rid)
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Member not found.")

    return {"success": True}


# ---------------------------------------------------------------------------
# 5. Update subscription
# ---------------------------------------------------------------------------

@router.patch("/restaurants/{slug}/subscription")
async def update_subscription(
    slug: str,
    body: UpdateSubscriptionBody,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    rid = _resolve_restaurant_id(supabase_client, slug)

    existing = (
        supabase_client.table("subscriptions")
        .select("restaurant_id")
        .eq("restaurant_id", rid)
        .limit(1)
        .execute()
    )

    payload = {
        "restaurant_id": rid,
        "plan_tier": body.plan_tier,
        "status": body.subscription_status,
    }

    if existing.data:
        supabase_client.table("subscriptions").update({
            "plan_tier": body.plan_tier,
            "status": body.subscription_status,
        }).eq("restaurant_id", rid).execute()
    else:
        supabase_client.table("subscriptions").insert(payload).execute()

    return {
        "success": True,
        "subscription": {
            "plan_tier": body.plan_tier,
            "status": body.subscription_status,
        },
    }


# ---------------------------------------------------------------------------
# 6. Image upload (superadmin)
# ---------------------------------------------------------------------------

@router.post("/upload-image")
async def superadmin_upload_image(
    file: UploadFile = File(...),
    _user_id: str = Depends(verify_superadmin),
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
        folder="smartmenu/onboarding",
        content_type=file.content_type or "image/jpeg",
    )
    return {"public_url": public_url}


# ---------------------------------------------------------------------------
# 7. Onboard restaurant (full wizard payload)
# ---------------------------------------------------------------------------

class OnboardingItemImage(BaseModel):
    key: str
    url: str


class OnboardingPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    restaurant_name: str
    restaurant_slug: str
    categories: list[ParsedCategory] = Field(default_factory=list)
    currency: str = "ILS"
    default_locale: str = "he"
    banner_image_url: str | None = None
    item_images: dict[str, str] = Field(default_factory=dict)
    owner_email: str | None = None
    plan_tier: str = "free"

    @field_validator("restaurant_slug", mode="before")
    @classmethod
    def normalize_slug(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip().lower().replace(" ", "-")
        return value

    @field_validator("plan_tier")
    @classmethod
    def validate_tier(cls, value: str) -> str:
        v = value.strip().lower()
        if v not in _VALID_PLAN_TIERS:
            raise ValueError(f"plan_tier must be one of: {', '.join(sorted(_VALID_PLAN_TIERS))}")
        return v


@router.post("/restaurants/onboard")
async def onboard_restaurant(
    payload: OnboardingPayload,
    _user_id: str = Depends(verify_superadmin),
    supabase_client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    slug = payload.restaurant_slug
    name = payload.restaurant_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="restaurant_name is required.")
    if not slug:
        raise HTTPException(status_code=400, detail="restaurant_slug is required.")

    existing = (
        supabase_client.table("restaurants")
        .select("id")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail=f"Slug already exists: {slug}")

    settings: dict[str, Any] = {
        "default_locale": payload.default_locale,
        "currency": payload.currency,
        "theme_color": "#111827",
    }
    if payload.banner_image_url:
        settings["banner_image_url"] = payload.banner_image_url

    base_row: dict[str, Any] = {
        "name": name,
        "slug": slug,
        "is_active": True,
        "settings": settings,
    }
    try:
        rest_resp = supabase_client.table("restaurants").insert(
            {**base_row, "default_locale": payload.default_locale}
        ).execute()
    except Exception:
        rest_resp = supabase_client.table("restaurants").insert(base_row).execute()

    restaurant_row = (rest_resp.data or [None])[0]
    if not restaurant_row:
        raise HTTPException(status_code=500, detail="Failed to create restaurant.")
    restaurant_id = str(restaurant_row.get("id") or "")

    menu_resp = supabase_client.table("menus").insert({
        "restaurant_id": restaurant_id,
        "name": "Main Menu",
        "is_active": True,
        "translations": {},
    }).execute()
    menu_row = (menu_resp.data or [None])[0]
    if not menu_row:
        raise HTTPException(status_code=500, detail="Failed to create menu.")
    menu_id = str(menu_row.get("id") or "")

    inserted_categories = 0
    inserted_items = 0

    for cat_idx, cat in enumerate(payload.categories):
        cat_dict = cat.model_dump()
        name_he = str(cat_dict.get("name_he") or "").strip()
        name_en = str(cat_dict.get("name_en") or "").strip()
        if not name_he:
            continue

        cat_resp = supabase_client.table("categories").insert({
            "menu_id": menu_id,
            "name": name_he,
            "sort_order": cat_idx,
            "is_visible": True,
            "translations": {"en": {"name": name_en}},
        }).execute()
        cat_row = (cat_resp.data or [None])[0]
        if not cat_row:
            continue
        category_id = str(cat_row.get("id") or "")
        inserted_categories += 1

        items = cat_dict.get("items") or []
        for item_idx, item in enumerate(items):
            item_name_he = str(item.get("name_he") or "").strip()
            if not item_name_he:
                continue

            desc_he = str(item.get("description_he") or "").strip() if item.get("description_he") else ""
            desc_en = str(item.get("description_en") or "").strip() if item.get("description_en") else ""
            base_price = float(item.get("base_price") or 0)

            image_key = f"{cat_idx}-{item_idx}"
            image_url = payload.item_images.get(image_key)

            supabase_client.table("menu_items").insert({
                "restaurant_id": restaurant_id,
                "menu_id": menu_id,
                "category_id": category_id,
                "name": item_name_he,
                "description": desc_he,
                "base_price": base_price,
                "is_available": True,
                "is_visible": True,
                "sort_order": item_idx,
                "image_url": image_url,
                "metadata": {},
                "translations": {
                    "en": {
                        "name": str(item.get("name_en") or "").strip(),
                        "description": desc_en,
                    }
                },
            }).execute()
            inserted_items += 1

    owner_user_id: str | None = None
    if payload.owner_email:
        email = payload.owner_email.strip().lower()
        try:
            users_resp = supabase_client.auth.admin.list_users()
            users = getattr(users_resp, "users", []) or []
            for u in users:
                if str(getattr(u, "email", "") or "").lower() == email:
                    owner_user_id = str(getattr(u, "id", "") or "")
                    break
        except Exception as exc:
            logger.warning("Failed to look up user by email: %s", exc)

        if not owner_user_id:
            try:
                invite_resp = supabase_client.auth.admin.invite_user_by_email(email)
                invited_user = getattr(invite_resp, "user", None)
                owner_user_id = str(getattr(invited_user, "id", "") or "") if invited_user else None
            except Exception as exc:
                logger.warning("Failed to invite user %s: %s", email, exc)

        if owner_user_id:
            supabase_client.table("restaurant_members").insert({
                "restaurant_id": restaurant_id,
                "user_id": owner_user_id,
                "role": "owner",
            }).execute()

    supabase_client.table("subscriptions").insert({
        "restaurant_id": restaurant_id,
        "plan_tier": payload.plan_tier,
        "status": "active",
    }).execute()

    return {
        "success": True,
        "restaurant_slug": slug,
        "restaurant_name": name,
        "categories_imported": inserted_categories,
        "items_imported": inserted_items,
        "owner_linked": bool(owner_user_id),
    }
