from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.db.models.enums import TransportType
from app.schemas.common import DestinationBrief, ORMModel, ProviderBrief


class TransportSearchRequest(ORMModel):
    origin_id: UUID
    destination_id: UUID
    date: date
    passengers: int = Field(default=1, ge=1, le=10)
    types: list[TransportType] | None = None
    min_price: int | None = Field(default=None, ge=0)
    max_price: int | None = Field(default=None, ge=0)
    max_stops: int | None = Field(default=None, ge=0, le=5)
    provider_id: UUID | None = None
    sort: Literal["recommended", "cheapest", "fastest", "rating"] = "recommended"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=50)

    @model_validator(mode="after")
    def validate_route(self) -> TransportSearchRequest:
        if self.origin_id == self.destination_id:
            raise ValueError("مبدأ و مقصد نمی‌توانند یکسان باشند.")
        if self.max_price is not None and self.min_price is not None:
            if self.max_price < self.min_price:
                raise ValueError("حداکثر قیمت از حداقل قیمت کمتر است.")
        return self


class TransportOfferOut(ORMModel):
    id: UUID
    code: str
    type: str
    provider: ProviderBrief
    origin: DestinationBrief
    destination: DestinationBrief
    departure_at: datetime
    arrival_at: datetime
    duration_minutes: int
    price: int
    currency: str = "IRT"
    stops: int = 0
    seats_available: int = 0
    rating: float = 4.5
    comfort_score: int = 4
    baggage_allowance: str = ""
    amenities: list[str] = Field(default_factory=list)
    cancellation_policy: str = ""
    change_policy: str = ""


class TransportSearchMeta(ORMModel):
    cheapest_price: int | None = None
    fastest_minutes: int | None = None
    types_available: list[str] = Field(default_factory=list)


class TransportSearchResponse(ORMModel):
    items: list[TransportOfferOut]
    total: int
    page: int
    page_size: int
    pages: int
    meta: TransportSearchMeta = Field(default_factory=TransportSearchMeta)
