from __future__ import annotations

import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.db.models import Accommodation, Attraction, Booking, BookingStatus, BookingType, Room
from app.db.session import get_db
from app.schemas.accommodation import (
    AccommodationCard,
    AccommodationDetail,
    AccommodationSearchRequest,
    AccommodationSearchResponse,
    RoomOut,
)
from app.services.serializers import accommodation_card, accommodation_detail

router = APIRouter(prefix="/accommodations", tags=["Accommodation"])

BOOKABLE = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED]


async def _booked_rooms(
    db: AsyncSession, room_ids: list[UUID], check_in: date, check_out: date
) -> dict[UUID, int]:
    if not room_ids:
        return {}
    rows = await db.execute(
        select(Booking.room_id, func.coalesce(func.sum(Booking.rooms_count), 0))
        .where(
            Booking.room_id.in_(room_ids),
            Booking.booking_type == BookingType.ACCOMMODATION,
            Booking.status.in_(BOOKABLE),
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )
        .group_by(Booking.room_id)
    )
    return {room_id: int(count) for room_id, count in rows.all() if room_id}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


@router.post("/search", response_model=AccommodationSearchResponse, summary="جستجوی اقامتگاه")
async def search_accommodations(
    payload: AccommodationSearchRequest, db: AsyncSession = Depends(get_db)
) -> AccommodationSearchResponse:
    nights = (payload.check_out - payload.check_in).days
    stmt = (
        select(Accommodation)
        .options(selectinload(Accommodation.destination), selectinload(Accommodation.rooms))
        .where(
            Accommodation.destination_id == payload.destination_id,
            Accommodation.is_active.is_(True),
        )
    )
    if payload.types:
        stmt = stmt.where(Accommodation.type.in_(payload.types))
    if payload.min_price is not None:
        stmt = stmt.where(Accommodation.base_price >= payload.min_price)
    if payload.max_price is not None:
        stmt = stmt.where(Accommodation.base_price <= payload.max_price)
    if payload.min_rating is not None:
        stmt = stmt.where(Accommodation.guest_rating >= payload.min_rating)
    if payload.free_cancellation:
        stmt = stmt.where(Accommodation.free_cancellation.is_(True))
    if payload.breakfast:
        stmt = stmt.where(Accommodation.breakfast_included.is_(True))
    items = list((await db.execute(stmt)).scalars().unique().all())
    room_ids = [room.id for item in items for room in item.rooms]
    booked = await _booked_rooms(db, room_ids, payload.check_in, payload.check_out)
    required_per_room = math.ceil(payload.guests / payload.rooms)

    cards: list[AccommodationCard] = []
    for item in items:
        if payload.amenities and not set(payload.amenities).issubset(set(item.amenities)):
            continue
        eligible = [
            room
            for room in item.rooms
            if room.is_active
            and room.capacity >= required_per_room
            and room.total_rooms - booked.get(room.id, 0) >= payload.rooms
        ]
        if not eligible:
            continue
        min_price = min(r.price_per_night for r in eligible)
        cards.append(
            accommodation_card(
                item,
                nights=nights,
                min_price=min_price,
                rooms_available=sum(
                    r.total_rooms - booked.get(r.id, 0) for r in eligible
                ),
            )
        )
    if payload.sort == "cheapest":
        cards.sort(key=lambda c: c.min_price or 0)
    elif payload.sort == "rating":
        cards.sort(key=lambda c: c.guest_rating, reverse=True)
    elif payload.sort == "distance":
        cards.sort(key=lambda c: c.distance_to_center_km)
    else:
        cards.sort(key=lambda c: (c.is_featured, c.guest_rating, -(c.min_price or 0)), reverse=True)

    total = len(cards)
    start = (payload.page - 1) * payload.page_size
    paged = cards[start : start + payload.page_size]
    prices = [c.min_price or c.base_price for c in cards]
    return AccommodationSearchResponse(
        items=paged,
        total=total,
        page=payload.page,
        page_size=payload.page_size,
        pages=(total + payload.page_size - 1) // payload.page_size if total else 0,
        meta={
            "nights": nights,
            "min_price": min(prices) if prices else None,
            "max_price": max(prices) if prices else None,
            "check_in": payload.check_in,
            "check_out": payload.check_out,
        },
    )


