from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_optional_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.common import Message
from app.schemas.engagement import EventBatch, EventCreate
from app.services.bookings import track_event

router = APIRouter(prefix="/events", tags=["Analytics"])


@router.post("", response_model=Message, summary="ثبت رویداد تحلیلی")
async def create_event(
    payload: EventCreate,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    from app.db.models import AnalyticsEvent

    db.add(
        AnalyticsEvent(
            user_id=user.id if user else None,
            session_id=payload.session_id,
            name=payload.name,
            properties=payload.properties or {},
            path=payload.path,
        )
    )
    await db.commit()
    return Message(message="رویداد ثبت شد.")


@router.post("/batch", response_model=Message, summary="ثبت گروهی رویدادها")
async def create_events(
    payload: EventBatch,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    from app.db.models import AnalyticsEvent

    for event in payload.events:
        db.add(
            AnalyticsEvent(
                user_id=user.id if user else None,
                session_id=event.session_id,
                name=event.name,
                properties=event.properties,
                path=event.path,
            )
        )
    await db.commit()
    return Message(message=f"{len(payload.events)} رویداد ثبت شد.")
