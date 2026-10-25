from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import Role

if TYPE_CHECKING:
    from app.db.models.booking import Booking
    from app.db.models.engagement import Favorite, Notification, Review, Wallet
    from app.db.models.trip import Trip


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(160), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    locale: Mapped[str] = mapped_column(String(10), default="fa")
    currency: Mapped[str] = mapped_column(String(8), default="IRT")
    city: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(
        Enum(Role, native_enum=False, length=32), default=Role.TRAVELER, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    privacy_settings: Mapped[dict[str, Any]] = mapped_column(default=dict)
    notification_settings: Mapped[dict[str, Any]] = mapped_column(default=dict)

    preferences: Mapped[UserPreference | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    trips: Mapped[list[Trip]] = relationship(back_populates="user", cascade="all, delete-orphan")
    bookings: Mapped[list[Booking]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[Review]] = relationship(back_populates="user")
    favorites: Mapped[list[Favorite]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[list[Notification]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    wallet: Mapped[Wallet | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class UserPreference(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_preferences"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    interests: Mapped[list[str]] = mapped_column(default=list)
    budget_level: Mapped[str] = mapped_column(String(20), default="mid")
    travel_style: Mapped[str] = mapped_column(String(40), default="balanced")
    preferred_transport: Mapped[str | None] = mapped_column(String(40))
    preferred_accommodation: Mapped[str | None] = mapped_column(String(40))
    dietary_preferences: Mapped[list[str]] = mapped_column(default=list)
    accessibility_needs: Mapped[list[str]] = mapped_column(default=list)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship(back_populates="preferences")


class Provider(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "providers"

    name: Mapped[str] = mapped_column(String(180), index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    provider_type: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    website: Mapped[str | None] = mapped_column(String(300))
    rating: Mapped[float] = mapped_column(default=4.5)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    payout_iban: Mapped[str | None] = mapped_column(String(64))
    commission_rate: Mapped[int] = mapped_column(Integer, default=10)
