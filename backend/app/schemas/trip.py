from __future__ import annotations

from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator

from app.db.models.enums import TripActivityType, TripStatus
from app.schemas.booking import BookingSummary
from app.schemas.common import DestinationBrief, ORMModel


class TripActivityOut(ORMModel):
    id: UUID
    activity_type: str
    title: str
    description: str = ""
    start_time: time
    end_time: time | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    cost: int = 0
    entity_type: str | None = None
    entity_id: UUID | None = None
    is_done: bool = False
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class TripDayOut(ORMModel):
    id: UUID
    day_number: int
    date: date
    title: str = ""
    notes: str | None = None
    estimated_cost: int = 0
    activities: list[TripActivityOut] = Field(default_factory=list)


class TripCreate(ORMModel):
    destination_id: UUID
    origin_id: UUID | None = None
    title: str | None = Field(default=None, max_length=220)
    start_date: date
    end_date: date
    travelers: int = Field(default=1, ge=1, le=20)
    budget: int = Field(default=0, ge=0)
    interests: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_dates(self) -> TripCreate:
        if self.end_date < self.start_date:
            raise ValueError("تاریخ پایان نمی‌تواند قبل از شروع باشد.")
        if (self.end_date - self.start_date).days > 60:
            raise ValueError("طول سفر نمی‌تواند بیش از ۶۰ روز باشد.")
        return self


class TripUpdate(ORMModel):
    title: str | None = Field(default=None, max_length=220)
    start_date: date | None = None
    end_date: date | None = None
    travelers: int | None = Field(default=None, ge=1, le=20)
    budget: int | None = Field(default=None, ge=0)
    interests: list[str] | None = None
    notes: str | None = Field(default=None, max_length=2000)
    status: TripStatus | None = None
    is_public: bool | None = None
    budget_breakdown: dict[str, int] | None = None


class TripActivityCreate(ORMModel):
    day_id: UUID | None = None
    day_number: int | None = Field(default=None, ge=1, le=61)
    activity_type: TripActivityType = TripActivityType.NOTE
    title: str = Field(min_length=1, max_length=220)
    description: str = Field(default="", max_length=2000)
    start_time: time
    end_time: time | None = None
    location_name: str | None = Field(default=None, max_length=240)
    latitude: float | None = None
    longitude: float | None = None
    cost: int = Field(default=0, ge=0)
    entity_type: str | None = None
    entity_id: UUID | None = None

    @model_validator(mode="after")
    def validate_day_ref(self) -> TripActivityCreate:
        if self.day_id is None and self.day_number is None:
            raise ValueError("یکی از day_id یا day_number الزامی است.")
        return self


class TripActivityUpdate(ORMModel):
    title: str | None = None
    description: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    cost: int | None = Field(default=None, ge=0)
    is_done: bool | None = None


class TripOut(ORMModel):
    id: UUID
    title: str
    status: str
    destination: DestinationBrief
    origin: DestinationBrief | None = None
    start_date: date
    end_date: date
    travelers: int = 1
    budget: int = 0
    spent: int = 0
    budget_breakdown: dict[str, int] = Field(default_factory=dict)
    interests: list[str] = Field(default_factory=list)
    cover_image: str | None = None
    notes: str | None = None
    is_public: bool = False
    share_slug: str | None = None
    days: list[TripDayOut] = Field(default_factory=list)
    bookings: list[BookingSummary] = Field(default_factory=list)
    created_at: datetime


class AutoPlanRequest(ORMModel):
    interests: list[str] = Field(default_factory=list)
    budget: int | None = Field(default=None, ge=0)
    pace: str = Field(default="balanced", pattern="^(relaxed|balanced|packed)$")
    replace_existing: bool = True


class PlanActivity(ORMModel):
    time: str
    end_time: str | None = None
    title: str
    description: str = ""
    activity_type: str
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    cost: int = 0
    entity_type: str | None = None
    entity_id: UUID | None = None


class PlanDay(ORMModel):
    day_number: int
    date: date
    title: str
    estimated_cost: int = 0
    activities: list[PlanActivity] = Field(default_factory=list)


class TripPlan(ORMModel):
    destination: DestinationBrief
    title: str
    days: list[PlanDay]
    estimated_total: int = 0
    budget: int = 0
    budget_remaining: int = 0
    budget_breakdown: dict[str, int] = Field(default_factory=dict)
    suggested_hotel: dict[str, Any] | None = None
    suggested_transport: dict[str, Any] | None = None
    tips: list[str] = Field(default_factory=list)
