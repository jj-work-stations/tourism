from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, NotificationType


async def notify(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    body: str,
    *,
    notification_type: NotificationType = NotificationType.SYSTEM,
    data: dict[str, Any] | None = None,
) -> Notification:
    item = Notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data or {},
    )
    db.add(item)
    await db.flush()
    return item
