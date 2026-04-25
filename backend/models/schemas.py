from pydantic import BaseModel, Field


class RestaurantResponse(BaseModel):
    name: str
    slug: str
    theme_color: str
    currency: str


class VariantResponse(BaseModel):
    id: str
    name: str
    price: float


class OfferItemSnapshotResponse(BaseModel):
    id: str
    name: str
    image_url: str
    price: float


class UpsellRuleResponse(BaseModel):
    offer_item_snapshot: OfferItemSnapshotResponse
    custom_message: str
    discount_price: float | None = None


class MenuItemResponse(BaseModel):
    id: str
    name: str
    description: str
    base_price: float
    is_available: bool
    image_url: str
    tags: list[str] = Field(default_factory=list)
    variants: list[VariantResponse] = Field(default_factory=list)
    upsell_rules: list[UpsellRuleResponse] = Field(default_factory=list)


class CategoryResponse(BaseModel):
    id: str
    name: str
    sort_order: int
    items: list[MenuItemResponse] = Field(default_factory=list)


class MenuResponse(BaseModel):
    id: str
    name: str
    last_updated: str
    categories: list[CategoryResponse] = Field(default_factory=list)


class MenuPayload(BaseModel):
    restaurant: RestaurantResponse
    menu: MenuResponse
