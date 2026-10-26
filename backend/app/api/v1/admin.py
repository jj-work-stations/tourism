from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.bookings import BOOKING_LOADS
from app.core.deps import require_roles
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import (
    Accommodation,
    AnalyticsEvent,
    Attraction,
    AuditLog,
    Booking,
    BookingStatus,
    Campaign,
    Coupon,
    CouponType,
    Destination,
    Experience,
    Notification,
    NotificationType,
    Payment,
    PaymentStatus,
    Provider,
    Restaurant,
    Review,
    ReviewStatus,
    Role,
    SupportTicket,
    TransportOffer,
    User,
)
from app.db.session import get_db
from app.schemas.admin import (
    AdminStats,
    AdminUserOut,
    AdminUserUpdate,
    AuditLogOut,
    SystemSettings,
)
from app.schemas.booking import BookingOut
from app.schemas.common import Message
from app.schemas.engagement import ReviewOut
from app.services.notifications import notify
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
    db.add(
        AuditLog(
            user_id=_.id,
            action="user.update",
            entity_type="user",
            entity_id=user.id,
            data=payload.model_dump(exclude_unset=True),
        )
    )
    await db.commit()
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
    db.add(
        AuditLog(
            user_id=_.id,
            action="review.moderation",
            entity_type="review",
            entity_id=review.id,
            data={"status": status_value, "rating": review.rating},
        )
    )
    await db.commit()
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
    log_data = {"status": review.status.value, "rating": review.rating}
    await db.delete(review)
    db.add(
        AuditLog(
            user_id=_.id,
            action="review.delete",
            entity_type="review",
            entity_id=review_id,
            data=log_data,
        )
    )
    await db.commit()
    return Message(message="نظر حذف شد.")


# ───────────────────────────── Content Management ─────────────────────────────


