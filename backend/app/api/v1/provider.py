from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.errors import BadRequestError, NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import (
    Accommodation,
    AccommodationType,
    Booking,
    BookingStatus,
    Experience,
    NotificationType,
    Provider,
    Review,
    ReviewStatus,
    Role,
    TransportOffer,
    TransportType,
    User,
)
from app.db.session import get_db
from app.schemas.admin import ProviderDashboard
from app.schemas.booking import BookingOut
from app.schemas.common import Message
from app.schemas.engagement import ReviewOut
from app.services.notifications import notify
from app.services.serializers import booking_out, review_out

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


async def _provider_booking_filters(db: AsyncSession, user: User) -> list:
    provider = await _provider_for(db, user)
    hotel_ids = list(
        (await db.execute(select(Accommodation.id).where(Accommodation.provider_id == provider.id))).scalars().all()
    )
    offer_ids = list(
        (await db.execute(select(TransportOffer.id).where(TransportOffer.provider_id == provider.id))).scalars().all()
    )
    filters = []
    if hotel_ids:
        filters.append(Booking.accommodation_id.in_(hotel_ids))
    if offer_ids:
        filters.append(Booking.transport_offer_id.in_(offer_ids))
    return provider, filters


@router.get("/bookings", response_model=Page[BookingOut], summary="رزروهای ارائه‌دهنده")
async def provider_bookings(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=100),
    params: PageParams = Depends(),
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[BookingOut]:
    _, filters = await _provider_booking_filters(db, user)
    if status_filter:
        filters.append(Booking.status == status_filter)
    if q:
        filters.append(Booking.title.ilike(f"%{q}%"))
    total = (await db.execute(select(func.count(Booking.id)).where(*filters))).scalar_one() if filters else 0
    rows = (
        list(
            (
                await db.execute(
                    select(Booking)
                    .options(
                        selectinload(Booking.passengers),
                        selectinload(Booking.payments),
                        selectinload(Booking.destination),
                        selectinload(Booking.accommodation),
                        selectinload(Booking.experience),
                        selectinload(Booking.transport_offer),
                    )
                    .where(*filters)
                    .order_by(Booking.created_at.desc())
                    .offset(params.offset)
                    .limit(params.limit)
                )
            ).scalars().all()
        )
        if filters
        else []
    )
    return Page.create([booking_out(b) for b in rows], total, params)


ALLOWED_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    BookingStatus.PENDING: {BookingStatus.CONFIRMED, BookingStatus.CANCELLED},
    BookingStatus.CONFIRMED: {BookingStatus.COMPLETED, BookingStatus.CANCELLED},
}


@router.patch("/bookings/{booking_id}", response_model=BookingOut, summary="تغییر وضعیت رزرو")
async def update_booking_status(
    booking_id: UUID,
    payload: dict,
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> BookingOut:
    booking = (
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
            .where(Booking.id == booking_id)
        )
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("رزرو یافت نشد.")
    provider = await _provider_for(db, user)
    owned_hotel = booking.accommodation_id and (
        await db.execute(
            select(Accommodation.id).where(
                Accommodation.id == booking.accommodation_id,
                Accommodation.provider_id == provider.id,
            )
        )
    ).scalar_one_or_none()
    owned_offer = booking.transport_offer_id and (
        await db.execute(
            select(TransportOffer.id).where(
                TransportOffer.id == booking.transport_offer_id,
                TransportOffer.provider_id == provider.id,
            )
        )
    ).scalar_one_or_none()
    if not owned_hotel and not owned_offer:
        raise NotFoundError("رزرو یافت نشد.")

    new_status = BookingStatus(str(payload.get("status", "")))
    if new_status not in ALLOWED_TRANSITIONS.get(booking.status, set()):
        raise BadRequestError("این تغییر وضعیت برای رزرو مجاز نیست.")
    booking.status = new_status
    if new_status == BookingStatus.CONFIRMED:
        booking.confirmed_at = datetime.now(UTC)
    if new_status == BookingStatus.CANCELLED:
        booking.cancelled_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(booking)
    await notify(
        db,
        booking.user_id,
        "به‌روزرسانی رزرو",
        f"وضعیت رزرو «{booking.title}» به «{new_status.value}» تغییر کرد.",
        notification_type=NotificationType.BOOKING,
        data={"booking_id": str(booking.id), "status": new_status.value},
    )
    await db.commit()
    return booking_out(booking)


@router.get("/reviews", response_model=Page[ReviewOut], summary="نظرات خدمات ارائه‌دهنده")
async def provider_reviews(
    params: PageParams = Depends(),
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[ReviewOut]:
    provider = await _provider_for(db, user)
    hotel_ids = list(
        (await db.execute(select(Accommodation.id).where(Accommodation.provider_id == provider.id))).scalars().all()
    )
    offer_ids = list(
        (await db.execute(select(TransportOffer.id).where(TransportOffer.provider_id == provider.id))).scalars().all()
    )
    experience_ids = list(
        (await db.execute(select(Experience.id).where(Experience.provider_id == provider.id))).scalars().all()
    )
    entity_ids = hotel_ids + offer_ids + experience_ids
    total = 0
    rows: list[Review] = []
    if entity_ids:
        total = (
            await db.execute(
                select(func.count(Review.id)).where(
                    Review.entity_id.in_(entity_ids),
                    Review.status == ReviewStatus.PUBLISHED,
                )
            )
        ).scalar_one()
        rows = list(
            (
                await db.execute(
                    select(Review)
                    .options(selectinload(Review.user))
                    .where(Review.entity_id.in_(entity_ids), Review.status == ReviewStatus.PUBLISHED)
                    .order_by(Review.created_at.desc())
                    .offset(params.offset)
                    .limit(params.limit)
                )
            ).scalars().all()
        )
    return Page.create([review_out(r) for r in rows], total, params)


@router.get("/financial", summary="گزارش مالی ارائه‌دهنده")
async def provider_financial(
    user: User = Depends(require_roles(Role.PROVIDER, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    provider = await _provider_for(db, user)
    _, filters = await _provider_booking_filters(db, user)
    if not filters:
        return {"rows": [], "totals": {"revenue": 0, "commission": 0, "net": 0, "count": 0}}
    rows_db = (
        await db.execute(
            select(Booking)
            .options(selectinload(Booking.accommodation), selectinload(Booking.transport_offer))
            .where(*filters, Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]))
            .order_by(Booking.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    rows = [
        {
            "id": str(b.id),
            "code": b.code,
            "title": b.title,
            "date": (b.travel_date or b.check_in or b.created_at.date()).isoformat(),
            "total": b.total,
            "commission": int(b.total * provider.commission_rate / 100),
            "net": b.total - int(b.total * provider.commission_rate / 100),
        }
        for b in rows_db
    ]
    revenue = sum(r["total"] for r in rows)
    commission = sum(r["commission"] for r in rows)
    return {
        "rows": rows,
        "totals": {"revenue": revenue, "commission": commission, "net": revenue - commission, "count": len(rows)},
    }


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
        raise NotFoundError("سفر یافت نشد.")
    for field in ("price", "seats_available", "is_active", "description"):
        if field in payload:
            setattr(offer, field, payload[field])
    await db.commit()
    return Message(message="سفر به‌روزرسانی شد.")


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
