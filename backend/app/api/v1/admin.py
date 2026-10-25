from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.api.v1.bookings import BOOKING_LOADS
from app.db.models import (
    Accommodation,
    AnalyticsEvent,
    Booking,
    BookingStatus,
    BookingType,
    Destination,
    Provider,
    Review,
    ReviewStatus,
    Role,
    TransportOffer,
    User,
)
from app.db.session import get_db
from app.schemas.admin import AdminStats, AdminUserOut, AdminUserUpdate
from app.schemas.booking import BookingOut
from app.schemas.common import Message
from app.schemas.engagement import ReviewOut
from app.services.serializers import booking_out, review_out

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_ROLES = (Role.ADMIN, Role.MARKETING_MANAGER, Role.CONTENT_MANAGER)


@router.get("/stats", response_model=AdminStats, summary="داشبورد مدیریت")
async def stats(
    _: User = Depends(require_roles(*ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AdminStats:
    now = datetime.now(UTC)
    month_ago = now - timedelta(days=30)
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    active_users = (
        await db.execute(
            select(func.count(User.id)).where(User.last_login_at >= month_ago)
        )
    ).scalar_one()
    new_users = (
        await db.execute(select(func.count(User.id)).where(User.created_at >= month_ago))
    ).scalar_one()
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar_one()
    bookings_30d = (
        await db.execute(select(func.count(Booking.id)).where(Booking.created_at >= month_ago))
    ).scalar_one()
    confirmed = (
        await db.execute(
            select(func.count(Booking.id)).where(
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
            )
        )
    ).scalar_one()
    cancelled = (
        await db.execute(
            select(func.count(Booking.id)).where(Booking.status == BookingStatus.CANCELLED)
        )
    ).scalar_one()
    revenue_total, revenue_30d = (
        await db.execute(
            select(
                func.coalesce(
                    func.sum(Booking.total).filter(
                        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(Booking.total).filter(
                        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
                        Booking.created_at >= month_ago,
                    ),
                    0,
                ),
            )
        )
    ).one()
    average_booking_value = int(revenue_total / confirmed) if confirmed else 0

    types = (
        await db.execute(
            select(Booking.booking_type, func.count(Booking.id)).group_by(Booking.booking_type)
        )
    ).all()
    bookings_by_type = {t.value: c for t, c in types}

    popular = (
        await db.execute(
            select(Destination.name, Destination.image_url, func.count(Booking.id).label("cnt"),
                   func.coalesce(func.sum(Booking.total), 0))
            .join(Booking, Booking.destination_id == Destination.id)
            .where(Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]))
            .group_by(Destination.id, Destination.name, Destination.image_url)
            .order_by(func.count(Booking.id).desc())
            .limit(5)
        )
    ).all()
    popular_destinations = [
        {"name": name, "image_url": image, "bookings": count, "revenue": int(revenue)}
        for name, image, count, revenue in popular
    ]
    transport_rows = (
        await db.execute(
            select(TransportOffer.type, func.count(Booking.id))
            .join(Booking, Booking.transport_offer_id == TransportOffer.id)
            .group_by(TransportOffer.type)
        )
    ).all()
    popular_transport = [{"type": t.value, "count": c} for t, c in transport_rows]

    recent = (
        await db.execute(
            select(Booking).options(*BOOKING_LOADS).order_by(Booking.created_at.desc()).limit(8)
        )
    ).scalars().all()

    revenue_rows = (
        await db.execute(
            select(Booking.created_at, Booking.total).where(
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
                Booking.created_at >= now - timedelta(days=180),
            )
        )
    ).all()
    by_month: dict[str, int] = {}
    for created_at, total in revenue_rows:
        key = created_at.strftime("%Y-%m")
        by_month[key] = by_month.get(key, 0) + int(total)
    revenue_series = [{"month": key, "revenue": value} for key, value in sorted(by_month.items())]

    event_rows = (
        await db.execute(
            select(AnalyticsEvent.name, func.count(AnalyticsEvent.id))
            .where(AnalyticsEvent.created_at >= month_ago)
            .group_by(AnalyticsEvent.name)
            .order_by(func.count(AnalyticsEvent.id).desc())
            .limit(8)
        )
    ).all()
    top_events = [{"name": name, "count": count} for name, count in event_rows]

    providers = (await db.execute(select(func.count(Provider.id)))).scalar_one()
    destinations = (await db.execute(select(func.count(Destination.id)))).scalar_one()
    reviews = (await db.execute(select(func.count(Review.id)))).scalar_one()
    pending_reviews = (
        await db.execute(
            select(func.count(Review.id)).where(Review.status == ReviewStatus.PENDING)
        )
    ).scalar_one()

    return AdminStats(
        total_users=total_users,
        active_users_30d=active_users,
        new_users_30d=new_users,
        total_bookings=total_bookings,
        bookings_30d=bookings_30d,
        confirmed_bookings=confirmed,
        cancelled_bookings=cancelled,
        revenue_total=int(revenue_total),
        revenue_30d=int(revenue_30d),
        average_booking_value=average_booking_value,
        conversion_rate=round(bookings_30d / new_users * 100, 1) if new_users else 0,
        cancellation_rate=round(cancelled / total_bookings * 100, 1) if total_bookings else 0,
        total_providers=providers,
        total_destinations=destinations,
        total_reviews=reviews,
        pending_reviews=pending_reviews,
        revenue_series=revenue_series,
        bookings_by_type=bookings_by_type,
        popular_destinations=popular_destinations,
        popular_transport=popular_transport,
        recent_bookings=[booking_out(b) for b in recent],
        top_events=top_events,
    )


@router.get("/users", response_model=Page[AdminUserOut], summary="مدیریت کاربران")
async def users(
    q: str | None = Query(default=None, max_length=100),
    role: str | None = None,
    is_active: bool | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[AdminUserOut]:
    filters = []
    if q:
        filters.append(or_(User.full_name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%"), User.phone.ilike(f"%{q}%")))
    if role:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))
    total = (await db.execute(select(func.count(User.id)).where(*filters))).scalar_one()
    bookings_count = (
        select(func.count(Booking.id))
        .where(Booking.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    total_spent = (
        select(func.coalesce(func.sum(Booking.total), 0))
        .where(
            Booking.user_id == User.id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
        )
        .correlate(User)
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(User, bookings_count, total_spent)
            .where(*filters)
            .order_by(User.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).all()
    items = [
        AdminUserOut(
            id=user.id,
            email=user.email,
            phone=user.phone,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            is_verified=user.is_verified,
            city=user.city,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            bookings_count=count,
            total_spent=int(spent),
        )
        for user, count, spent in rows
    ]
    return Page.create(items, total, params)


@router.patch("/users/{user_id}", response_model=AdminUserOut, summary="ویرایش دسترسی کاربر")
async def update_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    _: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("کاربر یافت نشد.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "role" and value:
            value = Role(value)
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return AdminUserOut(
        id=user.id, email=user.email, phone=user.phone, full_name=user.full_name,
        role=user.role.value, is_active=user.is_active, is_verified=user.is_verified,
        city=user.city, created_at=user.created_at, last_login_at=user.last_login_at,
    )


@router.get("/bookings", response_model=Page[BookingOut], summary="مدیریت رزروها")
async def bookings(
    status_filter: str | None = Query(default=None, alias="status"),
    booking_type: str | None = None,
    user_id: UUID | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(*ADMIN_ROLES, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> Page[BookingOut]:
    filters = []
    if status_filter:
        filters.append(Booking.status == status_filter)
    if booking_type:
        filters.append(Booking.booking_type == booking_type)
    if user_id:
        filters.append(Booking.user_id == user_id)
    total = (await db.execute(select(func.count(Booking.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Booking).options(*BOOKING_LOADS).where(*filters)
            .order_by(Booking.created_at.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    return Page.create([booking_out(b) for b in rows], total, params)


@router.get("/reviews", response_model=Page[ReviewOut], summary="مدیریت نظرات")
async def reviews(
    status_filter: str | None = Query(default=None, alias="status"),
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> Page[ReviewOut]:
    filters = []
    if status_filter:
        filters.append(Review.status == status_filter)
    total = (await db.execute(select(func.count(Review.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Review).options(selectinload(Review.user)).where(*filters)
            .order_by(Review.created_at.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    return Page.create([review_out(r) for r in rows], total, params)


@router.patch("/reviews/{review_id}", response_model=ReviewOut, summary="تأیید/رد نظر")
async def moderate_review(
    review_id: UUID,
    status_value: str = Query(alias="status", pattern="^(published|rejected|pending)$"),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> ReviewOut:
    review = (
        await db.execute(select(Review).options(selectinload(Review.user)).where(Review.id == review_id))
    ).scalar_one_or_none()
    if review is None:
        raise NotFoundError("نظر یافت نشد.")
    review.status = ReviewStatus(status_value)
    await db.commit()
    await db.refresh(review)
    return review_out(review)


@router.get("/providers", summary="فهرست ارائه‌دهندگان")
async def providers(
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    rows = (await db.execute(select(Provider).order_by(Provider.rating.desc()))).scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "type": p.provider_type,
            "rating": p.rating,
            "is_verified": p.is_verified,
            "is_active": p.is_active,
            "commission_rate": p.commission_rate,
        }
        for p in rows
    ]


@router.delete("/reviews/{review_id}", response_model=Message, summary="حذف نظر")
async def delete_review(
    review_id: UUID,
    _: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    review = await db.get(Review, review_id)
    if review is None:
        raise NotFoundError("نظر یافت نشد.")
    await db.delete(review)
    await db.commit()
    return Message(message="نظر حذف شد.")
