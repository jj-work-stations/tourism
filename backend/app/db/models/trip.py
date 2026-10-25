from __future__ import annotations

from datetime import date, time
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import TripActivityType, TripStatus

if TYPE_CHECKING:
    from app.db.models.booking import Booking
    from app.db.models.catalog import Destination
    from app.db.models.user import User


class Trip(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "trips"
    __table_args__ = (Index("ix_trip_user_start", "user_id", "start_date"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    origin_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL")
    )
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(220))
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus, native_enum=False, length=24), default=TripStatus.UPCOMING, index=True
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    travelers: Mapped[int] = mapped_column(Integer, default=1)
    budget: Mapped[int] = mapped_column(Integer, default=0)
    spent: Mapped[int] = mapped_column(Integer, default=0)
    budget_breakdown: Mapped[dict[str, int]] = mapped_column(default=dict)
    interests: Mapped[list[str]] = mapped_column(default=list)
    cover_image: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    share_slug: Mapped[str | None] = mapped_column(String(40), unique=True, index=True)

    user: Mapped[User] = relationship(back_populates="trips")
    destination: Mapped[Destination] = relationship(foreign_keys=[destination_id])
    origin: Mapped[Destination | None] = relationship(foreign_keys=[origin_id])
    days: Mapped[list[TripDay]] = relationship(
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripDay.day_number",
        lazy="selectin",
    )
    bookings: Mapped[list[Booking]] = relationship(back_populates="trip")


class TripDay(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "trip_days"
    __table_args__ = (Index("ix_trip_day_trip_number", "trip_id", "day_number"),)

    trip_id: Mapped[UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), index=True
    )
    day_number: Mapped[int] = mapped_column(Integer)
    date: Mapped[date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(180), default="")
    notes: Mapped[str | None] = mapped_column(Text)
    estimated_cost: Mapped[int] = mapped_column(Integer, default=0)

    trip: Mapped[Trip] = relationship(back_populates="days")
    activities: Mapped[list[TripActivity]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        order_by="TripActivity.start_time",
        lazy="selectin",
    )


class TripActivity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "trip_activities"

    day_id: Mapped[UUID] = mapped_column(
        ForeignKey("trip_days.id", ondelete="CASCADE"), index=True
    )
    activity_type: Mapped[TripActivityType] = mapped_column(
        Enum(TripActivityType, native_enum=False, length=24),
        default=TripActivityType.ATTRACTION,
    )
    title: Mapped[str] = mapped_column(String(220))
    description: Mapped[str] = mapped_column(Text, default="")
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    location_name: Mapped[str | None] = mapped_column(String(240))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    cost: Mapped[int] = mapped_column(Integer, default=0)
    entity_type: Mapped[str | None] = mapped_column(String(32))
    entity_id: Mapped[UUID | None] = mapped_column()
    booking_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL")
    )
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(default=dict)

    day: Mapped[TripDay] = relationship(back_populates="activities")
