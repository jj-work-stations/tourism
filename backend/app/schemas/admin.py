from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.booking import BookingOut
from app.schemas.common import ORMModel


class AdminStats(ORMModel):
    total_users: int = 0
    active_users_30d: int = 0
    new_users_30d: int = 0
    total_bookings: int = 0
    bookings_30d: int = 0
    confirmed_bookings: int = 0
    cancelled_bookings: int = 0
    revenue_total: int = 0
    revenue_30d: int = 0
    average_booking_value: int = 0
    conversion_rate: float = 0
    cancellation_rate: float = 0
    total_providers: int = 0
    total_destinations: int = 0
    total_reviews: int = 0
    pending_reviews: int = 0
    revenue_series: list[dict[str, Any]] = Field(default_factory=list)
    bookings_by_type: dict[str, int] = Field(default_factory=dict)
    popular_destinations: list[dict[str, Any]] = Field(default_factory=list)
    popular_transport: list[dict[str, Any]] = Field(default_factory=list)
    recent_bookings: list[BookingOut] = Field(default_factory=list)
    top_events: list[dict[str, Any]] = Field(default_factory=list)


class AdminUserOut(ORMModel):
    id: UUID
    email: str | None = None
    phone: str | None = None
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    city: str | None = None
    created_at: datetime
    last_login_at: datetime | None = None
    bookings_count: int = 0
    total_spent: int = 0


class AdminUserUpdate(ORMModel):
    role: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None


class AdminBookingQuery(ORMModel):
    status: str | None = None
    booking_type: str | None = None
    date_from: date | None = None
    date_to: date | None = None


class ProviderDashboard(ORMModel):
    provider_id: UUID
    provider_name: str
    provider_type: str
    rating: float
    total_bookings: int = 0
    confirmed_bookings: int = 0
    revenue: int = 0
    commission: int = 0
    net_revenue: int = 0
    services_count: int = 0
    upcoming_bookings: list[BookingOut] = Field(default_factory=list)
    monthly_revenue: list[dict[str, Any]] = Field(default_factory=list)


class AuditLogOut(ORMModel):
    id: UUID
    action: str
    entity_type: str
    entity_id: UUID | None = None
    user_id: UUID | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class AuditLogCreate(ORMModel):
    action: str
    entity_type: str
    entity_id: UUID | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class SystemSettings(ORMModel):
    site_name: str = "سیر"
    site_tagline: str = "سوپراپ سفر ایران"
    support_phone: str = "۰۲۱-۱۲۳۴۵۶۷۸"
    support_email: str = "support@seir.ir"
    default_currency: str = "IRT"
    default_locale: str = "fa"
    booking_hold_minutes: int = 15
    cancellation_window_hours: int = 48
    commission_rate: float = 0.15
    maintenance_mode: bool = False
    registration_open: bool = True


class ContentItem(ORMModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    title: str
    subtitle: str = ""
    image_url: str = ""
    is_active: bool = True
    is_featured: bool = False
    sort_order: int = 0
    created_at: datetime
