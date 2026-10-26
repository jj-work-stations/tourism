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


# ───────────────────────────── Provider Service Management ─────────────────────


@router.post("/services/accommodations", status_code=201, summary="ایجاد اقامتگاه برای ارائه‌دهنده")
async def create_accommodation(
    payload: dict,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    provider = await _provider_for(db, user)
    acc = Accommodation(
        provider_id=provider.id,
        is_active=bool(payload.get("is_active", True)),
        is_featured=bool(payload.get("is_featured", False)),
        slug=sluggify(str(payload.get("name") or "accommodation")),
        name=str(payload.get("name") or ""),
        type=AccommodationType(payload.get("type") or "hotel"),
        description=str(payload.get("description") or ""),
        short_description=str(payload.get("short_description") or ""),
        address=str(payload.get("address") or ""),
        base_price=float(payload.get("base_price") or 0),
        star_rating=float(payload.get("star_rating") or 0),
    )
    if payload.get("destination_id"):
        acc.destination_id = UUID(str(payload["destination_id"]))
    if payload.get("images"):
        acc.images = payload["images"]
    db.add(acc)
    await db.commit()
    return Message(message="اقامتگاه ایجاد شد.")


@router.patch("/services/accommodations/{accommodation_id}", summary="به‌روزرسانی اقامتگاه")
async def update_accommodation(
    accommodation_id: UUID,
    payload: dict,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    acc = await db.get(Accommodation, accommodation_id)
    if acc is None or acc.provider_id != (await _provider_for(db, user)).id:
        raise NotFoundError("اقامتگاه یافت نشد.")
    for field in ("is_active", "is_featured", "base_price", "star_rating", "guest_rating", "description"):
        if field in payload:
            setattr(acc, field, payload[field])
    if payload.get("images") is not None:
        acc.images = payload["images"]
    await db.commit()
    return Message(message="اقامتگاه به‌روزرسانی شد.")


@router.delete("/services/accommodations/{accommodation_id}", status_code=204, summary="حذف اقامتگاه")
async def delete_accommodation(
    accommodation_id: UUID,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    acc = await db.get(Accommodation, accommodation_id)
    if acc is None or acc.provider_id != (await _provider_for(db, user)).id:
        raise NotFoundError("اقامتگاه یافت نشد.")
    await db.delete(acc)
    await db.commit()


@router.post("/services/transport", status_code=201, summary="ایجاد سفر/حمل‌ونقل برای ارائه‌دهنده")
async def create_transport(
    payload: dict,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    provider = await _provider_for(db, user)
    offer = TransportOffer(
        provider_id=provider.id,
        transport_type=TransportType(payload.get("type") or "TRANSPORT"),
        code=str(payload.get("code") or f"TR-{provider.id.hex[:6].upper()}"),
        origin_name=str(payload.get("origin") or ""),
        destination_name=str(payload.get("destination") or ""),
        price=float(payload.get("price") or 0),
        seats_available=int(payload.get("seats_available") or 10),
        departure_at=datetime.fromisoformat(str(payload.get("departure_at"))),
    )
    db.add(offer)
    await db.commit()
    return Message(message="سفر ایجاد شد.")


@router.patch("/services/transport/{offer_id}", summary="به‌روزرسانی سفر")
async def update_transport(
    offer_id: UUID,
    payload: dict,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    offer = await db.get(TransportOffer, offer_id)
    if offer is None or offer.provider_id != (await _provider_for(db, user)).id:
        raise NotFoundError("سفرو یافت نشد.")
    for field in ("price", "seats_available", "is_active", "description"):
        if field in payload:
            setattr(offer, field, payload[field])
    await db.commit()
    return Message(message="سفرو به‌روزرسانی شد.")


@router.delete("/services/transport/{offer_id}", status_code=204, summary="حذف سفر")
async def delete_transport(
    offer_id: UUID,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    offer = await db.get(TransportOffer, offer_id)
    if offer is None or offer.provider_id != (await _provider_for(db, user)).id:
        raise NotFoundError("سفر یافت نشد.")
    await db.delete(offer)
    await db.commit()


def sluggify(text: str) -> str:
    import re
    text = text.strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text or "item"
