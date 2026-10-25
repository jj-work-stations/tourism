from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import (
    FavoriteEntity,
    NotificationType,
    ReviewEntity,
    ReviewStatus,
    WalletTransactionType,
)

if TYPE_CHECKING:
    from app.db.models.user import User


class Review(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_review_user_entity"),
        Index("ix_review_entity", "entity_type", "entity_id", "status"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[ReviewEntity] = mapped_column(
        Enum(ReviewEntity, native_enum=False, length=24), index=True
    )
    entity_id: Mapped[UUID] = mapped_column(index=True)
    rating: Mapped[int] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, default="")
    photos: Mapped[list[str]] = mapped_column(default=list)
    cleanliness: Mapped[int | None] = mapped_column(Integer)
    location_score: Mapped[int | None] = mapped_column(Integer)
    service: Mapped[int | None] = mapped_column(Integer)
    value: Mapped[int | None] = mapped_column(Integer)
    experience_score: Mapped[int | None] = mapped_column(Integer)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, native_enum=False, length=24),
        default=ReviewStatus.PUBLISHED,
        index=True,
    )
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    response: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="reviews")


class Favorite(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_favorite_user_entity"),
        Index("ix_favorite_user_type", "user_id", "entity_type"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[FavoriteEntity] = mapped_column(
        Enum(FavoriteEntity, native_enum=False, length=24), index=True
    )
    entity_id: Mapped[UUID] = mapped_column(index=True)

    user: Mapped[User] = relationship(back_populates="favorites")


class Notification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notification_user_read", "user_id", "is_read"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, native_enum=False, length=32),
        default=NotificationType.SYSTEM,
    )
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="notifications")


class Wallet(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "wallets"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    balance: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="IRT")
    points: Mapped[int] = mapped_column(Integer, default=0)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String(24), default="bronze")

    user: Mapped[User] = relationship(back_populates="wallet")
    transactions: Mapped[list[WalletTransaction]] = relationship(
        back_populates="wallet", cascade="all, delete-orphan", lazy="selectin"
    )


class WalletTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "wallet_transactions"
    __table_args__ = (Index("ix_wallet_tx_wallet_created", "wallet_id", "created_at"),)

    wallet_id: Mapped[UUID] = mapped_column(
        ForeignKey("wallets.id", ondelete="CASCADE"), index=True
    )
    transaction_type: Mapped[WalletTransactionType] = mapped_column(
        Enum(WalletTransactionType, native_enum=False, length=24)
    )
    amount: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(String(300), default="")
    reference: Mapped[str | None] = mapped_column(String(80), index=True)

    wallet: Mapped[Wallet] = relationship(back_populates="transactions")


class Achievement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "achievements"

    code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(String(400), default="")
    icon: Mapped[str] = mapped_column(String(16), default="🏆")
    category: Mapped[str] = mapped_column(String(40), default="general")
    xp_reward: Mapped[int] = mapped_column(Integer, default=50)
    criteria: Mapped[dict[str, Any]] = mapped_column(default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserAchievement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    achievement_id: Mapped[UUID] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"), index=True
    )
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    achievement: Mapped[Achievement] = relationship(lazy="selectin")


class PassportStamp(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "passport_stamps"
    __table_args__ = (
        UniqueConstraint("user_id", "destination_id", name="uq_passport_user_destination"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(String(300))


class Challenge(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "challenges"

    code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(String(400), default="")
    icon: Mapped[str] = mapped_column(String(16), default="🎯")
    xp_reward: Mapped[int] = mapped_column(Integer, default=50)
    target: Mapped[int] = mapped_column(Integer, default=1)
    metric: Mapped[str] = mapped_column(String(60), default="visits")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserChallenge(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_challenges"
    __table_args__ = (UniqueConstraint("user_id", "challenge_id", name="uq_user_challenge"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    challenge_id: Mapped[UUID] = mapped_column(
        ForeignKey("challenges.id", ondelete="CASCADE"), index=True
    )
    progress: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    challenge: Mapped[Challenge] = relationship(lazy="selectin")


class AnalyticsEvent(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "analytics_events"
    __table_args__ = (Index("ix_event_name_created", "name", "created_at"),)

    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(80), index=True)
    properties: Mapped[dict[str, Any]] = mapped_column(default=dict)
    path: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
