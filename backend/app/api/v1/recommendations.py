from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_optional_user
from app.db.models import Destination, Experience, User
from app.db.session import get_db
from app.schemas.ai import HotelRecommendation, RecommendationResponse
from app.schemas.catalog import ExperienceOut
from app.services.recommendations import (
    recommend_destinations,
    recommend_experiences,
    recommend_hotels,
)
from app.services.serializers import experience_out

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/destinations", response_model=RecommendationResponse, summary="پیشنهاد مقصد")
async def destinations(
    limit: int = Query(default=8, ge=1, le=20),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    return await recommend_destinations(db, user, limit)


@router.get("/hotels", response_model=list[HotelRecommendation], summary="پیشنهاد اقامتگاه")
async def hotels(
    destination_id: UUID | None = None,
    limit: int = Query(default=6, ge=1, le=20),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> list[HotelRecommendation]:
    return await recommend_hotels(db, user, destination_id, limit)


@router.get("/experiences", response_model=list[ExperienceOut], summary="پیشنهاد تجربه")
async def experiences(
    destination_id: UUID | None = None,
    limit: int = Query(default=6, ge=1, le=20),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> list[ExperienceOut]:
    items = await recommend_experiences(db, user, destination_id, limit)
    ids = [e.id for e in items]
    if not ids:
        return []
    rows = (
        await db.execute(
            select(Experience)
            .options(selectinload(Experience.destination))
            .where(Experience.id.in_(ids))
        )
    ).scalars().all()
    by_id = {e.id: e for e in rows}
    return [experience_out(by_id[i]) for i in ids if i in by_id]


@router.get("/similar/{destination_id}", response_model=RecommendationResponse, summary="مقصدهای مشابه")
async def similar(
    destination_id: UUID,
    limit: int = Query(default=5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    base = await db.get(Destination, destination_id)
    if base is None:
        return RecommendationResponse(personalized=False, items=[])
    from sqlalchemy import select

    candidates = (
        await db.execute(
            select(Destination).where(
                Destination.id != base.id,
                (Destination.country == base.country) | (Destination.region == base.region),
            )
        )
    ).scalars().all()
    result = await recommend_destinations(db, None, limit=50)
    filtered = [item for item in result.items if item.destination.id != base.id][:limit]
    if not filtered:
        filtered = [
            item
            for item in result.items
            if any(tag in base.tags for tag in item.tags)
        ][:limit]
    return RecommendationResponse(personalized=False, items=filtered)
