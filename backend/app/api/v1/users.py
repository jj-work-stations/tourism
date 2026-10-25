from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.db.models import Booking, Role, Trip, User, UserPreference
from app.db.session import get_db
from app.schemas.auth import UserOut
from app.schemas.common import Message
from app.schemas.user import PreferenceOut, PreferenceUpdate, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


async def _preference(db: AsyncSession, user: User) -> UserPreference:
    pref = (await db.execute(
        select(UserPreference).where(UserPreference.user_id == user.id)
    )).scalar_one_or_none()
    if pref is None:
        pref = UserPreference(user_id=user.id)
        db.add(pref)
        await db.flush()
    return pref


@router.get("/me", response_model=UserOut, summary="پروفایل من")
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut, summary="ویرایش پروفایل")
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/me/preferences", response_model=PreferenceOut, summary="ترجیحات سفر")
async def get_preferences(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> PreferenceOut:
    return PreferenceOut.model_validate(await _preference(db, user))


@router.put("/me/preferences", response_model=PreferenceOut, summary="ذخیره ترجیحات سفر")
async def update_preferences(
    payload: PreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PreferenceOut:
    pref = await _preference(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pref, field, value)
    await db.commit()
    await db.refresh(pref)
    return PreferenceOut.model_validate(pref)


@router.get("/me/stats", summary="آمار شخصی")
async def my_stats(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    trips = (
        await db.execute(select(func.count(Trip.id)).where(Trip.user_id == user.id))
    ).scalar_one()
    bookings = (
        await db.execute(select(func.count(Booking.id)).where(Booking.user_id == user.id))
    ).scalar_one()
    spent = (
        await db.execute(
            select(func.coalesce(func.sum(Booking.total), 0)).where(
                Booking.user_id == user.id, Booking.status.in_(["confirmed", "completed"])
            )
        )
    ).scalar_one()
    from app.db.models import Wallet

    wallet = (
        await db.execute(select(Wallet).where(Wallet.user_id == user.id))
    ).scalar_one_or_none()
    return {
        "trips": trips,
        "bookings": bookings,
        "total_spent": int(spent),
        "member_since": user.created_at,
        "xp": wallet.xp if wallet else 0,
        "level": wallet.level if wallet else "bronze",
        "points": wallet.points if wallet else 0,
    }


@router.delete("/me", response_model=Message, summary="غیرفعال‌سازی حساب")
async def deactivate(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Message:
    if user.role == Role.ADMIN:
        raise NotFoundError("حساب مدیر از این مسیر قابل حذف نیست.")
    user.is_active = False
    user.email = None
    user.phone = None
    await db.commit()
    return Message(message="حساب کاربری غیرفعال شد. برای بازگشت با پشتیبانی تماس بگیرید.")


@router.get("/{user_id}/public", response_model=dict, summary="پروفایل عمومی مسافر")
async def public_profile(user_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("کاربر یافت نشد.")
    trips = (
        await db.execute(
            select(Trip)
            .where(Trip.user_id == user.id, Trip.is_public.is_(True))
            .order_by(Trip.start_date.desc())
            .limit(10)
        )
    ).scalars().all()
    return {
        "id": user.id,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "city": user.city,
        "member_since": user.created_at,
        "trips": [
            {
                "id": t.id,
                "title": t.title,
                "start_date": t.start_date,
                "end_date": t.end_date,
                "cover_image": t.cover_image,
            }
            for t in trips
        ],
    }
