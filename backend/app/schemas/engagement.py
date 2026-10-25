from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.db.models.enums import FavoriteEntity, ReviewEntity
from app.schemas.common import ORMModel, UserBrief


class ReviewCreate(ORMModel):
    entity_type: ReviewEntity
    entity_id: UUID
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=180)
    body: str = Field(default="", max_length=4000)
    photos: list[str] = Field(default_factory=list, max_length=10)
    cleanliness: int | None = Field(default=None, ge=1, le=5)
    location_score: int | None = Field(default=None, ge=1, le=5)
    service: int | None = Field(default=None, ge=1, le=5)
    value: int | None = Field(default=None, ge=1, le=5)
    experience_score: int | None = Field(default=None, ge=1, le=5)


class ReviewUpdate(ORMModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    title: str | None = Field(default=None, max_length=180)
    body: str | None = Field(default=None, max_length=4000)
    photos: list[str] | None = None
    cleanliness: int | None = Field(default=None, ge=1, le=5)
    location_score: int | None = Field(default=None, ge=1, le=5)
    service: int | None = Field(default=None, ge=1, le=5)
    value: int | None = Field(default=None, ge=1, le=5)
    experience_score: int | None = Field(default=None, ge=1, le=5)


class ReviewOut(ORMModel):
    id: UUID
    user: UserBrief
    entity_type: str
    entity_id: UUID
    rating: int
    title: str | None = None
    body: str = ""
    photos: list[str] = Field(default_factory=list)
    cleanliness: int | None = None
    location_score: int | None = None
    service: int | None = None
    value: int | None = None
    experience_score: int | None = None
    is_verified: bool = False
    status: str
    helpful_count: int = 0
    response: str | None = None
    created_at: datetime


class FavoriteCreate(ORMModel):
    entity_type: FavoriteEntity
    entity_id: UUID


class FavoriteOut(ORMModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    title: str = ""
    subtitle: str = ""
    image_url: str | None = None
    slug: str | None = None
    url: str | None = None
    rating: float | None = None
    price: int | None = None
    created_at: datetime


class NotificationOut(ORMModel):
    id: UUID
    notification_type: str
    title: str
    body: str = ""
    data: dict[str, Any] = Field(default_factory=dict)
    is_read: bool = False
    read_at: datetime | None = None
    created_at: datetime


class MarkReadRequest(ORMModel):
    ids: list[UUID] | None = None


class WalletTransactionOut(ORMModel):
    id: UUID
    transaction_type: str
    amount: int
    balance_after: int
    description: str = ""
    reference: str | None = None
    created_at: datetime


class WalletOut(ORMModel):
    id: UUID
    balance: int
    currency: str
    points: int
    xp: int
    level: str
    next_level: str | None = None
    xp_to_next_level: int = 0
    transactions: list[WalletTransactionOut] = Field(default_factory=list)


class WalletTopUpRequest(ORMModel):
    amount: int = Field(ge=10_000, le=500_000_000)
    idempotency_key: str | None = Field(default=None, max_length=80)


class AchievementOut(ORMModel):
    id: UUID
    code: str
    title: str
    description: str = ""
    icon: str = "🏆"
    category: str = "general"
    xp_reward: int = 50
    unlocked: bool = False
    awarded_at: datetime | None = None


class PassportStampOut(ORMModel):
    destination_id: UUID
    name: str
    slug: str
    country: str
    image_url: str | None = None
    visited_at: datetime


class ChallengeOut(ORMModel):
    id: UUID
    code: str
    title: str
    description: str = ""
    icon: str = "🎯"
    xp_reward: int = 50
    target: int = 1
    progress: int = 0
    completed: bool = False
    ends_at: datetime | None = None


class GamificationOut(ORMModel):
    xp: int
    points: int
    level: str
    next_level: str | None = None
    xp_to_next_level: int = 0
    level_progress: float = 0
    stamps: list[PassportStampOut] = Field(default_factory=list)
    achievements: list[AchievementOut] = Field(default_factory=list)
    challenges: list[ChallengeOut] = Field(default_factory=list)


class EventCreate(ORMModel):
    name: str = Field(min_length=2, max_length=80)
    session_id: str | None = Field(default=None, max_length=64)
    properties: dict[str, Any] = Field(default_factory=dict)
    path: str | None = Field(default=None, max_length=300)


class EventBatch(ORMModel):
    events: list[EventCreate] = Field(min_length=1, max_length=50)


class SupportTicketCreate(ORMModel):
    subject: str = Field(min_length=3, max_length=220)
    message: str = Field(min_length=5, max_length=5000)
    category: str = Field(default="general", max_length=60)
    booking_id: UUID | None = None
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")


class SupportTicketOut(ORMModel):
    id: UUID
    subject: str
    category: str
    message: str
    status: str
    priority: str
    response: str | None = None
    created_at: datetime


class EmergencyContactOut(ORMModel):
    id: UUID
    destination_id: UUID
    name: str
    category: str
    phone: str
    address: str = ""
    latitude: float | None = None
    longitude: float | None = None


class ReviewStats(ORMModel):
    average: float = 0
    total: int = 0
    distribution: dict[str, int] = Field(default_factory=dict)
