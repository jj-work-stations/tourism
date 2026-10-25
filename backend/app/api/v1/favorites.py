from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import Favorite, FavoriteEntity, User
from app.db.session import get_db
from app.schemas.common import Message
from app.schemas.engagement import FavoriteCreate, FavoriteOut
from app.services.bookings import track_event
from app.services.serializers import favorite_out, resolve_entity

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.get("", response_model=Page[FavoriteOut], summary="علاقه‌مندی‌های من")
async def list_favorites(
    entity_type: str | None = Query(default=None),
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[FavoriteOut]:
    filters = [Favorite.user_id == user.id]
    if entity_type:
        filters.append(Favorite.entity_type == entity_type)
    total = (await db.execute(select(func.count(Favorite.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Favorite)
            .where(*filters)
            .order_by(Favorite.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    items = [await favorite_out(db, favorite) for favorite in rows]
    return Page.create(items, total, params)


@router.post("", response_model=FavoriteOut, summary="افزودن به علاقه‌مندی‌ها")
async def add_favorite(
    payload: FavoriteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteOut:
    entity = await resolve_entity(db, payload.entity_type.value, payload.entity_id)
    if entity is None:
        raise NotFoundError("مورد انتخابی یافت نشد.")
    existing = (
        await db.execute(
            select(Favorite).where(
                Favorite.user_id == user.id,
                Favorite.entity_type == payload.entity_type,
                Favorite.entity_id == payload.entity_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return await favorite_out(db, existing)
    favorite = Favorite(
        user_id=user.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
    )
    db.add(favorite)
    await track_event(
        db, user.id, "hotel_favorited" if payload.entity_type == FavoriteEntity.ACCOMMODATION else "favorite_added",
        {"entity_type": payload.entity_type.value, "entity_id": str(payload.entity_id)},
    )
    await db.commit()
    await db.refresh(favorite)
    return await favorite_out(db, favorite)


@router.delete("/{entity_type}/{entity_id}", response_model=Message, summary="حذف از علاقه‌مندی‌ها")
async def remove_favorite(
    entity_type: str,
    entity_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    result = await db.execute(
        delete(Favorite).where(
            Favorite.user_id == user.id,
            Favorite.entity_type == entity_type,
            Favorite.entity_id == entity_id,
        )
    )
    if result.rowcount == 0:
        raise NotFoundError("این مورد در علاقه‌مندی‌ها نیست.")
    await db.commit()
    return Message(message="از علاقه‌مندی‌ها حذف شد.")
