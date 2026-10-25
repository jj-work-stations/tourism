from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import (
    BookingStatus,
    BookingType,
    CouponType,
    PaymentMethod,
    PaymentStatus,
)

if TYPE_CHECKING:
    from app.db.models.catalog import (
        Accommodation,
        Destination,
        Experience,
        Room,
        TransportOffer,
    )
    from app.db.models.trip import Trip
    from app.db.models.user import User


class Booking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_booking_user_status", "user_id", "status"),
        Index("ix_booking_type_status", "booking_type", "status"),
    )

    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    trip_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("trips.id", ondelete="SET NULL"), index=True
    )
    booking_type: Mapped[BookingType] = mapped_column(
        Enum(BookingType, native_enum=False, length=32), index=True
    )
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, native_enum=False, length=32),
        default=BookingStatus.PENDING,
        index=True,
    )
    destination_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("destinations.id", ondelete="SET NULL"), index=True
    )

    transport_offer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("transport_offers.id", ondelete="SET NULL"), index=True
    )
    accommodation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("accommodations.id", ondelete="SET NULL"), index=True
    )
    room_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("rooms.id", ondelete="SET NULL"), index=True
    )
    experience_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("experiences.id", ondelete="SET NULL"), index=True
    )

    travel_date: Mapped[date | None] = mapped_column(Date)
    check_in: Mapped[date | None] = mapped_column(Date)
    check_out: Mapped[date | None] = mapped_column(Date)
    guests: Mapped[int] = mapped_column(Integer, default=1)
    rooms_count: Mapped[int] = mapped_column(Integer, default=1)
    nights: Mapped[int] = mapped_column(Integer, default=0)

    unit_price: Mapped[int] = mapped_column(Integer, default=0)
    subtotal: Mapped[int] = mapped_column(Integer, default=0)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="IRT")
    coupon_code: Mapped[str | None] = mapped_column(String(40))

    title: Mapped[str] = mapped_column(String(220), default="")
    details: Mapped[dict[str, Any]] = mapped_column(default=dict)
    cancellation_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="bookings")
    trip: Mapped[Trip | None] = relationship(back_populates="bookings")
    destination: Mapped[Destination | None] = relationship()
    transport_offer: Mapped[TransportOffer | None] = relationship()
    accommodation: Mapped[Accommodation | None] = relationship()
    room: Mapped[Room | None] = relationship()
    experience: Mapped[Experience | None] = relationship()
    passengers: Mapped[list[Passenger]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", lazy="selectin"
    )
    payments: Mapped[list[Payment]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", lazy="selectin"
    )


class Passenger(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "passengers"

    booking_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True
    )
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    national_id: Mapped[str | None] = mapped_column(String(32))
    passport_number: Mapped[str | None] = mapped_column(String(32))
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(16))
    phone: Mapped[str | None] = mapped_column(String(32))
    seat_number: Mapped[str | None] = mapped_column(String(12))

    booking: Mapped[Booking] = relationship(back_populates="passengers")


class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (Index("ix_payment_user_status", "user_id", "status"),)

    booking_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="IRT")
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, native_enum=False, length=24), default=PaymentMethod.CARD
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False, length=24),
        default=PaymentStatus.PENDING,
        index=True,
    )
    reference: Mapped[str] = mapped_column(String(64), unique=True)
    gateway: Mapped[str] = mapped_column(String(40), default="sandbox")
    refunded_amount: Mapped[int] = mapped_column(Integer, default=0)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gateway_payload: Mapped[dict[str, Any]] = mapped_column(default=dict)

    booking: Mapped[Booking] = relationship(back_populates="payments")


class Coupon(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "coupons"

    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160), default="")
    description: Mapped[str] = mapped_column(String(400), default="")
    coupon_type: Mapped[CouponType] = mapped_column(
        Enum(CouponType, native_enum=False, length=16), default=CouponType.PERCENT
    )
    value: Mapped[int] = mapped_column(Integer)
    min_amount: Mapped[int] = mapped_column(Integer, default=0)
    max_discount: Mapped[int | None] = mapped_column(Integer)
    usage_limit: Mapped[int] = mapped_column(Integer, default=1000)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    per_user_limit: Mapped[int] = mapped_column(Integer, default=1)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class Campaign(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "campaigns"

    title: Mapped[str] = mapped_column(String(180))
    subtitle: Mapped[str] = mapped_column(String(400), default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    cta_label: Mapped[str] = mapped_column(String(80), default="مشاهده")
    cta_url: Mapped[str] = mapped_column(String(400), default="/")
    badge: Mapped[str] = mapped_column(String(80), default="")
    placement: Mapped[str] = mapped_column(String(40), default="home")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SupportTicket(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "support_tickets"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    booking_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), index=True
    )
    subject: Mapped[str] = mapped_column(String(220))
    category: Mapped[str] = mapped_column(String(60), default="general")
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    priority: Mapped[str] = mapped_column(String(16), default="normal")
    assigned_to: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    response: Mapped[str | None] = mapped_column(Text)


class EmergencyContact(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "emergency_contacts"

    destination_id: Mapped[UUID] = mapped_column(
        ForeignKey("destinations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(40))
    phone: Mapped[str] = mapped_column(String(40))
    address: Mapped[str] = mapped_column(String(400), default="")
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
