from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.bookings import BOOKING_LOADS
from app.core.deps import require_roles
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import (
    Accommodation,
    AccommodationType,
    AnalyticsEvent,
    Attraction,
    AttractionCategory,
    AuditLog,
    Booking,
    BookingStatus,
    Campaign,
    Coupon,
    CouponType,
    Destination,
    Experience,
    ExperienceCategory,
    Provider,
    ProviderType,
    Restaurant,
    Review,
    ReviewStatus,
    Role,
    TransportOffer,
    TransportType,
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
    return Message(message="رستوران ذخیره شد.")


@router.get("/settings", response_model=SystemSettings, summary="تنظیمات سیستم")
async def get_settings(_: User = Depends(require_roles(Role.ADMIN))) -> SystemSettings:
    return SystemSettings()


@router.put("/settings", response_model=Message, summary="به‌روزرسانی تنظیمات")
async def put_settings(
    payload: SystemSettings,
    _: User = Depends(require_roles(Role.ADMIN)),
) -> Message:
    settings = get_app_settings()
    settings.update(payload.model_dump(exclude_unset=True))
    save_app_settings(settings)
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
