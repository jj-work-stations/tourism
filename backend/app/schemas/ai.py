from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import DestinationBrief, ORMModel, UserBrief
from app.schemas.trip import TripPlan


class PlanTripRequest(ORMModel):
    destination_id: UUID
    origin_id: UUID | None = None
    days: int = Field(default=3, ge=1, le=30)
    budget: int = Field(default=0, ge=0)
    travelers: int = Field(default=1, ge=1, le=20)
    interests: list[str] = Field(default_factory=list)
    start_date: date | None = None
    pace: str = Field(default="balanced", pattern="^(relaxed|balanced|packed)$")


class AssistantRequest(ORMModel):
    message: str = Field(min_length=2, max_length=2000)
    destination_id: UUID | None = None
    days: int | None = Field(default=None, ge=1, le=30)
    budget: int | None = Field(default=None, ge=0)
    travelers: int = Field(default=1, ge=1, le=20)
    interests: list[str] = Field(default_factory=list)
    session_id: str | None = Field(default=None, max_length=64)


class AssistantResponse(ORMModel):
    reply: str
    intent: str = "chat"
    follow_up_questions: list[str] = Field(default_factory=list)
    destination: DestinationBrief | None = None
    plan: TripPlan | None = None
    suggestions: list[dict[str, Any]] = Field(default_factory=list)


class ModifyTripRequest(ORMModel):
    trip_id: UUID
    budget: int | None = Field(default=None, ge=0)
    days: int | None = Field(default=None, ge=1, le=30)
    interests: list[str] = Field(default_factory=list)
    travelers: int | None = Field(default=None, ge=1, le=20)
    pace: str = Field(default="balanced", pattern="^(relaxed|balanced|packed)$")


class RecommendationItem(ORMModel):
    destination: DestinationBrief
    score: float
    reason: str
    tags: list[str] = Field(default_factory=list)
    starting_price: int | None = None
    match: float = 0


class RecommendationResponse(ORMModel):
    personalized: bool = False
    items: list[RecommendationItem]


class HotelRecommendation(ORMModel):
    id: UUID
    name: str
    slug: str
    image_url: str | None = None
    price: int
    rating: float
    reason: str
    destination_name: str | None = None


class TravelStoryPreview(ORMModel):
    trip_id: UUID
    title: str
    author: UserBrief
    destination: DestinationBrief
    cover_image: str | None = None
    start_date: date
    end_date: date
    days: int
    summary: str = ""
    likes: int = 0
