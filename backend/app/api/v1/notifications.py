from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import Notification, User
from app.db.session import get_db
from app.schemas.common import Message
from app.schemas.engagement import MarkReadRequest, NotificationOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=Page[NotificationOut], summary="اعلان‌های من")
async def list_notifications(
    unread_only: bool = False,
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[NotificationOut]:
    filters = [Notification.user_id == user.id]
    if unread_only:
        filters.append(Notification.is_read.is_(False))
    total = (await db.execute(select(func.count(Notification.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Notification)
            .where(*filters)
            .order_by(Notification.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([NotificationOut.model_validate(n) for n in rows], total, params)


@router.get("/unread-count", summary="تعداد اعلان‌های خوانده‌نشده")
async def unread_count(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    count = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user.id, Notification.is_read.is_(False)
            )
        )
    ).scalar_one()
    return {"count": count}


@router.post("/read", response_model=Message, summary="خواندن اعلان‌ها")
async def mark_read(
    payload: MarkReadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    stmt = update(Notification).where(
        Notification.user_id == user.id, Notification.is_read.is_(False)
    )
    if payload.ids:
        stmt = stmt.where(Notification.id.in_(payload.ids))
    await db.execute(
        stmt.values(is_read=True, read_at=datetime.now(UTC))
    )
    await db.commit()
    return Message(message="اعلان‌ها خوانده شدند.")


@router.patch("/{notification_id}/read", response_model=NotificationOut, summary="خواندن یک اعلان")
async def read_one(
    notification_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationOut:
    item = await db.get(Notification, notification_id)
    if item is None or item.user_id != user.id:
        raise NotFoundError("اعلان یافت نشد.")
    item.is_read = True
    item.read_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(item)
    return NotificationOut.model_validate(item)
