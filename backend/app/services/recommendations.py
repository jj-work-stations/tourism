from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Accommodation,
    Destination,
    Experience,
    Favorite,
    FavoriteEntity,
    Trip,
    User,
    UserPreference,
)
from app.schemas.ai import HotelRecommendation, RecommendationItem, RecommendationResponse


async def _interest_set(db: AsyncSession, user: User | None) -> set[str]:
    if user is None:
        return set()
    pref = (
        await db.execute(
            select(UserPreference).where(UserPreference.user_id == user.id)
        )
    ).scalar_one_or_none()
    interests = set(pref.interests if pref else [])
    trip_interests = (
        await db.execute(
            select(Trip.interests).where(Trip.user_id == user.id).order_by(Trip.created_at.desc()).limit(3)
        )
    ).scalars().all()
    for row in trip_interests:
        interests |= set(row or [])
    return interests


async def recommend_destinations(
    db: AsyncSession, user: User | None, limit: int = 8
) -> RecommendationResponse:
    destinations = list((await db.execute(select(Destination))).scalars().all())
    interests = await _interest_set(db, user)
    popular_ids: set[str] = set()
    favorite_ids: set[str] = set()
    if user is not None:
        trip_ids = (
            await db.execute(
                select(Trip.destination_id).where(Trip.user_id == user.id).limit(20)
            )
        ).scalars().all()
        popular_ids = {str(x) for x in trip_ids}
        favs = (
            await db.execute(
                select(Favorite.entity_id).where(
                    Favorite.user_id == user.id,
                    Favorite.entity_type == FavoriteEntity.DESTINATION,
                )
            )
        ).scalars().all()
        favorite_ids = {str(x) for x in favs}

    prices = dict(
        (
            await db.execute(
                select(Accommodation.destination_id, func.min(Accommodation.base_price))
                .where(Accommodation.is_active.is_(True))
                .group_by(Accommodation.destination_id)
            )
        ).all()
    )
    scored: list[tuple[float, Destination, str]] = []
    for dest in destinations:
        tags = {t.lower() for t in dest.tags}
        normalized = {i.lower() for i in interests}
        matches = tags & normalized
        score = dest.popularity / 100 + (3 if dest.is_featured else 0)
        score += 4 * len(matches)
        if str(dest.id) in favorite_ids:
            score += 5
        if str(dest.id) in popular_ids:
            score += 2
        if user is None:
            reason = "از محبوب‌ترین مقاصد مسافران سیر"
        elif matches:
            reason = "هم‌خوان با علاقه‌های شما: " + "، ".join(sorted(matches)[:3])
        elif str(dest.id) in favorite_ids:
            reason = "مقصدی که نشان کرده‌اید"
        elif dest.is_featured:
            reason = "پیشنهاد ویژه تیم سیر برای این فصل"
        else:
            reason = "مقصدی پرطرفدار با تجربه‌های متنوع"
        scored.append((score, dest, reason))
    scored.sort(key=lambda x: x[0], reverse=True)
    items = [
        RecommendationItem(
            destination={
                "id": dest.id,
                "slug": dest.slug,
                "name": dest.name,
                "name_local": dest.name_local,
                "country": dest.country,
                "image_url": dest.image_url,
            },
            score=round(score, 2),
            reason=reason,
            tags=dest.tags,
            starting_price=prices.get(dest.id),
            match=round(min(100, 40 + len(interests & set(dest.tags)) * 15), 0),
        )
        for score, dest, reason in scored[:limit]
    ]
    return RecommendationResponse(personalized=user is not None, items=items)


async def recommend_hotels(
    db: AsyncSession, user: User | None, destination_id: UUID | None, limit: int = 6
) -> list[HotelRecommendation]:
    stmt = (
        select(Accommodation)
        .options(selectinload(Accommodation.destination))
        .where(Accommodation.is_active.is_(True))
    )
    if destination_id:
        stmt = stmt.where(Accommodation.destination_id == destination_id)
    hotels = list((await db.execute(stmt)).scalars().all())
    budget_level = "mid"
    if user is not None:
        pref = (
            await db.execute(
                select(UserPreference).where(UserPreference.user_id == user.id)
            )
        ).scalar_one_or_none()
        if pref:
            budget_level = pref.budget_level
    max_price = {"budget": 2_000_000, "mid": 6_000_000, "luxury": None}[budget_level]
    filtered = [h for h in hotels if max_price is None or h.base_price <= max_price] or hotels
    scored = sorted(
        filtered,
        key=lambda h: (h.is_featured, h.guest_rating, h.review_count),
        reverse=True,
    )
    result = []
    for hotel in scored[:limit]:
        reason = (
            "مناسب بودجه اقتصادی شما"
            if budget_level == "budget"
            else "تعادل قیمت و کیفیت با امتیاز بالا"
            if budget_level == "mid"
            else "انتخابی لوکس با بالاترین امتیاز"
        )
        result.append(
            HotelRecommendation(
                id=hotel.id,
                name=hotel.name,
                slug=hotel.slug,
                image_url=hotel.images[0] if hotel.images else None,
                price=hotel.base_price,
                rating=hotel.guest_rating,
                reason=reason,
                destination_name=hotel.destination.name if hotel.destination else None,
            )
        )
    return result


async def recommend_experiences(
    db: AsyncSession, user: User | None, destination_id: UUID | None, limit: int = 6
) -> list[Experience]:
    interests = await _interest_set(db, user)
    stmt = select(Experience).where(Experience.is_active.is_(True))
    if destination_id:
        stmt = stmt.where(Experience.destination_id == destination_id)
    experiences = list((await db.execute(stmt)).scalars().all())

    def score(item: Experience) -> float:
        boosted = 3 if item.category.value in interests else 0
        return boosted + item.rating + (0.5 if item.is_featured else 0)

    return sorted(experiences, key=score, reverse=True)[:limit]
