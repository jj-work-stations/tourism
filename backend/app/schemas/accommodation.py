from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.db.models.enums import AccommodationType
from app.schemas.common import ORMModel


class RoomOut(ORMModel):
    id: UUID
    name: str
    room_type: str
    description: str = ""
    capacity: int = 2
    beds: str = ""
    size_sqm: int = 25
    price_per_night: int
    total_rooms: int = 1
    amenities: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    breakfast_included: bool = True
    refundable: bool = True
    rooms_left: int | None = None


class AccommodationSearchRequest(ORMModel):
    destination_id: UUID
    check_in: date
    check_out: date
    guests: int = Field(default=2, ge=1, le=20)
    rooms: int = Field(default=1, ge=1, le=10)
    types: list[AccommodationType] | None = None
    min_price: int | None = Field(default=None, ge=0)
    max_price: int | None = Field(default=None, ge=0)
    min_rating: float | None = Field(default=None, ge=0, le=5)
    amenities: list[str] | None = None
    free_cancellation: bool = False
    breakfast: bool = False
    sort: Literal["recommended", "cheapest", "rating", "distance"] = "recommended"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=50)

    @model_validator(mode="after")
    def validate_dates(self) -> AccommodationSearchRequest:
        if self.check_out <= self.check_in:
            raise ValueError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
        return self


class AccommodationCard(ORMModel):
    id: UUID
    slug: str
    name: str
    type: str
    destination_id: UUID
    destination_name: str | None = None
    short_description: str = ""
    address: str = ""
    latitude: float
    longitude: float
    images: list[str] = Field(default_factory=list)
    star_rating: int = 4
    guest_rating: float = 4.5
    review_count: int = 0
    amenities: list[str] = Field(default_factory=list)
    base_price: int
    min_price: int | None = None
    total_price: int | None = None
    nights: int = 0
    rooms_available: int | None = None
    distance_to_center_km: float = 0
    breakfast_included: bool = False
    free_cancellation: bool = False
    is_featured: bool = False
    cancellation_policy: str = ""


class AccommodationDetail(ORMModel):
    id: UUID
    slug: str
    name: str
    type: str
    destination_id: UUID
    destination_name: str | None = None
    description: str = ""
    short_description: str = ""
    address: str = ""
    latitude: float
    longitude: float
    star_rating: int = 4
    guest_rating: float = 4.5
    review_count: int = 0
    images: list[str] = Field(default_factory=list)
    video_url: str | None = None
    amenities: list[str] = Field(default_factory=list)
    rules: list[str] = Field(default_factory=list)
    policies: dict = Field(default_factory=dict)
    cancellation_policy: str = ""
    breakfast_included: bool = True
    free_cancellation: bool = True
    base_price: int
    distance_to_center_km: float = 0
    rooms: list[RoomOut] = Field(default_factory=list)
    nearby_attractions: list[dict] = Field(default_factory=list)
    is_featured: bool = False


class AccommodationSearchResponse(ORMModel):
    items: list[AccommodationCard]
    total: int
    page: int
    page_size: int
    pages: int
    meta: dict = Field(default_factory=dict)
