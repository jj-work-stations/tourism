from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    message: str


class Paginated[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class DestinationBrief(ORMModel):
    id: UUID
    slug: str
    name: str
    name_local: str | None = None
    country: str | None = None
    image_url: str | None = None


class ProviderBrief(ORMModel):
    id: UUID
    name: str
    logo_url: str | None = None
    rating: float = 4.5
    provider_type: str | None = None


class UserBrief(ORMModel):
    id: UUID
    full_name: str
    avatar_url: str | None = None


class Money(BaseModel):
    amount: int = Field(ge=0)
    currency: str = "IRT"


class GeoPoint(BaseModel):
    latitude: float
    longitude: float


class TimeRange(BaseModel):
    start: datetime | None = None
    end: datetime | None = None
