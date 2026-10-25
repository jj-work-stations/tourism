from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_optional_user
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import (
    Accommodation,
    Attraction,
    Booking,
    BookingStatus,
    Experience,
    Review,
    ReviewStatus,
    Role,
    User,
)
from app.db.session import get_db
from app.schemas.common import Message
from app.schemas.engagement import ReviewCreate, ReviewOut, ReviewStats, ReviewUpdate
from app.services.bookings import track_event
from app.services.loyalty import add_xp
from app.services.notifications import notify
from app.services.serializers import resolve_entity, review_out

router = APIRouter(prefix="/reviews", tags=["Reviews"])

REVIEW_LOADS = (selectinload(Review.user),)


async def _is_verified(db: AsyncSession, user_id: UUID, entity_type: str, entity_id: UUID) -> bool:
    column_map = {
        "accommodation": Booking.accommodation_id,
        "transport": Booking.transport_offer_id,
        "experience": Booking.experience_id,
    }
    column = column_map.get(entity_type)
    if column is None:
        return False
    count = (
        await db.execute(
            select(func.count(Booking.id)).where(
                Booking.user_id == user_id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
                column == entity_id,
            )
        )
    ).scalar_one()
    return count > 0


async def _refresh_entity_rating(db: AsyncSession, entity_type: str, entity_id: UUID) -> None:
    model_map = {
        "accommodation": Accommodation,
        "attraction": Attraction,
        "experience": Experience,
    }
    model = model_map.get(entity_type)
    if model is None:
        return
    avg, count = (
        await db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(
                Review.entity_type == entity_type,
                Review.entity_id == entity_id,
                Review.status == ReviewStatus.PUBLISHED,
            )
        )
    ).one()
    item = await db.get(model, entity_id)
    if item is None:
        return
    if entity_type == "accommodation":
        item.guest_rating = round(float(avg or item.guest_rating), 2)
    else:
        item.rating = round(float(avg or item.rating), 2)
    item.review_count = int(count)


@router.get("", response_model=Page[ReviewOut], summary="نظرات یک مورد")
async def list_reviews(
    entity_type: str = Query(),
    entity_id: UUID = Query(),
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[ReviewOut]:
    filters = [
        Review.entity_type == entity_type,
        Review.entity_id == entity_id,
        Review.status == ReviewStatus.PUBLISHED,
    ]
    total = (await db.execute(select(func.count(Review.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Review)
            .options(*REVIEW_LOADS)
            .where(*filters)
            .order_by(Review.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([review_out(r) for r in rows], total, params)


@router.get("/stats", response_model=ReviewStats, summary="آمار امتیازها")
async def review_stats(
    entity_type: str = Query(),
    entity_id: UUID = Query(),
    db: AsyncSession = Depends(get_db),
) -> ReviewStats:
    rows = (
        await db.execute(
            select(Review.rating, func.count(Review.id))
            .where(
                Review.entity_type == entity_type,
                Review.entity_id == entity_id,
                Review.status == ReviewStatus.PUBLISHED,
            )
            .group_by(Review.rating)
        )
    ).all()
    distribution = {str(i): 0 for i in range(1, 6)}
    total = 0
    weighted = 0
    for rating, count in rows:
        distribution[str(rating)] = count
        total += count
        weighted += rating * count
    return ReviewStats(
        average=round(weighted / total, 2) if total else 0,
        total=total,
        distribution=distribution,
    )


@router.get("/mine", response_model=Page[ReviewOut], summary="نظرات من")
async def my_reviews(
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[ReviewOut]:
    total = (
        await db.execute(select(func.count(Review.id)).where(Review.user_id == user.id))
    ).scalar_one()
    rows = (
        await db.execute(
            select(Review)
            .options(*REVIEW_LOADS)
            .where(Review.user_id == user.id)
            .order_by(Review.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([review_out(r) for r in rows], total, params)


@router.post("", response_model=ReviewOut, status_code=201, summary="ثبت نظر")
async def create_review(
    payload: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewOut:
    entity = await resolve_entity(db, payload.entity_type.value, payload.entity_id)
    if entity is None:
        raise NotFoundError("مورد انتخابی یافت نشد.")
    existing = (
        await db.execute(
            select(Review).where(
                Review.user_id == user.id,
                Review.entity_type == payload.entity_type,
                Review.entity_id == payload.entity_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("شما قبلاً برای این مورد نظر ثبت کرده‌اید.")
    verified = await _is_verified(db, user.id, payload.entity_type.value, payload.entity_id)
    review = Review(
        user_id=user.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        rating=payload.rating,
        title=payload.title,
        body=payload.body,
        photos=payload.photos,
        cleanliness=payload.cleanliness,
        location_score=payload.location_score,
        service=payload.service,
        value=payload.value,
        experience_score=payload.experience_score,
        is_verified=verified,
        status=ReviewStatus.PUBLISHED,
    )
    db.add(review)
    await db.flush()
    await _refresh_entity_rating(db, payload.entity_type.value, payload.entity_id)
    await add_xp(db, user.id, 10, "ثبت نظر و اشتراک تجربه")
    await track_event(
        db,
        user.id,
        "review_created",
        {"entity_type": payload.entity_type.value, "entity_id": str(payload.entity_id), "rating": payload.rating},
    )
    await notify(
        db,
        user.id,
        "نظر شما ثبت شد ✍️",
        "از اشتراک تجربه‌تان سپاسگزاریم. ۱۰ امتیاز تجربه به شما اضافه شد.",
    )
    await db.commit()
    review = (
        await db.execute(select(Review).options(*REVIEW_LOADS).where(Review.id == review.id))
    ).scalar_one()
    return review_out(review)


@router.patch("/{review_id}", response_model=ReviewOut, summary="ویرایش نظر")
async def update_review(
    review_id: UUID,
    payload: ReviewUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewOut:
    review = (
        await db.execute(select(Review).options(*REVIEW_LOADS).where(Review.id == review_id))
    ).scalar_one_or_none()
    if review is None:
        raise NotFoundError("نظر یافت نشد.")
    if review.user_id != user.id and user.role != Role.ADMIN:
        raise ForbiddenError()
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    await _refresh_entity_rating(db, review.entity_type.value, review.entity_id)
    await db.commit()
    await db.refresh(review)
    return review_out(review)


@router.delete("/{review_id}", response_model=Message, summary="حذف نظر")
async def delete_review(
    review_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    review = await db.get(Review, review_id)
    if review is None:
        raise NotFoundError("نظر یافت نشد.")
    if review.user_id != user.id and user.role != Role.ADMIN:
        raise ForbiddenError()
    entity_type, entity_id = review.entity_type.value, review.entity_id
    await db.delete(review)
    await db.flush()
    await _refresh_entity_rating(db, entity_type, entity_id)
    await db.commit()
    return Message(message="نظر حذف شد.")


@router.post("/{review_id}/helpful", response_model=Message, summary="نظر مفید بود")
async def mark_helpful(
    review_id: UUID,
    _: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    review = await db.get(Review, review_id)
    if review is None:
        raise NotFoundError("نظر یافت نشد.")
    review.helpful_count += 1
    await db.commit()
    return Message(message="بازخورد شما ثبت شد.")
