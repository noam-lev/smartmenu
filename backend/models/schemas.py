from typing import Any

from pydantic import BaseModel, Field, field_validator


class RestaurantResponse(BaseModel):
    name: str
    slug: str
    theme_color: str
    currency: str
    banner_image_url: str | None = None
    default_locale: str | None = None
    translations: dict[str, Any] | None = None
    settings: dict[str, Any] | None = None


class VariantResponse(BaseModel):
    id: str
    name: str
    price: float


class OfferItemSnapshotResponse(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    price: float
    translations: dict[str, Any] | None = None


class UpsellRuleResponse(BaseModel):
    id: str
    offer_item_snapshot: OfferItemSnapshotResponse
    custom_message: str
    discount_price: float | None = None
    translations: dict[str, Any] | None = None


class MenuItemResponse(BaseModel):
    id: str
    name: str
    description: str
    base_price: float
    is_available: bool
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] | None = None
    translations: dict[str, Any] | None = None
    variants: list[VariantResponse] = Field(default_factory=list)
    upsell_rules: list[UpsellRuleResponse] = Field(default_factory=list)


class CategoryResponse(BaseModel):
    id: str
    name: str
    sort_order: int
    translations: dict[str, Any] | None = None
    items: list[MenuItemResponse] = Field(default_factory=list)


class MenuResponse(BaseModel):
    id: str
    name: str
    last_updated: str
    translations: dict[str, Any] | None = None
    categories: list[CategoryResponse] = Field(default_factory=list)


class MenuPayload(BaseModel):
    restaurant: RestaurantResponse
    menu: MenuResponse


class CategoryCreateRequest(BaseModel):
    """Create a category on the restaurant's active menu."""

    name: str
    locale: str = Field(..., min_length=2, max_length=2)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be empty.")
        return stripped

    @field_validator("locale")
    @classmethod
    def normalize_locale(cls, value: str) -> str:
        low = value.strip().lower()
        if low not in ("en", "he"):
            raise ValueError("locale must be 'en' or 'he'.")
        return low


class CategoryUpdateRequest(BaseModel):
    """Patch category display name for one UI locale (merges into translations JSON)."""

    name: str
    locale: str = Field(..., min_length=2, max_length=2)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be empty.")
        return stripped

    @field_validator("locale")
    @classmethod
    def normalize_locale(cls, value: str) -> str:
        low = value.strip().lower()
        if low not in ("en", "he"):
            raise ValueError("locale must be 'en' or 'he'.")
        return low


class MenuItemCreateRequest(BaseModel):
    """Validated body for creating a menu item under a category."""

    name: str
    base_price: float = Field(..., ge=0)
    description: str | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be empty.")
        return stripped

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip()
        return value
