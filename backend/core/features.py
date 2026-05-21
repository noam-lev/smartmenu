"""SaaS plan tiers and feature-flag definitions."""

from typing import Final

TIER_HIERARCHY: Final[dict[str, int]] = {
    "free": 0,
    "starter": 1,
    "pro": 2,
    "enterprise": 3,
}

DEFAULT_PLAN_TIER: Final[str] = "free"
DEFAULT_SUBSCRIPTION_STATUS: Final[str] = "none"

# Map feature names to the minimum tier required.
FEATURE_FLAGS: Final[dict[str, str]] = {
    "custom_domain": "pro",
    "advanced_analytics": "starter",
}


def tier_level(plan_tier: str) -> int:
    return TIER_HIERARCHY.get(plan_tier.strip().lower(), 0)


def required_tier_for_feature(feature_name: str) -> str:
    try:
        return FEATURE_FLAGS[feature_name]
    except KeyError as exc:
        raise KeyError(f"Unknown feature flag: {feature_name}") from exc


def plan_meets_feature(plan_tier: str, feature_name: str) -> bool:
    required = required_tier_for_feature(feature_name)
    return tier_level(plan_tier) >= tier_level(required)
