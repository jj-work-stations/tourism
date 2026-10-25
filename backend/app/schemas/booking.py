from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator

from app.db.models.enums import BookingType, PaymentMethod
from app.schemas.common import DestinationBrief, ORMModel


class PassengerIn(ORMModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    national_id: str | None = Field(default=None, max_length=32)
    passport_number: str | None = Field(default=None, max_length=32)
    birth_date: date | None = None
    gender: str | None = Field(default=None, pattern="^(male|female|other)$")
    phone: str | None = Field(default=None, max_length=32)
    seat_number: str | None = Field(default=None, max_length=12)


class PassengerOut(ORMModel):
    id: UUID
    first_name: str
    last_name: str
    national_id: str | None = None
    passport_number: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    phone: str | None = None
    seat_number: str | None = None


class BookingCreate(ORMModel):
    booking_type: BookingType
    transport_offer_id: UUID | None = None
    room_id: UUID | None = None
    experience_id: UUID | None = None
    travel_date: date | None = None
    check_in: date | None = None
    check_out: date | None = None
    guests: int = Field(default=1, ge=1, le=20)
    rooms_count: int = Field(default=1, ge=1, le=10)
    passengers: list[PassengerIn] = Field(default_factory=list, max_length=20)
    coupon_code: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_payload(self) -> BookingCreate:
        match self.booking_type:
            case BookingType.TRANSPORT:
                if not self.transport_offer_id or not self.travel_date:
                    raise ValueError("برای بلیت حمل‌ونقل، شناسه سفر و تاریخ سفر الزامی است.")
            case BookingType.ACCOMMODATION:
                if not self.room_id or not self.check_in or not self.check_out:
                    raise ValueError("برای اقامتگاه، اتاق و تاریخ ورود و خروج الزامی است.")
                if self.check_out <= self.check_in:
                    raise ValueError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
            case BookingType.EXPERIENCE:
                if not self.experience_id or not self.travel_date:
                    raise ValueError("برای تجربه، شناسه تجربه و تاریخ الزامی است.")
        return self


class PaymentOut(ORMModel):
    id: UUID
    booking_id: UUID
    amount: int
    currency: str
    method: str
    status: str
    reference: str
    gateway: str
    refunded_amount: int = 0
    paid_at: datetime | None = None
    created_at: datetime
    gateway_payload: dict[str, Any] = Field(default_factory=dict)


class BookingOut(ORMModel):
    id: UUID
    code: str
    booking_type: str
    status: str
    title: str
    destination: DestinationBrief | None = None
    image_url: str | None = None
    travel_date: date | None = None
    check_in: date | None = None
    check_out: date | None = None
    guests: int = 1
    rooms_count: int = 1
    nights: int = 0
    unit_price: int = 0
    subtotal: int = 0
    discount: int = 0
    total: int = 0
    currency: str = "IRT"
    coupon_code: str | None = None
    passengers: list[PassengerOut] = Field(default_factory=list)
    payment: PaymentOut | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    cancellation_deadline: datetime | None = None
    created_at: datetime
    confirmed_at: datetime | None = None
    cancelled_at: datetime | None = None
    can_cancel: bool = False


class BookingSummary(ORMModel):
    id: UUID
    code: str
    booking_type: str
    status: str
    title: str
    total: int
    currency: str = "IRT"
    image_url: str | None = None
    travel_date: date | None = None
    check_in: date | None = None
    check_out: date | None = None


class PaymentCreate(ORMModel):
    booking_id: UUID
    method: PaymentMethod = PaymentMethod.CARD
    simulate_failure: bool = False


class PaymentResult(ORMModel):
    payment: PaymentOut
    booking: BookingOut
    message: str


class RefundRequest(ORMModel):
    reason: str | None = Field(default=None, max_length=500)


class CouponValidateRequest(ORMModel):
    code: str = Field(min_length=2, max_length=40)
    amount: int = Field(ge=0)


class CouponOut(ORMModel):
    code: str
    title: str = ""
    description: str = ""
    coupon_type: str
    value: int
    discount: int = 0
    final_amount: int = 0
    min_amount: int = 0
    valid_to: datetime | None = None
    is_valid: bool = True
