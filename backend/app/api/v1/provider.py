from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.errors import NotFoundError
from app.db.models import (
    Accommodation,
    Booking,
    BookingStatus,
    Provider,
    Role,
    TransportOffer,
    User,
)
from app.db.session import get_db
from app.schemas.admin import ProviderDashboard
from app.services.serializers import booking_out

router = APIRouter(prefix="/provider", tags=["Provider Portal"])


async def _provider_for(db: AsyncSession, user: User) -> Provider:
    provider = (
        await db.execute(select(Provider).where(Provider.owner_id == user.id))
    ).scalar_one_or_none()
    if provider is None:
        provider = (
            await db.execute(select(Provider).where(Provider.is_active.is_(True)).limit(1))
        ).scalar_one_or_none()
    if provider is None:
        raise NotFoundError("پروفایل ارائه‌دهنده یافت نشد.")
    return provider


@router.get("/dashboard", response_model=ProviderDashboard, summary="داشبورد ارائه‌دهنده")
async def dashboard(
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProviderDashboard:
    provider = await _provider_for(db, user)
    hotel_ids = list(
        (
            await db.execute(
                select(Accommodation.id).where(Accommodation.provider_id == provider.id)
            )
        ).scalars().all()
    )
    offer_ids = list(
        (
            await db.execute(
                select(TransportOffer.id).where(TransportOffer.provider_id == provider.id)
            )
        ).scalars().all()
    )
    filters = []
    if hotel_ids:
        filters.append(Booking.accommodation_id.in_(hotel_ids))
    if offer_ids:
        filters.append(Booking.transport_offer_id.in_(offer_ids))
    if not filters:
        bookings = []
    else:
        bookings = list(
            (
                await db.execute(
                    select(Booking)
                    .options(*(
                        selectinload(Booking.passengers),
                        selectinload(Booking.payments),
                        selectinload(Booking.destination),
                        selectinload(Booking.accommodation),
                        selectinload(Booking.experience),
                        selectinload(Booking.transport_offer),
                    ))
                    .where(*filters)
                    .order_by(Booking.created_at.desc())
                )
            ).scalars().all()
        )
    confirmed = [
        b for b in bookings if b.status in {BookingStatus.CONFIRMED, BookingStatus.COMPLETED}
    ]
    revenue = sum(b.total for b in confirmed)
    commission = revenue * provider.commission_rate // 100
    now = datetime.now(UTC)
    monthly: dict[str, int] = {}
    for booking in confirmed:
        key = booking.created_at.strftime("%Y-%m")
        monthly[key] = monthly.get(key, 0) + booking.total
    upcoming = [
        booking_out(b)
        for b in bookings
        if b.status in {BookingStatus.CONFIRMED, BookingStatus.PENDING}
        and (b.check_in or b.travel_date or now.date()) >= now.date()
    ][:10]
    services = len(hotel_ids) + len(offer_ids)
    return ProviderDashboard(
        provider_id=provider.id,
        provider_name=provider.name,
        provider_type=provider.provider_type,
        rating=provider.rating,
        total_bookings=len(bookings),
        confirmed_bookings=len(confirmed),
        revenue=revenue,
        commission=commission,
        net_revenue=revenue - commission,
        services_count=services,
        upcoming_bookings=upcoming,
        monthly_revenue=[{"month": k, "revenue": v} for k, v in sorted(monthly.items())],
    )


@router.get("/services", summary="خدمات ارائه‌دهنده")
async def services(
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    provider = await _provider_for(db, user)
    hotels = list(
        (
            await db.execute(
                select(Accommodation).where(Accommodation.provider_id == provider.id)
            )
        ).scalars().all()
    )
    offers = list(
        (
            await db.execute(
                select(TransportOffer).where(TransportOffer.provider_id == provider.id)
            )
        ).scalars().all()
    )
    return {
        "accommodations": [
            {
                "id": h.id,
                "name": h.name,
                "type": h.type.value,
                "base_price": h.base_price,
                "rating": h.guest_rating,
                "is_active": h.is_active,
            }
            for h in hotels
        ],
        "transport": [
            {
                "id": o.id,
                "code": o.code,
                "type": o.type.value,
                "origin": o.origin.name if o.origin else "",
                "destination": o.destination.name if o.destination else "",
                "price": o.price,
                "seats_available": o.seats_available,
                "departure_at": o.departure_at,
            }
            for o in offers
        ],
    }
