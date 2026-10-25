from __future__ import annotations

import secrets
from datetime import date, timedelta
from datetime import time as dt_time
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_optional_user
from app.core.errors import ForbiddenError, NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import (
    BookingStatus,
    Destination,
    Role,
    Trip,
    TripActivity,
    TripDay,
    TripStatus,
    User,
)
from app.db.session import get_db
from app.schemas.ai import PlanTripRequest
from app.schemas.booking import BookingSummary
from app.schemas.common import DestinationBrief, Message
from app.schemas.trip import (
    AutoPlanRequest,
    TripActivityCreate,
    TripActivityUpdate,
    TripCreate,
    TripOut,
    TripUpdate,
)
from app.services.planner import build_plan
from app.services.serializers import trip_out

router = APIRouter(prefix="/trips", tags=["Trips"])

TRIP_LOADS = (
    selectinload(Trip.destination),
    selectinload(Trip.origin),
    selectinload(Trip.days).selectinload(TripDay.activities),
    selectinload(Trip.bookings),
)


async def load_trip(db: AsyncSession, trip_id: UUID) -> Trip:
    trip = (
        await db.execute(
            select(Trip)
            .options(*TRIP_LOADS)
            .where(Trip.id == trip_id)
            # Refresh relationships that may already be cached on a
            # long-lived session (expire_on_commit=False).
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if trip is None:
        raise NotFoundError("سفر یافت نشد.")
    return trip


def _assert_owner(trip: Trip, user: User) -> None:
    if trip.user_id != user.id and user.role not in {Role.ADMIN, Role.SUPPORT_AGENT}:
        raise ForbiddenError()


async def _recalc(trip: Trip) -> None:
    activity_cost = sum(
        activity.cost for day in trip.days for activity in day.activities
    )
    booking_cost = sum(
        booking.total
        for booking in trip.bookings
        if booking.status in {BookingStatus.CONFIRMED, BookingStatus.COMPLETED}
    )
    trip.spent = activity_cost + booking_cost
    for day in trip.days:
        day.estimated_cost = sum(a.cost for a in day.activities)


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED, summary="ایجاد سفر")
async def create_trip(
    payload: TripCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    destination = await db.get(Destination, payload.destination_id)
    if destination is None:
        raise NotFoundError("مقصد یافت نشد.")
    if payload.origin_id:
        origin = await db.get(Destination, payload.origin_id)
        if origin is None:
            raise NotFoundError("مبدأ یافت نشد.")
    trip = Trip(
        user_id=user.id,
        destination_id=payload.destination_id,
        origin_id=payload.origin_id,
        title=payload.title or f"سفر به {destination.name}",
        start_date=payload.start_date,
        end_date=payload.end_date,
        travelers=payload.travelers,
        budget=payload.budget,
        interests=payload.interests,
        notes=payload.notes,
        status=TripStatus.UPCOMING,
        cover_image=destination.image_url,
    )
    db.add(trip)
    await db.flush()
    total_days = (payload.end_date - payload.start_date).days + 1
    for index in range(total_days):
        db.add(
            TripDay(
                trip_id=trip.id,
                day_number=index + 1,
                date=payload.start_date + timedelta(days=index),
                title=f"روز {index + 1}",
            )
        )
    await db.commit()
    trip = await load_trip(db, trip.id)
    return trip_out(trip)


@router.get("", response_model=Page[TripOut], summary="سفرهای من")
async def list_trips(
    tab: str = Query(default="all", pattern="^(all|upcoming|active|past)$"),
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[TripOut]:
    today = date.today()
    filters = [Trip.user_id == user.id]
    if tab == "upcoming":
        filters.append(Trip.start_date > today)
    elif tab == "active":
        filters.append(Trip.start_date <= today)
        filters.append(Trip.end_date >= today)
    elif tab == "past":
        filters.append(Trip.end_date < today)
    total = (await db.execute(select(func.count(Trip.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Trip)
            .options(*TRIP_LOADS)
            .where(*filters)
            .order_by(Trip.start_date.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().unique().all()
    items = []
    for trip in rows:
        await _recalc(trip)
        items.append(trip_out(trip))
    await db.commit()
    return Page.create(items, total, params)


@router.get("/public/{slug}", response_model=TripOut, summary="سفر عمومی")
async def public_trip(slug: str, db: AsyncSession = Depends(get_db)) -> TripOut:
    trip = (
        await db.execute(
            select(Trip)
            .options(*TRIP_LOADS)
            .where(Trip.share_slug == slug, Trip.is_public.is_(True))
        )
    ).scalar_one_or_none()
    if trip is None:
        raise NotFoundError("سفر عمومی یافت نشد.")
    data = trip_out(trip)
    return data.model_copy(update={"bookings": [], "notes": None})


@router.get("/{trip_id}", response_model=TripOut, summary="جزئیات سفر")
async def get_trip(
    trip_id: UUID,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    if not trip.is_public:
        if user is None:
            raise ForbiddenError()
        _assert_owner(trip, user)
    await _recalc(trip)
    await db.commit()
    return trip_out(trip)


@router.patch("/{trip_id}", response_model=TripOut, summary="ویرایش سفر")
async def update_trip(
    trip_id: UUID,
    payload: TripUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(trip, field, value)
    if trip.end_date < trip.start_date:
        raise ForbiddenError("تاریخ پایان نمی‌تواند قبل از شروع باشد.")
    await db.commit()
    trip = await load_trip(db, trip.id)
    return trip_out(trip)


@router.delete("/{trip_id}", response_model=Message, summary="حذف سفر")
async def delete_trip(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    await db.delete(trip)
    await db.commit()
    return Message(message="سفر حذف شد.")


@router.post("/{trip_id}/auto-plan", response_model=TripOut, summary="برنامه‌ریزی هوشمند سفر")
async def auto_plan(
    trip_id: UUID,
    payload: AutoPlanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    days = (trip.end_date - trip.start_date).days + 1
    plan = await build_plan(
        db,
        PlanTripRequest(
            destination_id=trip.destination_id,
            origin_id=trip.origin_id,
            days=days,
            budget=payload.budget or trip.budget,
            travelers=trip.travelers,
            interests=payload.interests or trip.interests,
            start_date=trip.start_date,
            pace=payload.pace,
        ),
    )
    if payload.replace_existing:
        await db.execute(delete(TripDay).where(TripDay.trip_id == trip.id))
        await db.flush()
        db.expire(trip, ["days"])
        for plan_day in plan.days:
            day = TripDay(
                trip_id=trip.id,
                day_number=plan_day.day_number,
                date=plan_day.date,
                title=plan_day.title,
                estimated_cost=plan_day.estimated_cost,
            )
            db.add(day)
            await db.flush()
            for activity in plan_day.activities:
                db.add(
                    TripActivity(
                        day_id=day.id,
                        activity_type=activity.activity_type,
                        title=activity.title,
                        description=activity.description,
                        start_time=dt_time.fromisoformat(activity.time),
                        end_time=dt_time.fromisoformat(activity.end_time)
                        if activity.end_time
                        else None,
                        location_name=activity.location_name,
                        latitude=activity.latitude,
                        longitude=activity.longitude,
                        cost=activity.cost,
                        entity_type=activity.entity_type,
                        entity_id=activity.entity_id,
                    )
                )
    if payload.budget:
        trip.budget = payload.budget
    trip.interests = payload.interests or trip.interests
    trip.budget_breakdown = plan.budget_breakdown
    await db.commit()
    trip = await load_trip(db, trip.id)
    await _recalc(trip)
    await db.commit()
    return trip_out(trip)


@router.post("/{trip_id}/publish", response_model=TripOut, summary="انتشار سفر در جامعه")
async def publish_trip(
    trip_id: UUID,
    is_public: bool = True,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    trip.is_public = is_public
    if is_public and not trip.share_slug:
        trip.share_slug = secrets.token_urlsafe(10)
    await db.commit()
    trip = await load_trip(db, trip.id)
    return trip_out(trip)


@router.post("/{trip_id}/activities", response_model=TripOut, summary="افزودن فعالیت به برنامه")
async def add_activity(
    trip_id: UUID,
    payload: TripActivityCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    day: TripDay | None = None
    if payload.day_id:
        day = next((d for d in trip.days if d.id == payload.day_id), None)
    elif payload.day_number:
        day = next((d for d in trip.days if d.day_number == payload.day_number), None)
    if day is None:
        raise NotFoundError("روز سفر یافت نشد.")
    activity = TripActivity(
        day_id=day.id,
        activity_type=payload.activity_type,
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        cost=payload.cost,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
    )
    db.add(activity)
    await db.commit()
    trip = await load_trip(db, trip.id)
    await _recalc(trip)
    await db.commit()
    return trip_out(trip)


@router.patch(
    "/{trip_id}/activities/{activity_id}",
    response_model=TripOut,
    summary="ویرایش فعالیت",
)
async def update_activity(
    trip_id: UUID,
    activity_id: UUID,
    payload: TripActivityUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    activity = await db.get(TripActivity, activity_id)
    if activity is None or not any(
        activity.id in [a.id for a in day.activities] for day in trip.days
    ):
        raise NotFoundError("فعالیت یافت نشد.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)
    await db.commit()
    trip = await load_trip(db, trip.id)
    await _recalc(trip)
    await db.commit()
    return trip_out(trip)


@router.delete(
    "/{trip_id}/activities/{activity_id}",
    response_model=TripOut,
    summary="حذف فعالیت",
)
async def delete_activity(
    trip_id: UUID,
    activity_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripOut:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    activity = await db.get(TripActivity, activity_id)
    if activity is None:
        raise NotFoundError("فعالیت یافت نشد.")
    await db.delete(activity)
    await db.commit()
    trip = await load_trip(db, trip.id)
    await _recalc(trip)
    await db.commit()
    return trip_out(trip)


@router.get("/{trip_id}/timeline", summary="تایم‌لاین سفر")
async def timeline(
    trip_id: UUID,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    trip = await load_trip(db, trip_id)
    if not trip.is_public:
        if user is None:
            raise ForbiddenError()
        _assert_owner(trip, user)
    events = []
    for day in trip.days:
        for activity in day.activities:
            events.append(
                {
                    "id": activity.id,
                    "date": day.date,
                    "day": day.day_number,
                    "time": activity.start_time,
                    "end_time": activity.end_time,
                    "title": activity.title,
                    "type": activity.activity_type.value,
                    "location": activity.location_name,
                    "cost": activity.cost,
                    "lat": activity.latitude,
                    "lng": activity.longitude,
                }
            )
    for booking in trip.bookings:
        if booking.status != BookingStatus.CONFIRMED:
            continue
        start = booking.check_in or booking.travel_date
        if start:
            events.append(
                {
                    "id": booking.id,
                    "date": start,
                    "day": None,
                    "time": "08:00",
                    "end_time": None,
                    "title": booking.title,
                    "type": booking.booking_type.value,
                    "location": "",
                    "cost": booking.total,
                }
            )
    events.sort(key=lambda item: (item["date"], item["time"]))
    return {
        "trip_id": trip.id,
        "title": trip.title,
        "destination": DestinationBrief.model_validate(trip.destination),
        "events": events,
    }


@router.get("/{trip_id}/booking-summary", response_model=list[BookingSummary], summary="رزروهای سفر")
async def booking_summary(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BookingSummary]:
    trip = await load_trip(db, trip_id)
    _assert_owner(trip, user)
    return [
        BookingSummary(
            id=b.id,
            code=b.code,
            booking_type=b.booking_type.value,
            status=b.status.value,
            title=b.title,
            total=b.total,
            currency=b.currency,
            travel_date=b.travel_date,
            check_in=b.check_in,
            check_out=b.check_out,
        )
        for b in trip.bookings
    ]
