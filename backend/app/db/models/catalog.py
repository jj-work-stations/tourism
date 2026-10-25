from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import (
    AccommodationType,
    AttractionCategory,
    ExperienceCategory,
    TransportType,
)

if TYPE_CHECKING:
    from app.db.models.user import Provider


class Destination(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "destinations"

    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    name_local: Mapped[str] = mapped_column(String(180))
    country: Mapped[str] = mapped_column(String(120), index=True)
    country_code: Mapped[str] = mapped_column(String(2), default="IR")
    region: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    short_description: Mapped[str] = mapped_column(String(400), default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    gallery: Mapped[list[str]] = mapped_column(default=list)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Tehran")
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    popularity: Mapped[int] = mapped_column(Integer, default=0, index=True)
    tags: Mapped[list[str]] = mapped_column(default=list)
    best_season: Mapped[str | None] = mapped_column(String(80))
    avg_daily_budget: Mapped[int] = mapped_column(Integer, default=0)


class TransportOffer(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "transport_offers"
    __table_args__ = (
        Index("ix_transport_search", "origin_id", "destination_id", "departure_at"),
        Index("ix_transport_type_price", "type", "price"),
    )

    provider_id: Mapped[UUID] = mapped_column(
        ForeignKey("providers.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[TransportType] = mapped_column(
        Enum(TransportType, native_enum=False, length=32), index=True
    )
    code: Mapped[str] = mapped_column(String(32), unique=True)
    origin_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    departure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    arrival_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="IRT")
    stops: Mapped[int] = mapped_column(Integer, default=0)
    capacity: Mapped[int] = mapped_column(Integer, default=100)
    seats_available: Mapped[int] = mapped_column(Integer, default=100)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    comfort_score: Mapped[int] = mapped_column(Integer, default=4)
    baggage_allowance: Mapped[str] = mapped_column(String(120), default="۲۰ کیلوگرم")
    amenities: Mapped[list[str]] = mapped_column(default=list)
    cancellation_policy: Mapped[str] = mapped_column(String(300), default="امکان لغو تا ۲۴ ساعت قبل")
    change_policy: Mapped[str] = mapped_column(String(300), default="تغییر تاریخ با پرداخت تفاوت نرخ")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    provider: Mapped[Provider] = relationship(foreign_keys=[provider_id])
    origin: Mapped[Destination] = relationship(foreign_keys=[origin_id])
    destination: Mapped[Destination] = relationship(foreign_keys=[destination_id])


class Accommodation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "accommodations"
    __table_args__ = (
        Index("ix_accommodation_destination_rating", "destination_id", "guest_rating"),
        Index("ix_accommodation_type_price", "type", "base_price"),
    )

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[AccommodationType] = mapped_column(
        Enum(AccommodationType, native_enum=False, length=32), index=True
    )
    description: Mapped[str] = mapped_column(Text, default="")
    short_description: Mapped[str] = mapped_column(String(400), default="")
    address: Mapped[str] = mapped_column(String(400), default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    star_rating: Mapped[int] = mapped_column(Integer, default=4)
    guest_rating: Mapped[float] = mapped_column(Float, default=4.5)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    images: Mapped[list[str]] = mapped_column(default=list)
    video_url: Mapped[str | None] = mapped_column(String(500))
    amenities: Mapped[list[str]] = mapped_column(default=list)
    rules: Mapped[list[str]] = mapped_column(default=list)
    policies: Mapped[dict[str, Any]] = mapped_column(default=dict)
    cancellation_policy: Mapped[str] = mapped_column(String(300), default="لغو رایگان تا ۴۸ ساعت قبل")
    breakfast_included: Mapped[bool] = mapped_column(Boolean, default=True)
    free_cancellation: Mapped[bool] = mapped_column(Boolean, default=True)
    base_price: Mapped[int] = mapped_column(Integer, index=True)
    distance_to_center_km: Mapped[float] = mapped_column(Float, default=1.0)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    destination: Mapped[Destination] = relationship()
    provider: Mapped[Provider | None] = relationship()
    rooms: Mapped[list[Room]] = relationship(
        back_populates="accommodation", cascade="all, delete-orphan"
    )

    @property
    def cover_image(self) -> str | None:
        return self.images[0] if self.images else None


class Room(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (Index("ix_room_accommodation_price", "accommodation_id", "price_per_night"),)

    accommodation_id: Mapped[UUID] = mapped_column(
        ForeignKey("accommodations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    room_type: Mapped[str] = mapped_column(String(80), default="double")
    description: Mapped[str] = mapped_column(String(500), default="")
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    beds: Mapped[str] = mapped_column(String(120), default="۱ تخت دو نفره")
    size_sqm: Mapped[int] = mapped_column(Integer, default=25)
    price_per_night: Mapped[int] = mapped_column(Integer)
    total_rooms: Mapped[int] = mapped_column(Integer, default=5)
    amenities: Mapped[list[str]] = mapped_column(default=list)
    images: Mapped[list[str]] = mapped_column(default=list)
    breakfast_included: Mapped[bool] = mapped_column(Boolean, default=True)
    refundable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    accommodation: Mapped[Accommodation] = relationship(back_populates="rooms")


class Attraction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "attractions"
    __table_args__ = (
        Index("ix_attraction_destination_category", "destination_id", "category"),
    )

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id", ondelete="SET NULL")
    )
    category: Mapped[AttractionCategory] = mapped_column(
        Enum(AttractionCategory, native_enum=False, length=32), index=True
    )
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    gallery: Mapped[list[str]] = mapped_column(default=list)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String(400), default="")
    opening_hours: Mapped[dict[str, Any]] = mapped_column(default=dict)
    ticket_price: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    suggested_visit_minutes: Mapped[int] = mapped_column(Integer, default=90)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    destination: Mapped[Destination] = relationship()


class Restaurant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "restaurants"
    __table_args__ = (Index("ix_restaurant_destination_rating", "destination_id", "rating"),)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id", ondelete="SET NULL")
    )
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    gallery: Mapped[list[str]] = mapped_column(default=list)
    cuisine: Mapped[str] = mapped_column(String(120), default="ایرانی")
    price_range: Mapped[int] = mapped_column(Integer, default=2)
    average_price: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    address: Mapped[str] = mapped_column(String(400), default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    opening_hours: Mapped[dict[str, Any]] = mapped_column(default=dict)
    menu: Mapped[list[dict[str, Any]]] = mapped_column(default=list)
    signature_dishes: Mapped[list[str]] = mapped_column(default=list)
    reservation_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    destination: Mapped[Destination] = relationship()


class Experience(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "experiences"
    __table_args__ = (Index("ix_experience_destination_category", "destination_id", "category"),)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id", ondelete="SET NULL")
    )
    category: Mapped[ExperienceCategory] = mapped_column(
        Enum(ExperienceCategory, native_enum=False, length=32), index=True
    )
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    gallery: Mapped[list[str]] = mapped_column(default=list)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=180)
    price: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="IRT")
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    max_participants: Mapped[int] = mapped_column(Integer, default=12)
    meeting_point: Mapped[str] = mapped_column(String(400), default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    includes: Mapped[list[str]] = mapped_column(default=list)
    languages: Mapped[list[str]] = mapped_column(default=list)
    guide_name: Mapped[str | None] = mapped_column(String(160))
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    destination: Mapped[Destination] = relationship()


class WeatherSnapshot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "weather_snapshots"

    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    temperature_c: Mapped[float] = mapped_column(Float)
    feels_like_c: Mapped[float] = mapped_column(Float, default=0)
    condition: Mapped[str] = mapped_column(String(80), default="آفتابی")
    humidity: Mapped[int] = mapped_column(Integer, default=30)
    wind_kph: Mapped[float] = mapped_column(Float, default=5)
    forecast: Mapped[list[dict[str, Any]]] = mapped_column(default=list)
