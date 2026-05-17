from functools import lru_cache
import logging
from typing import TypedDict

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

from core.config import get_settings
from core.features import (
    DEFAULT_PLAN_TIER,
    DEFAULT_SUBSCRIPTION_STATUS,
    plan_meets_feature,
)
from db.repository import MenuRepository
from db.supabase_dal import SupabaseDAL

logger = logging.getLogger(__name__)


class RestaurantAccessContext(TypedDict):
    restaurant_id: str
    restaurant_slug: str
    user_id: str
    role: str | None
    plan_tier: str
    subscription_status: str


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()

    if not settings.is_supabase_configured:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
        )

    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_db() -> MenuRepository:
    return SupabaseDAL(client=get_supabase_client())


def _fetch_active_subscription(
    supabase_client: Client,
    restaurant_id: str,
) -> tuple[str, str]:
    """Return (plan_tier, subscription_status) for the restaurant's active subscription."""
    response = (
        supabase_client.table("subscriptions")
        .select("plan_tier, status")
        .eq("restaurant_id", restaurant_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    row = (response.data or [None])[0]
    if not row:
        return DEFAULT_PLAN_TIER, DEFAULT_SUBSCRIPTION_STATUS

    plan_tier = str(row.get("plan_tier") or DEFAULT_PLAN_TIER).strip().lower()
    subscription_status = str(row.get("status") or DEFAULT_SUBSCRIPTION_STATUS).strip().lower()
    return plan_tier, subscription_status


def _build_access_context(
    *,
    restaurant_id: str,
    restaurant_slug: str,
    user_id: str,
    role: str | None,
    plan_tier: str,
    subscription_status: str,
) -> RestaurantAccessContext:
    return RestaurantAccessContext(
        restaurant_id=restaurant_id,
        restaurant_slug=restaurant_slug,
        user_id=user_id,
        role=role,
        plan_tier=plan_tier,
        subscription_status=subscription_status,
    )


async def get_current_user(
    authorization: str | None = Header(default=None),
    supabase_client: Client = Depends(get_supabase_client),
) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        auth_response = supabase_client.auth.get_user(token.strip())
    except Exception as exc:
        logger.warning("Rejected request with invalid bearer token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = getattr(auth_response, "user", None)
    user_id = str(getattr(user, "id", "") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


async def verify_restaurant_access(
    restaurant_slug: str,
    user_id: str = Depends(get_current_user),
    supabase_client: Client = Depends(get_supabase_client),
) -> RestaurantAccessContext:
    restaurant_resp = (
        supabase_client.table("restaurants")
        .select("id")
        .eq("slug", restaurant_slug.lower())
        .limit(1)
        .execute()
    )
    restaurant_row = (restaurant_resp.data or [None])[0]
    if not restaurant_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )
    restaurant_id = str(restaurant_row.get("id") or "")
    if not restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    plan_tier, subscription_status = _fetch_active_subscription(
        supabase_client,
        restaurant_id,
    )

    profile_resp = (
        supabase_client.table("profiles")
        .select("role")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile_row = (profile_resp.data or [None])[0]
    user_role = str((profile_row or {}).get("role") or "").strip().lower()
    if user_role == "superadmin":
        return _build_access_context(
            restaurant_id=restaurant_id,
            restaurant_slug=restaurant_slug,
            user_id=user_id,
            role="superadmin",
            plan_tier=plan_tier,
            subscription_status=subscription_status,
        )

    membership_resp = (
        supabase_client.table("restaurant_members")
        .select("id,role")
        .eq("restaurant_id", restaurant_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    membership = (membership_resp.data or [None])[0]
    if not membership:
        logger.warning(
            "Access denied: user %s is not a member of restaurant slug=%s id=%s",
            user_id,
            restaurant_slug,
            restaurant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this restaurant.",
        )

    return _build_access_context(
        restaurant_id=restaurant_id,
        restaurant_slug=restaurant_slug,
        user_id=user_id,
        role=membership.get("role"),
        plan_tier=plan_tier,
        subscription_status=subscription_status,
    )


class FeatureAccessChecker:
    """FastAPI dependency: Depends(verify_feature_access(\"feature_name\"))."""

    def __init__(self, feature_name: str) -> None:
        self.feature_name = feature_name

    async def __call__(
        self,
        access: RestaurantAccessContext = Depends(verify_restaurant_access),
    ) -> RestaurantAccessContext:
        role = str(access.get("role") or "").strip().lower()
        if role == "superadmin":
            return access

        plan_tier = str(access.get("plan_tier") or DEFAULT_PLAN_TIER)
        try:
            allowed = plan_meets_feature(plan_tier, self.feature_name)
        except KeyError:
            logger.error("Misconfigured feature flag: %s", self.feature_name)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Feature configuration error.",
            ) from None

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Upgrade your plan to access: {self.feature_name}",
            )

        return access


def verify_feature_access(feature_name: str) -> FeatureAccessChecker:
    return FeatureAccessChecker(feature_name)
