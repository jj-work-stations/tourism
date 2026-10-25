from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.accommodations import search_accommodations
from app.api.v1.transportation import search_transportation
from app.core.cache import cache
from app.core.deps import client_ip, get_optional_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.accommodation import AccommodationSearchRequest, AccommodationSearchResponse
from app.schemas.transport import TransportSearchRequest, TransportSearchResponse

router = APIRouter(prefix="/search", tags=["Search"])

RECENT_SEARCHES_TTL = 7 * 24 * 3600
RECENT_SEARCHES_LIMIT = 10


def _recent_key(request: Request, user: User | None) -> str:
    identity = str(user.id) if user else client_ip(request) or "anonymous"
    return f"search:recent:{identity}"


async def _record_recent(request: Request, user: User | None, entry: dict[str, Any]) -> None:
    key = _recent_key(request, user)
    existing = await cache.get_json(key) or []
    dedupe = {item.get("signature"): item for item in existing if isinstance(item, dict)}
    entry["signature"] = "|".join(
        str(entry.get(field, "")) for field in ("tab", "origin", "destination", "date", "check_in")
    )
    entry["created_at"] = datetime.now(UTC).isoformat()
    dedupe[entry["signature"]] = entry
    ordered = sorted(dedupe.values(), key=lambda item: item.get("created_at", ""), reverse=True)
    await cache.set_json(key, ordered[:RECENT_SEARCHES_LIMIT], RECENT_SEARCHES_TTL)


@router.post(
    "/transportation",
    response_model=TransportSearchResponse,
    summary="جستجوی حمل‌ونقل (API عمومی جستجو)",
)
async def search_transport(
    payload: TransportSearchRequest,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> TransportSearchResponse:
    response = await search_transportation(payload, db)
    await _record_recent(
        request,
        user,
        {
            "tab": "transport",
            "origin": str(payload.origin_id),
            "destination": str(payload.destination_id),
            "date": payload.date.isoformat(),
            "passengers": payload.passengers,
            "total": response.total,
        },
    )
    return response


@router.post(
    "/accommodations",
    response_model=AccommodationSearchResponse,
    summary="جستجوی اقامتگاه (API عمومی جستجو)",
)
async def search_stays(
    payload: AccommodationSearchRequest,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> AccommodationSearchResponse:
    response = await search_accommodations(payload, db)
    await _record_recent(
        request,
        user,
        {
            "tab": "stay",
            "destination": str(payload.destination_id),
            "check_in": payload.check_in.isoformat(),
            "check_out": payload.check_out.isoformat(),
            "guests": payload.guests,
            "rooms": payload.rooms,
            "total": response.total,
        },
    )
    return response


@router.get("/recent", summary="آخرین جستجوهای کاربر")
async def recent_searches(
    request: Request,
    limit: int = Query(default=5, ge=1, le=10),
    user: User | None = Depends(get_optional_user),
) -> list[dict]:
    return (await cache.get_json(_recent_key(request, user)) or [])[:limit]


@router.get("/suggest", summary="پیشنهاد سریع مقصد و مکان")
async def suggest_alias(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    from app.api.v1.destinations import suggest

    return [item.model_dump(mode="json") for item in await suggest(q, limit, db)]
