from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class RestaurantResponse(BaseModel):
    name: str
    slug: str
    theme_color: str
    currency: str
    banner_url: str | None = None
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


class ModifierOptionResponse(BaseModel):
    id: str
    name: str
    price_delta: float = 0
    is_default: bool = False
    is_available: bool = True
    sort_order: int = 0
    translations: dict[str, Any] | None = None


class ModifierGroupResponse(BaseModel):
    id: str
    name: str
    selection_mode: str = "single"
    min_select: int = 0
    max_select: int = 1
    sort_order: int = 0
    options: list[ModifierOptionResponse] = Field(default_factory=list)
    translations: dict[str, Any] | None = None


class ModifierGroupLibraryResponse(ModifierGroupResponse):
    attached_item_count: int = 0


class MenuItemResponse(BaseModel):
    id: str
    name: str
    description: str
    base_price: float
    is_available: bool
    sort_order: int = 0
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] | None = None
    translations: dict[str, Any] | None = None
    variants: list[VariantResponse] = Field(default_factory=list)
    modifier_groups: list[ModifierGroupResponse] = Field(default_factory=list)
    upsell_rules: list[UpsellRuleResponse] = Field(default_factory=list)


class ItemReorderItem(BaseModel):
    item_id: str
    sort_order: int = Field(..., ge=0)


class ItemReorderRequest(BaseModel):
    items: list[ItemReorderItem] = Field(..., min_length=1)


class CategoryResponse(BaseModel):
    id: str
    name: str
    sort_order: int
    header_color: str | None = None
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
    header_color: str | None = None

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

    @field_validator("header_color")
    @classmethod
    def validate_header_color(cls, value: str | None) -> str | None:
        from core.colors import normalize_hex_color

        if value is None:
            return None
        normalized = normalize_hex_color(value)
        if normalized is None:
            raise ValueError("header_color must be a valid #RGB or #RRGGBB hex value.")
        return normalized


class CategoryPatchRequest(BaseModel):
    """Patch category display name (one locale) and/or header color."""

    name: str | None = None
    locale: str | None = Field(default=None, min_length=2, max_length=2)
    header_color: str | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be empty.")
        return stripped

    @field_validator("locale")
    @classmethod
    def normalize_locale(cls, value: str | None) -> str | None:
        if value is None:
            return None
        low = value.strip().lower()
        if low not in ("en", "he"):
            raise ValueError("locale must be 'en' or 'he'.")
        return low

    @field_validator("header_color")
    @classmethod
    def validate_header_color(cls, value: str | None) -> str | None:
        from core.colors import normalize_hex_color

        if value is None:
            return None
        normalized = normalize_hex_color(value)
        if normalized is None:
            raise ValueError("header_color must be a valid #RGB or #RRGGBB hex value.")
        return normalized

    @model_validator(mode="after")
    def validate_patch_fields(self) -> "CategoryPatchRequest":
        if self.name is not None and self.locale is None:
            raise ValueError("locale is required when name is provided.")
        return self


class LocalizedNameUpdateRequest(BaseModel):
    """Patch a display name for one UI locale (merges into translations JSON)."""

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


MenuUpdateRequest = LocalizedNameUpdateRequest


class MenuItemCreateRequest(BaseModel):
    """Validated body for creating a menu item under a category."""

    name: str
    base_price: float = Field(..., ge=0)
    description: str | None = None
    image_url: str | None = None
    dietary_icons: list[str] = Field(default_factory=list)
    translations: dict[str, Any] | None = None

    @field_validator("dietary_icons")
    @classmethod
    def validate_dietary_icons(cls, value: list[str]) -> list[str]:
        from core.dietary_icons import normalize_dietary_icons

        return normalize_dietary_icons(value)

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

    @field_validator("image_url", mode="before")
    @classmethod
    def normalize_image_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class ParsedItem(BaseModel):
    name_he: str
    name_en: str
    description_he: str | None = None
    description_en: str | None = None
    base_price: float


class ParsedCategory(BaseModel):
    name_he: str
    name_en: str
    items: list[ParsedItem] = Field(default_factory=list)


class ParsedMenu(BaseModel):
    categories: list[ParsedCategory] = Field(default_factory=list)


class MenuItemTranslationResult(BaseModel):
    name: str
    description: str = ""


class RestaurantImportPayload(BaseModel):
    restaurant_name: str
    restaurant_slug: str
    categories: list[ParsedCategory] = Field(default_factory=list)
