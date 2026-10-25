from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.db.models import Destination, TransportOffer
from app.db.session import get_db
from app.schemas.transport import (
    TransportOfferOut,
    TransportSearchMeta,
    TransportSearchRequest,
    TransportSearchResponse,
)
from app.services.serializers import transport_offer_out

router = APIRouter(prefix="/transportation", tags=["Transportation"])

EAGER = (
    selectinload(TransportOffer.provider),
    selectinload(TransportOffer.origin),
    selectinload(TransportOffer.destination),
)


def _day_bounds(local_date, tz_name: str = "Asia/Tehran") -> tuple[datetime, datetime]:
    tz = ZoneInfo(tz_name)
    start = datetime.combine(local_date, time.min, tzinfo=tz).astimezone(UTC)
    return start, start + timedelta(days=1)


@router.post(
    "/search",
    response_model=TransportSearchResponse,
    summary="جستجوی حمل‌ونقل بین دو مقصد",
)
async def search_transportation(
    payload: TransportSearchRequest, db: AsyncSession = Depends(get_db)
) -> TransportSearchResponse:
    origin = await db.get(Destination, payload.origin_id)
    destination = await db.get(Destination, payload.destination_id)
    if origin is None or destination is None:
        raise NotFoundError("مبدأ یا مقصد انتخاب‌شده یافت نشد.")

    start, end = _day_bounds(payload.date, destination.timezone or "Asia/Tehran")
    filters = [
        TransportOffer.origin_id == payload.origin_id,
        TransportOffer.destination_id == payload.destination_id,
        TransportOffer.departure_at >= start,
        TransportOffer.departure_at < end,
        TransportOffer.is_active.is_(True),
        TransportOffer.seats_available >= payload.passengers,
    ]
    if payload.types:
        filters.append(TransportOffer.type.in_(payload.types))
    if payload.min_price is not None:
        filters.append(TransportOffer.price >= payload.min_price)
    if payload.max_price is not None:
        filters.append(TransportOffer.price <= payload.max_price)
    if payload.max_stops is not None:
        filters.append(TransportOffer.stops <= payload.max_stops)
    if payload.provider_id:
        filters.append(TransportOffer.provider_id == payload.provider_id)

    total = (await db.execute(select(func.count(TransportOffer.id)).where(*filters))).scalar_one()
    order = {
        "recommended": TransportOffer.rating.desc(),
        "cheapest": TransportOffer.price.asc(),
        "fastest": TransportOffer.duration_minutes.asc(),
        "rating": TransportOffer.rating.desc(),
    }[payload.sort]
    stmt = (
        select(TransportOffer)
        .options(*EAGER)
        .where(*filters)
        .order_by(order, TransportOffer.price.asc())
        .offset((payload.page - 1) * payload.page_size)
        .limit(payload.page_size)
    )
    offers = (await db.execute(stmt)).scalars().all()

    cheapest, fastest = (
        await db.execute(
            select(func.min(TransportOffer.price), func.min(TransportOffer.duration_minutes))
            .where(*filters)
        )
    ).one()
    types_available = list(
        (
            await db.execute(
                select(TransportOffer.type).where(*filters).distinct()
            )
        ).scalars().all()
    )
    pages = (total + payload.page_size - 1) // payload.page_size if total else 0
    return TransportSearchResponse(
        items=[transport_offer_out(o) for o in offers],
        total=total,
        page=payload.page,
        page_size=payload.page_size,
        pages=pages,
        meta=TransportSearchMeta(
            cheapest_price=cheapest,
            fastest_minutes=fastest,
            types_available=[t.value for t in types_available],
        ),
    )


@router.get("/offers", response_model=list[TransportOfferOut], summary="فهرست پیشنهادهای حمل‌ونقل")
async def list_offers(
    origin_id: UUID | None = None,
    destination_id: UUID | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> list[TransportOfferOut]:
    filters = [TransportOffer.is_active.is_(True), TransportOffer.departure_at >= datetime.now(UTC)]
    if origin_id:
        filters.append(TransportOffer.origin_id == origin_id)
    if destination_id:
        filters.append(TransportOffer.destination_id == destination_id)
    offers = (
        await db.execute(
            select(TransportOffer).options(*EAGER).where(*filters)
            .order_by(TransportOffer.departure_at.asc()).limit(min(limit, 50))
        )
    ).scalars().all()
    return [transport_offer_out(o) for o in offers]


@router.get("/offers/{offer_id}", response_model=TransportOfferOut, summary="جزئیات سفر")
async def get_offer(offer_id: UUID, db: AsyncSession = Depends(get_db)) -> TransportOfferOut:
    offer = (
        await db.execute(
            select(TransportOffer).options(*EAGER).where(TransportOffer.id == offer_id)
        )
    ).scalar_one_or_none()
    if offer is None:
        raise NotFoundError("سفر موردنظر یافت نشد.")
    return transport_offer_out(offer)