@router.get("/campaigns", summary="لیست کمپین‌ها")
async def list_campaigns(
    is_active: bool | None = Query(default=None),
    placement: str | None = Query(default=None),
    _: User = Depends(require_roles(Role.ADMIN, Role.MARKETING_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    filters = []
    if is_active is not None:
        filters.append(Campaign.is_active.is_(is_active))
    if placement:
        filters.append(Campaign.placement == placement)
    rows = (
        await db.execute(
            select(Campaign).where(*filters).order_by(Campaign.sort_order, Campaign.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "subtitle": c.subtitle,
            "image_url": c.image_url,
            "cta_label": c.cta_label,
            "cta_url": c.cta_url,
            "badge": c.badge,
            "placement": c.placement,
            "is_active": c.is_active,
            "sort_order": c.sort_order,
            "starts_at": c.starts_at,
            "ends_at": c.ends_at,
            "created_at": c.created_at,
        }
        for c in rows
    ]


@router.post("/campaigns", summary="ایجاد/به‌روزرسانی کمپین")
async def upsert_campaign(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.MARKETING_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    campaign_id = payload.get("id")
    if campaign_id:
        campaign = await db.get(Campaign, campaign_id)
        if campaign is None:
            raise NotFoundError("کمپین یافت نشد.")
    else:
        campaign = Campaign()
        db.add(campaign)
    for field in ("title", "subtitle", "image_url", "cta_label", "cta_url", "badge", "placement", "is_active", "sort_order"):
        if field in payload:
            setattr(campaign, field, payload[field])
    if payload.get("starts_at"):
        campaign.starts_at = datetime.fromisoformat(payload["starts_at"])
    if payload.get("ends_at"):
        campaign.ends_at = datetime.fromisoformat(payload["ends_at"])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="campaign.upsert",
            entity_type="campaign",
            entity_id=campaign.id,
            data={"title": campaign.title, "updated": bool(campaign_id)},
        )
    )
    await db.commit()
    return Message(message="کمپین ذخیره شد.")


@router.get("/destinations", summary="لیست مقصدها")
async def list_destinations(
    q: str | None = Query(default=None, max_length=100),
    is_featured: bool | None = Query(default=None),
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if q:
        filters.append(or_(Destination.name.ilike(f"%{q}%"), Destination.name_local.ilike(f"%{q}%")))
    if is_featured is not None:
        filters.append(Destination.is_featured.is_(is_featured))
    total = (await db.execute(select(func.count(Destination.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Destination).where(*filters).order_by(Destination.popularity.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    items = [
        {
            "id": d.id, "slug": d.slug, "name": d.name, "name_local": d.name_local,
            "country": d.country, "image_url": d.image_url, "is_featured": d.is_featured,
            "popularity": d.popularity, "avg_daily_budget": d.avg_daily_budget,
            "best_season": d.best_season, "tags": d.tags, "description": d.description,
        }
        for d in rows
    ]
    return Page.create(items, total, params)


@router.post("/destinations", summary="ایجاد/به‌روزرسانی مقصد")
async def upsert_destination(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    dest_id = payload.get("id")
    if dest_id:
        dest = await db.get(Destination, dest_id)
        if dest is None:
            raise NotFoundError("مقصد یافت نشد.")
    else:
        dest = Destination()
        db.add(dest)
        dest.slug = sluggify(payload.get("name", ""))
    for field in ("name", "name_local", "country", "region", "description", "short_description",
                  "image_url", "gallery", "latitude", "longitude", "best_season", "avg_daily_budget",
                  "tags", "is_featured", "popularity"):
        if field in payload:
            setattr(dest, field, payload[field])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="content.upsert",
            entity_type="destination",
            entity_id=dest.id,
            data={"name": dest.name, "updated": bool(dest_id)},
        )
    )
    await db.commit()
    return Message(message="مقصد ذخیره شد.")


@router.get("/accommodations", summary="لیست اقامتگاه‌ها")
async def list_accommodations(
    q: str | None = Query(default=None, max_length=100),
    destination_id: UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    is_featured: bool | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if q:
        filters.append(Accommodation.name.ilike(f"%{q}%"))
    if destination_id:
        filters.append(Accommodation.destination_id == destination_id)
    if is_active is not None:
        filters.append(Accommodation.is_active.is_(is_active))
    if is_featured is not None:
        filters.append(Accommodation.is_featured.is_(is_featured))
    total = (await db.execute(select(func.count(Accommodation.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Accommodation).options(selectinload(Accommodation.destination)).where(*filters)
            .order_by(Accommodation.star_rating.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    items = [
        {
            "id": a.id, "slug": a.slug, "name": a.name, "type": a.type.value,
            "destination_id": a.destination_id, "destination_name": a.destination.name if a.destination else None,
            "star_rating": a.star_rating, "guest_rating": a.guest_rating, "base_price": a.base_price,
            "is_active": a.is_active, "is_featured": a.is_featured, "review_count": a.review_count,
            "images": a.images, "is_verified": a.provider_id is not None,
        }
        for a in rows
    ]
    return Page.create(items, total, params)


@router.post("/accommodations", summary="ایجاد/به‌روزرسانی اقامتگاه")
async def upsert_accommodation(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    acc_id = payload.get("id")
    if acc_id:
        acc = await db.get(Accommodation, acc_id)
        if acc is None:
            raise NotFoundError("اقامتگاه یافت نشد.")
    else:
        acc = Accommodation()
        db.add(acc)
        if payload.get("name"):
            acc.slug = sluggify(payload["name"])
    for field in ("name", "destination_id", "provider_id", "type", "description", "short_description",
                  "address", "latitude", "longitude", "star_rating", "gallery", "video_url",
                  "amenities", "rules", "policies", "cancellation_policy", "breakfast_included",
                  "free_cancellation", "base_price", "distance_to_center_km", "is_featured", "is_active"):
        if field in payload:
            setattr(acc, field, payload[field])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="content.upsert",
            entity_type="accommodation",
            entity_id=acc.id,
            data={"name": acc.name, "updated": bool(acc_id)},
        )
    )
    await db.commit()
    return Message(message="اقامتگاه ذخیره شد.")


@router.get("/attractions", summary="لیست جاذبه‌ها")
async def list_attractions(
    q: str | None = Query(default=None, max_length=100),
    category: str | None = None,
    destination_id: UUID | None = None,
    is_featured: bool | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if q:
        filters.append(Attraction.name.ilike(f"%{q}%"))
    if category:
        filters.append(Attraction.category == category)
    if destination_id:
        filters.append(Attraction.destination_id == destination_id)
    if is_featured is not None:
        filters.append(Attraction.is_featured.is_(is_featured))
    total = (await db.execute(select(func.count(Attraction.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Attraction).options(selectinload(Attraction.destination)).where(*filters)
            .order_by(Attraction.rating.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    items = [
        {
            "id": a.id, "slug": a.slug, "name": a.name, "destination_id": a.destination_id,
            "destination_name": a.destination.name if a.destination else None,
            "category": a.category.value, "image_url": a.image_url, "rating": a.rating,
            "review_count": a.review_count, "ticket_price": a.ticket_price,
            "is_featured": a.is_featured, "is_active": a.is_active, "description": a.description,
        }
        for a in rows
    ]
    return Page.create(items, total, params)


@router.post("/attractions", summary="ایجاد/به‌روزرسانی جاذبه")
async def upsert_attraction(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    attr_id = payload.get("id")
    if attr_id:
        attr = await db.get(Attraction, attr_id)
        if attr is None:
            raise NotFoundError("جاذبه یافت نشد.")
    else:
        attr = Attraction()
        db.add(attr)
        if payload.get("name"):
            attr.slug = sluggify(payload["name"])
    for field in ("name", "destination_id", "category", "description", "image_url", "gallery",
                  "latitude", "longitude", "address", "opening_hours", "ticket_price",
                  "suggested_visit_minutes", "is_featured", "is_active"):
        if field in payload:
            setattr(attr, field, payload[field])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="content.upsert",
            entity_type="attraction",
            entity_id=attr.id,
            data={"name": attr.name, "updated": bool(attr_id)},
        )
    )
    await db.commit()
    return Message(message="جاذبه ذخیره شد.")


@router.get("/experiences", summary="لیست تجربه‌ها")
async def list_experiences(
    q: str | None = Query(default=None, max_length=100),
    category: str | None = None,
    destination_id: UUID | None = None,
    is_featured: bool | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if q:
        filters.append(Experience.name.ilike(f"%{q}%"))
    if category:
        filters.append(Experience.category == category)
    if destination_id:
        filters.append(Experience.destination_id == destination_id)
    if is_featured is not None:
        filters.append(Experience.is_featured.is_(is_featured))
    total = (await db.execute(select(func.count(Experience.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Experience).options(selectinload(Experience.destination)).where(*filters)
            .order_by(Experience.rating.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    items = [
        {
            "id": e.id, "slug": e.slug, "name": e.name, "destination_id": e.destination_id,
            "destination_name": e.destination.name if e.destination else None,
            "category": e.category.value, "image_url": e.image_url, "rating": e.rating,
            "review_count": e.review_count, "price": e.price, "duration_minutes": e.duration_minutes,
            "is_featured": e.is_featured, "is_active": e.is_active, "description": e.description,
        }
        for e in rows
    ]
    return Page.create(items, total, params)


@router.post("/experiences", summary="ایجاد/به‌روزرسانی تجربه")
async def upsert_experience(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    exp_id = payload.get("id")
    if exp_id:
        exp = await db.get(Experience, exp_id)
        if exp is None:
            raise NotFoundError("تجربه یافت نشد.")
    else:
        exp = Experience()
        db.add(exp)
        if payload.get("name"):
            exp.slug = sluggify(payload["name"])
    for field in ("name", "destination_id", "category", "description", "image_url", "gallery",
                  "duration_minutes", "price", "max_participants", "meeting_point",
                  "latitude", "longitude", "includes", "languages", "guide_name",
                  "is_featured", "is_active"):
        if field in payload:
            setattr(exp, field, payload[field])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="content.upsert",
            entity_type="experience",
            entity_id=exp.id,
            data={"name": exp.name, "updated": bool(exp_id)},
        )
    )
    await db.commit()
    return Message(message="تجربه ذخیره شد.")


@router.get("/restaurants", summary="لیست رستوران‌ها")
async def list_restaurants(
    q: str | None = Query(default=None, max_length=100),
    destination_id: UUID | None = None,
    is_featured: bool | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if q:
        filters.append(Restaurant.name.ilike(f"%{q}%"))
    if destination_id:
        filters.append(Restaurant.destination_id == destination_id)
    if is_featured is not None:
        filters.append(Restaurant.is_featured.is_(is_featured))
    total = (await db.execute(select(func.count(Restaurant.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Restaurant).options(selectinload(Restaurant.destination)).where(*filters)
            .order_by(Restaurant.rating.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    items = [
        {
            "id": r.id, "slug": r.slug, "name": r.name, "destination_id": r.destination_id,
            "destination_name": r.destination.name if r.destination else None,
            "cuisine": r.cuisine, "average_price": r.average_price, "rating": r.rating,
            "review_count": r.review_count, "image_url": r.image_url, "is_featured": r.is_featured,
            "is_active": r.is_active, "description": r.description,
        }
        for r in rows
    ]
    return Page.create(items, total, params)


@router.post("/restaurants", summary="ایجاد/به‌روزرسانی رستوران")
async def upsert_restaurant(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    rest_id = payload.get("id")
    if rest_id:
        rest = await db.get(Restaurant, rest_id)
        if rest is None:
            raise NotFoundError("رستوران یافت نشد.")
    else:
        rest = Restaurant()
        db.add(rest)
        if payload.get("name"):
            rest.slug = sluggify(payload["name"])
    for field in ("name", "destination_id", "description", "image_url", "gallery", "cuisine",
                  "price_range", "average_price", "address", "latitude", "longitude",
                  "opening_hours", "menu", "signature_dishes", "reservation_enabled",
                  "is_featured", "is_active"):
        if field in payload:
            setattr(rest, field, payload[field])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="content.upsert",
            entity_type="restaurant",
            entity_id=rest.id,
            data={"name": rest.name, "updated": bool(rest_id)},
        )
    )
    await db.commit()
    return Message(message="رستوران ذخیره شد.")


@router.get("/settings", response_model=SystemSettings, summary="تنظیمات سیستم")
async def get_settings(_: User = Depends(require_roles(Role.ADMIN))) -> SystemSettings:
    return SystemSettings()


@router.put("/settings", response_model=Message, summary="به‌روزرسانی تنظیمات")
async def put_settings(
    payload: SystemSettings,
    _: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    settings = get_app_settings()
    changed = payload.model_dump(exclude_unset=True)
    settings.update(changed)
    save_app_settings(settings)
    db.add(
        AuditLog(
            user_id=_.id,
            action="settings.update",
            entity_type="settings",
            entity_id=None,
            data={"fields": sorted(changed.keys())},
        )
    )
    await db.commit()
    return Message(message="تنظیمات ذخیره شد.")


@router.get("/audit", response_model=Page[AuditLogOut], summary="لاگ‌های فعالیت")
async def audit(
    action: str | None = Query(default=None),
    entity_type: str | None = None,
    user_id: UUID | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Page[AuditLogOut]:
    filters = []
    if action:
        filters.append(AuditLog.action == action)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    total = (await db.execute(select(func.count(AuditLog.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(select(AuditLog).where(*filters).order_by(AuditLog.created_at.desc()).offset(params.offset).limit(params.limit))
    ).scalars().all()
    return Page.create([AuditLogOut.model_validate(r) for r in rows], total, params)


def sluggify(text: str) -> str:
    import re
    text = text.strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text or "item"


from app.core.settings_store import get_app_settings, save_app_settings  # noqa: E402

# ───────────────────────────── Coupons ─────────────────────────────


@router.get("/coupons", summary="لیست کدهای تخفیف")
async def list_coupons(
    is_active: bool | None = Query(default=None),
    _: User = Depends(require_roles(Role.ADMIN, Role.MARKETING_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    filters = []
    if is_active is not None:
        filters.append(Coupon.is_active.is_(is_active))
    rows = (
        await db.execute(select(Coupon).where(*filters).order_by(Coupon.created_at.desc()))
    ).scalars().all()
    return [
        {
            "id": c.id,
            "code": c.code,
            "title": c.title,
            "coupon_type": c.coupon_type.value,
            "value": c.value,
            "min_amount": c.min_amount,
            "max_discount": c.max_discount,
            "usage_limit": c.usage_limit,
            "used_count": c.used_count,
            "per_user_limit": c.per_user_limit,
            "valid_from": c.valid_from,
            "valid_to": c.valid_to,
            "is_active": c.is_active,
        }
        for c in rows
    ]


@router.post("/coupons", summary="ایجاد/به‌روزرسانی کد تخفیف")
async def upsert_coupon(
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.MARKETING_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    coupon_id = payload.get("id")
    if coupon_id:
        coupon = await db.get(Coupon, coupon_id)
        if coupon is None:
            raise NotFoundError("کد تخفیف یافت نشد.")
    else:
        code = str(payload.get("code") or "").strip().upper()
        if not code:
            raise NotFoundError("کد تخفیف الزامی است.")
        existing = (
            await db.execute(select(Coupon).where(Coupon.code == code))
        ).scalar_one_or_none()
        if existing is not None:
            raise ConflictError("این کد تخفیف قبلاً ثبت شده است.")
        coupon = Coupon(code=code)
        db.add(coupon)
    for field in ("code", "title", "description", "min_amount", "max_discount", "usage_limit", "per_user_limit", "is_active"):
        if field in payload:
            setattr(coupon, field, payload[field])
    if payload.get("coupon_type"):
        coupon.coupon_type = CouponType(payload["coupon_type"])
    if payload.get("value") is not None:
        coupon.value = int(payload["value"])
    if payload.get("valid_from"):
        coupon.valid_from = datetime.fromisoformat(payload["valid_from"])
    if payload.get("valid_to"):
        coupon.valid_to = datetime.fromisoformat(payload["valid_to"])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="coupon.upsert",
            entity_type="coupon",
            entity_id=coupon.id,
            data={"code": coupon.code, "updated": bool(coupon_id)},
        )
    )
    await db.commit()
    return Message(message="کد تخفیف ذخیره شد.")


@router.patch("/coupons/{coupon_id}", summary="فعال/غیرفعال‌سازی کد تخفیف")
async def toggle_coupon(
    coupon_id: UUID,
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.MARKETING_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    coupon = await db.get(Coupon, coupon_id)
    if coupon is None:
        raise NotFoundError("کد تخفیف یافت نشد.")
    if "is_active" in payload:
        coupon.is_active = bool(payload["is_active"])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="coupon.toggle",
            entity_type="coupon",
            entity_id=coupon.id,
            data={"code": coupon.code, "is_active": coupon.is_active},
        )
    )
    await db.commit()
    return Message(message="کد تخفیف به‌روزرسانی شد.")


# ───────────────────────────── Payments ─────────────────────────────


@router.get("/payments", response_model=Page[dict], summary="لیست پرداخت‌ها")
async def list_payments(
    status_filter: str | None = Query(default=None, alias="status"),
    params: PageParams = Depends(),
    _: User = Depends(require_roles(*ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if status_filter:
        filters.append(Payment.status == status_filter)
    total = (await db.execute(select(func.count(Payment.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Payment)
            .options(selectinload(Payment.booking))
            .where(*filters)
            .order_by(Payment.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    items = [
        {
            "id": p.id,
            "reference": p.reference,
            "booking_id": p.booking_id,
            "booking_code": p.booking.code if p.booking else None,
            "amount": p.amount,
            "currency": p.currency,
            "method": p.method.value,
            "status": p.status.value,
            "gateway": p.gateway,
            "refunded_amount": p.refunded_amount,
            "paid_at": p.paid_at,
            "created_at": p.created_at,
        }
        for p in rows
    ]
    return Page.create(items, total, params)


# ───────────────────────────── Booking Control ─────────────────────────────


@router.patch("/bookings/{booking_id}/status", response_model=BookingOut, summary="تغییر وضعیت رزرو")
async def change_booking_status(
    booking_id: UUID,
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> BookingOut:
    booking = (
        await db.execute(select(Booking).options(*BOOKING_LOADS).where(Booking.id == booking_id))
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("رزرو یافت نشد.")
    try:
        new_status = BookingStatus(str(payload.get("status", "")))
    except ValueError as exc:
        raise NotFoundError("وضعیت نامعتبر است.") from exc
    old_value = booking.status.value
    booking.status = new_status
    if new_status == BookingStatus.CONFIRMED:
        booking.confirmed_at = datetime.now(UTC)
    if new_status == BookingStatus.CANCELLED:
        booking.cancelled_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(booking)
    db.add(
        AuditLog(
            user_id=_.id,
            action="booking.status_change",
            entity_type="booking",
            entity_id=booking.id,
            data={"from": old_value, "to": new_status.value},
        )
    )
    await db.commit()
    return booking_out(booking)


@router.post("/bookings/{booking_id}/refund", response_model=Message, summary="بازگشت وجه")
async def refund_booking(
    booking_id: UUID,
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    amount = int(payload.get("amount") or 0)
    booking = (
        await db.execute(select(Booking).options(*BOOKING_LOADS).where(Booking.id == booking_id))
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("رزرو یافت نشد.")
    payment = next(
        (p for p in booking.payments if p.status == PaymentStatus.PAID), None
    )
    if payment is None:
        raise NotFoundError("پرداخت موفقی برای این رزرو ثبت نشده است.")
    refund_amount = amount or (payment.amount - payment.refunded_amount)
    if refund_amount <= 0:
        raise NotFoundError("مبلغ بازگشت نامعتبر است.")
    payment.refunded_amount += refund_amount
    if payment.refunded_amount >= payment.amount:
        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = datetime.now(UTC)
        booking.status = BookingStatus.REFUNDED
    db.add(
        AuditLog(
            user_id=_.id,
            action="booking.refund",
            entity_type="booking",
            entity_id=booking.id,
            data={"amount": refund_amount, "payment_reference": payment.reference},
        )
    )
    await db.commit()
    return Message(message="بازگشت وجه با موفقیت انجام شد.")


# ───────────────────────────── Provider Administration ─────────────────────────────


@router.patch("/providers/{provider_id}", summary="تأیید/ویرایش ارائه‌دهنده")
async def update_provider(
    provider_id: UUID,
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.CONTENT_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    provider = await db.get(Provider, provider_id)
    if provider is None:
        raise NotFoundError("ارائه‌دهنده یافت نشد.")
    if "is_verified" in payload:
        provider.is_verified = bool(payload["is_verified"])
    if "is_active" in payload:
        provider.is_active = bool(payload["is_active"])
    if payload.get("commission_rate") is not None:
        provider.commission_rate = int(payload["commission_rate"])
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="provider.update",
            entity_type="provider",
            entity_id=provider.id,
            data={k: payload[k] for k in ("is_verified", "is_active", "commission_rate") if k in payload},
        )
    )
    await db.commit()
    return Message(message="ارائه‌دهنده به‌روزرسانی شد.")


# ───────────────────────────── Support Tickets ─────────────────────────────


@router.get("/support", response_model=Page[dict], summary="تیکت‌های پشتیبانی")
async def list_support_tickets(
    status: str | None = None,
    priority: str | None = None,
    params: PageParams = Depends(),
    _: User = Depends(require_roles(Role.ADMIN, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    filters = []
    if status:
        filters.append(SupportTicket.status == status)
    if priority:
        filters.append(SupportTicket.priority == priority)
    total = (await db.execute(select(func.count(SupportTicket.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(SupportTicket, User.full_name)
            .join(User, User.id == SupportTicket.user_id, isouter=True)
            .where(*filters)
            .order_by(SupportTicket.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).all()
    items = [
        {
            "id": t.id,
            "user_id": t.user_id,
            "user_name": user_name or "کاربر ناشناس",
            "subject": t.subject,
            "category": t.category,
            "message": t.message,
            "status": t.status,
            "priority": t.priority,
            "response": t.response,
            "created_at": t.created_at,
        }
        for t, user_name in rows
    ]
    return Page.create(items, total, params)


@router.patch("/support/{ticket_id}", summary="پاسخ/تغییر وضعیت تیکت")
async def update_support_ticket(
    ticket_id: UUID,
    payload: dict,
    _: User = Depends(require_roles(Role.ADMIN, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFoundError("تیکت یافت نشد.")
    if "status" in payload:
        ticket.status = str(payload["status"])
    if "priority" in payload:
        ticket.priority = str(payload["priority"])
    if "response" in payload and payload["response"]:
        ticket.response = str(payload["response"])
        if "status" not in payload:
            ticket.status = "answered"
        ticket.assigned_to = _.id
        await notify(
            db,
            ticket.user_id,
            "پاسخ پشتیبانی",
            f"به تیکت «{ticket.subject}» پاسخ داده شد.",
            notification_type=NotificationType.SYSTEM,
            data={"ticket_id": str(ticket.id)},
        )
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="support.update",
            entity_type="support_ticket",
            entity_id=ticket.id,
            data={
                "status": ticket.status,
                "priority": ticket.priority,
                "responded": bool("response" in payload and payload["response"]),
            },
        )
    )
    await db.commit()
    return Message(message="تیکت به‌روزرسانی شد.")


# ───────────────────────────── Notifications ─────────────────────────────


SUPPORT_AGENT_ONLY = (Role.ADMIN, Role.SUPPORT_AGENT, Role.MARKETING_MANAGER)


@router.post("/notifications/broadcast", summary="ارسال اعلان گروهی")
async def broadcast(
    payload: dict,
    _: User = Depends(require_roles(*SUPPORT_AGENT_ONLY)),
    db: AsyncSession = Depends(get_db),
) -> Message:
    title = str(payload.get("title") or "").strip()
    body = str(payload.get("body") or "").strip()
    role = payload.get("role")
    if not title or not body:
        raise NotFoundError("عنوان و متن اعلان الزامی است.")
    query = select(User.id).where(User.is_active.is_(True))
    if role:
        query = query.where(User.role == role)
    rows = (await db.execute(query.limit(500))).scalars().all()
    notification_type = NotificationType(payload.get("notification_type") or "system")
    for user_id in rows:
        db.add(
            Notification(
                user_id=user_id,
                title=title,
                body=body,
                notification_type=notification_type,
                data={"broadcast": True},
            )
        )
    await db.commit()
    db.add(
        AuditLog(
            user_id=_.id,
            action="notification.broadcast",
            entity_type="notification",
            entity_id=None,
            data={"title": title, "role": role, "recipients": len(rows)},
        )
    )
    await db.commit()
    return Message(message=f"اعلان برای {len(rows)} کاربر ارسال شد.")


@router.get("/support/stats", summary="آمار تیکت‌ها")
async def support_stats(
    _: User = Depends(require_roles(*SUPPORT_AGENT_ONLY)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (
        await db.execute(select(SupportTicket.status, func.count(SupportTicket.id)).group_by(SupportTicket.status))
    ).all()
    return {"by_status": {status if isinstance(status, str) else str(status): count for status, count in rows}}
