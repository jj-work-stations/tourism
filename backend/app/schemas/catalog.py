from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import ORMModel


class DestinationOut(ORMModel):
    id: UUID
    slug: str
    name: str
    name_local: str
    country: str
    country_code: str = "IR"
    region: str | None = None
    description: str = ""
    short_description: str = ""
    image_url: str = ""
    gallery: list[str] = Field(default_factory=list)
    latitude: float
    longitude: float
    timezone: str = "Asia/Tehran"
    is_featured: bool = False
    popularity: int = 0
    tags: list[str] = Field(default_factory=list)
    best_season: str | None = None
    avg_daily_budget: int = 0
    attraction_count: int = 0
    accommodation_count: int = 0
    restaurant_count: int = 0
    experience_count: int = 0
    starting_price: int | None = None


class AttractionOut(ORMModel):
    id: UUID
    slug: str
    name: str
    destination_id: UUID
    destination_name: str | None = None
    category: str
    description: str = ""
    image_url: str = ""
    gallery: list[str] = Field(default_factory=list)
    latitude: float
    longitude: float
    address: str = ""
    opening_hours: dict = Field(default_factory=dict)
    ticket_price: int = 0
    rating: float = 4.5
    review_count: int = 0
    suggested_visit_minutes: int = 90
    is_featured: bool = False


class RestaurantOut(ORMModel):
    id: UUID
    slug: str
    name: str
    destination_id: UUID
    destination_name: str | None = None
    description: str = ""
    image_url: str = ""
    cuisine: str = "ایرانی"
    price_range: int = 2
    average_price: int = 0
    rating: float = 4.5
    review_count: int = 0
    address: str = ""
    latitude: float
    longitude: float
    opening_hours: dict = Field(default_factory=dict)
    menu: list[dict] = Field(default_factory=list)
    signature_dishes: list[str] = Field(default_factory=list)
    reservation_enabled: bool = True
    is_featured: bool = False


class ExperienceOut(ORMModel):
    id: UUID
    slug: str
    name: str
    destination_id: UUID
    destination_name: str | None = None
    category: str
    description: str = ""
    image_url: str = ""
    gallery: list[str] = Field(default_factory=list)
    duration_minutes: int = 180
    price: int
    currency: str = "IRT"
    rating: float = 4.5
    review_count: int = 0
    max_participants: int = 12
    meeting_point: str = ""
    latitude: float
    longitude: float
    includes: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    guide_name: str | None = None
    is_featured: bool = False


class CampaignOut(ORMModel):
    id: UUID
    title: str
    subtitle: str = ""
    image_url: str = ""
    cta_label: str = "مشاهده"
    cta_url: str = "/"
    badge: str = ""
    placement: str = "home"
    sort_order: int = 0


class WeatherOut(ORMModel):
    destination_id: UUID
    observed_at: datetime
    temperature_c: float
    feels_like_c: float
    condition: str
    humidity: int
    wind_kph: float
    forecast: list[dict] = Field(default_factory=list)


class SuggestionOut(ORMModel):
    type: str
    id: UUID
    slug: str
    title: str
    subtitle: str = ""
    image_url: str = ""


class HomeResponse(ORMModel):
    featured_destinations: list[DestinationOut]
    popular_destinations: list[DestinationOut]
    campaigns: list[CampaignOut]
    featured_attractions: list[AttractionOut]
    featured_experiences: list[ExperienceOut]
    deals: list[dict] = Field(default_factory=list)
    stats: dict = Field(default_factory=dict)