@router.get("", response_model=list[AccommodationCard], summary="فهرست اقامتگاه‌ها")
async def list_accommodations(
    destination_id: UUID | None = None,
    featured: bool | None = None,
    limit: int = Query(default=12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[AccommodationCard]:
    stmt = (
        select(Accommodation)
        .options(selectinload(Accommodation.destination))
        .where(Accommodation.is_active.is_(True))
    )
    if destination_id:
        stmt = stmt.where(Accommodation.destination_id == destination_id)
    if featured is not None:
        stmt = stmt.where(Accommodation.is_featured.is_(featured))
    rows = (
        await db.execute(
            stmt.order_by(Accommodation.guest_rating.desc()).limit(limit)
        )
    ).scalars().all()
    return [accommodation_card(a) for a in rows]


@router.get(
    "/slug/{slug}",
    response_model=AccommodationDetail,
    summary="جزئیات اقامتگاه با اسلاگ",
)
async def get_accommodation_by_slug(
    slug: str,
    check_in: date | None = None,
    check_out: date | None = None,
    guests: int = Query(default=1, ge=1, le=20),
    rooms_count: int = Query(default=1, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
) -> AccommodationDetail:
    accommodation_id = (
        await db.execute(select(Accommodation.id).where(Accommodation.slug == slug))
    ).scalar_one_or_none()
    if accommodation_id is None:
        raise NotFoundError("اقامتگاه یافت نشد.")
    return await get_accommodation(accommodation_id, check_in, check_out, guests, rooms_count, db)


@router.get("/{accommodation_id}", response_model=AccommodationDetail, summary="جزئیات اقامتگاه")
async def get_accommodation(
    accommodation_id: UUID,
    check_in: date | None = None,
    check_out: date | None = None,
    guests: int = Query(default=1, ge=1, le=20),
    rooms_count: int = Query(default=1, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
) -> AccommodationDetail:
    item = (
        await db.execute(
            select(Accommodation)
            .options(selectinload(Accommodation.destination), selectinload(Accommodation.rooms))
            .where(Accommodation.id == accommodation_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("اقامتگاه یافت نشد.")

    booked: dict[UUID, int] = {}
    if check_in and check_out and check_out > check_in:
        booked = await _booked_rooms(db, [r.id for r in item.rooms], check_in, check_out)
    room_objs = []
    for room in item.rooms:
        if not room.is_active:
            continue
        data = RoomOut.model_validate(room)
        data = data.model_copy(update={"rooms_left": room.total_rooms - booked.get(room.id, 0)})
        room_objs.append(data)
    detail = accommodation_detail(item)
    nearby_rows = (
        await db.execute(
            select(Attraction).where(Attraction.destination_id == item.destination_id)
        )
    ).scalars().all()
    nearby = sorted(
        (
            {
                "id": a.id,
                "name": a.name,
                "image_url": a.image_url,
                "distance_km": round(_haversine_km(item.latitude, item.longitude, a.latitude, a.longitude), 2),
                "rating": a.rating,
            }
            for a in nearby_rows
        ),
        key=lambda x: x["distance_km"],
    )[:4]
    return detail.model_copy(update={"rooms": room_objs, "nearby_attractions": nearby})


@router.get("/{accommodation_id}/rooms", response_model=list[RoomOut], summary="اتاق‌ها و ظرفیت")
async def get_rooms(
    accommodation_id: UUID,
    check_in: date | None = None,
    check_out: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[RoomOut]:
    rooms = (
        await db.execute(
            select(Room).where(Room.accommodation_id == accommodation_id, Room.is_active.is_(True))
        )
    ).scalars().all()
    if not rooms:
        raise NotFoundError("اتاقی برای این اقامتگاه ثبت نشده است.")
    booked = {}
    if check_in and check_out and check_out > check_in:
        booked = await _booked_rooms(db, [r.id for r in rooms], check_in, check_out)
    return [
        RoomOut.model_validate(r).model_copy(
            update={"rooms_left": r.total_rooms - booked.get(r.id, 0)}
        )
        for r in rooms
    ]


@router.get("/{accommodation_id}/availability", summary="بررسی ظرفیت")
async def check_availability(
    accommodation_id: UUID,
    check_in: date = Query(),
    check_out: date = Query(),
    rooms_count: int = Query(default=1, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if check_out <= check_in:
        raise NotFoundError("بازه تاریخ نامعتبر است.")
    rooms = (
        await db.execute(select(Room).where(Room.accommodation_id == accommodation_id))
    ).scalars().all()
    booked = await _booked_rooms(db, [r.id for r in rooms], check_in, check_out)
    available = [
        {"room_id": r.id, "name": r.name, "price": r.price_per_night,
         "rooms_left": r.total_rooms - booked.get(r.id, 0)}
        for r in rooms
        if r.is_active and r.total_rooms - booked.get(r.id, 0) >= rooms_count
    ]
    return {"available": bool(available), "rooms": available, "nights": (check_out - check_in).days}
