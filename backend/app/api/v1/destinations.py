from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import cache
from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import (
    Accommodation,
    Attraction,
    Campaign,
    Destination,
    EmergencyContact,
    Experience,
    Restaurant,
    WeatherSnapshot,
)
from app.db.session import get_db
from app.schemas.catalog import (
    AttractionOut,
    CampaignOut,
    DestinationOut,
    ExperienceOut,
    HomeResponse,
    RestaurantOut,
    SuggestionOut,
    WeatherOut,
)
from app.services.serializers import attraction_out, destination_out, experience_out, restaurant_out

router = APIRouter(tags=["Destinations & Discovery"])


async def _destination_counts(
    db: AsyncSession, destinations: list[Destination]
) -> dict[UUID, dict[str, Any]]:
    if not destinations:
        return {}
    ids = [d.id for d in destinations]
    result: dict[UUID, dict[str, Any]] = {
        d.id: {"attraction_count": 0, "accommodation_count": 0, "restaurant_count": 0,
               "experience_count": 0, "starting_price": None}
        for d in destinations
    }
    for model, key in (
        (Attraction, "attraction_count"),
        (Accommodation, "accommodation_count"),
        (Restaurant, "restaurant_count"),
        (Experience, "experience_count"),
    ):
        rows = await db.execute(
            select(model.destination_id, func.count(model.id))
            .where(model.destination_id.in_(ids), model.is_active.is_(True))
            .group_by(model.destination_id)
        )
        for dest_id, count in rows.all():
            result[dest_id][key] = count
    prices = await db.execute(
        select(Accommodation.destination_id, func.min(Accommodation.base_price))
        .where(Accommodation.destination_id.in_(ids), Accommodation.is_active.is_(True))
        .group_by(Accommodation.destination_id)
    )
    for dest_id, price in prices.all():
        result[dest_id]["starting_price"] = price
    return result


def _destination_payload(dest: Destination, counts: dict[str, Any]) -> dict[str, Any]:
    return destination_out(dest, **counts).model_dump(mode="json")


@router.get("/destinations", response_model=Page[DestinationOut], summary="فهرست مقصدها")
async def list_destinations(
    q: str | None = Query(default=None, max_length=100),
    country: str | None = Query(default=None, max_length=80),
    featured: bool | None = None,
    sort: str = Query(default="popularity", pattern="^(popularity|name|budget)$"),
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[DestinationOut]:
    cache_key = f"destinations:{q}:{country}:{featured}:{sort}:{params.page}:{params.page_size}"
    cached = await cache.get_json(cache_key)
    if cached:
        return Page[DestinationOut].model_validate(cached)
    stmt = select(Destination)
    count_stmt = select(func.count(Destination.id))
    filters = []
    if q:
        pattern = f"%{q}%"
        filters.append(
            or_(
                Destination.name.ilike(pattern),
                Destination.name_local.ilike(pattern),
                Destination.country.ilike(pattern),
                Destination.slug.ilike(pattern),
            )
        )
    if country:
        filters.append(Destination.country.ilike(f"%{country}%"))
    if featured is not None:
        filters.append(Destination.is_featured.is_(featured))
    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)
    order = {
        "popularity": (Destination.popularity.desc(), Destination.name),
        "name": (Destination.name,),
        "budget": (Destination.avg_daily_budget.asc(),),
    }[sort]
    stmt = stmt.order_by(*order).offset(params.offset).limit(params.limit)
    total = (await db.execute(count_stmt)).scalar_one()
    destinations = list((await db.execute(stmt)).scalars().all())
    counts = await _destination_counts(db, destinations)
    items = [destination_out(d, **counts[d.id]) for d in destinations]
    page = Page.create(items, total, params)
    await cache.set_json(cache_key, page.model_dump(mode="json"), 180)
    return page


@router.get("/destinations/{slug}", response_model=DestinationOut, summary="جزئیات مقصد")
async def get_destination(slug: str, db: AsyncSession = Depends(get_db)) -> DestinationOut:
    dest = (
        await db.execute(select(Destination).where(Destination.slug == slug))
    ).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    counts = await _destination_counts(db, [dest])
    return destination_out(dest, **counts[dest.id])


@router.get(
    "/destinations/{slug}/attractions",
    response_model=Page[AttractionOut],
    summary="جاذبه‌های مقصد",
)
async def destination_attractions(
    slug: str,
    category: str | None = None,
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[AttractionOut]:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    stmt = select(Attraction).options(selectinload(Attraction.destination)).where(
        Attraction.destination_id == dest.id, Attraction.is_active.is_(True)
    )
    if category:
        stmt = stmt.where(Attraction.category == category)
    total = len((await db.execute(stmt)).scalars().all())
    items = (
        await db.execute(
            stmt.order_by(Attraction.rating.desc()).offset(params.offset).limit(params.limit)
        )
    ).scalars().all()
    return Page.create([attraction_out(x) for x in items], total, params)


@router.get(
    "/destinations/{slug}/accommodations",
    response_model=Page[dict],
    summary="اقامتگاه‌های مقصد",
)
async def destination_accommodations(
    slug: str,
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[dict]:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    stmt = (
        select(Accommodation)
        .options(selectinload(Accommodation.destination))
        .where(Accommodation.destination_id == dest.id, Accommodation.is_active.is_(True))
        .order_by(Accommodation.is_featured.desc(), Accommodation.guest_rating.desc())
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    items = (await db.execute(stmt.offset(params.offset).limit(params.limit))).scalars().all()
    payload = [
        {
            "id": a.id,
            "slug": a.slug,
            "name": a.name,
            "type": a.type.value,
            "image_url": a.images[0] if a.images else None,
            "images": a.images,
            "short_description": a.short_description,
            "guest_rating": a.guest_rating,
            "star_rating": a.star_rating,
            "review_count": a.review_count,
            "base_price": a.base_price,
            "amenities": a.amenities,
            "distance_to_center_km": a.distance_to_center_km,
            "is_featured": a.is_featured,
        }
        for a in items
    ]
    return Page.create(payload, total, params)


@router.get(
    "/destinations/{slug}/restaurants",
    response_model=Page[RestaurantOut],
    summary="رستوران‌های مقصد",
)
async def destination_restaurants(
    slug: str,
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[RestaurantOut]:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    stmt = (
        select(Restaurant)
        .options(selectinload(Restaurant.destination))
        .where(Restaurant.destination_id == dest.id, Restaurant.is_active.is_(True))
        .order_by(Restaurant.rating.desc())
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    items = (await db.execute(stmt.offset(params.offset).limit(params.limit))).scalars().all()
    return Page.create([restaurant_out(x) for x in items], total, params)


@router.get(
    "/destinations/{slug}/experiences",
    response_model=Page[ExperienceOut],
    summary="تجربه‌های مقصد",
)
async def destination_experiences(
    slug: str,
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[ExperienceOut]:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    stmt = (
        select(Experience)
        .options(selectinload(Experience.destination))
        .where(Experience.destination_id == dest.id, Experience.is_active.is_(True))
        .order_by(Experience.rating.desc())
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    items = (await db.execute(stmt.offset(params.offset).limit(params.limit))).scalars().all()
    return Page.create([experience_out(x) for x in items], total, params)


@router.get("/destinations/{slug}/map", summary="نقاط نقشه مقصد")
async def destination_map(slug: str, db: AsyncSession = Depends(get_db)) -> dict:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    markers: list[dict[str, Any]] = [
        {"id": dest.id, "type": "destination", "name": dest.name, "lat": dest.latitude,
         "lng": dest.longitude, "rating": None, "image": dest.image_url}
    ]
    hotels = (await db.execute(
        select(Accommodation).where(
            Accommodation.destination_id == dest.id, Accommodation.is_active.is_(True)
        )
    )).scalars().all()
    for h in hotels:
        markers.append({"id": h.id, "type": "accommodation", "name": h.name, "lat": h.latitude,
                        "lng": h.longitude, "rating": h.guest_rating,
                        "image": h.images[0] if h.images else None, "price": h.base_price,
                        "slug": h.slug})
    attractions = (await db.execute(
        select(Attraction).where(
            Attraction.destination_id == dest.id, Attraction.is_active.is_(True)
        )
    )).scalars().all()
    for a in attractions:
        markers.append({"id": a.id, "type": "attraction", "name": a.name, "lat": a.latitude,
                        "lng": a.longitude, "rating": a.rating, "image": a.image_url,
                        "category": a.category.value})
    restaurants = (await db.execute(
        select(Restaurant).where(
            Restaurant.destination_id == dest.id, Restaurant.is_active.is_(True)
        )
    )).scalars().all()
    for r in restaurants:
        markers.append({"id": r.id, "type": "restaurant", "name": r.name, "lat": r.latitude,
                        "lng": r.longitude, "rating": r.rating, "image": r.image_url,
                        "price_range": r.price_range})
    experiences = (await db.execute(
        select(Experience).where(
            Experience.destination_id == dest.id, Experience.is_active.is_(True)
        )
    )).scalars().all()
    for e in experiences:
        markers.append({"id": e.id, "type": "experience", "name": e.name, "lat": e.latitude,
                        "lng": e.longitude, "rating": e.rating, "image": e.image_url,
                        "price": e.price})
    return {"center": {"lat": dest.latitude, "lng": dest.longitude}, "markers": markers}


@router.get(
    "/destinations/{slug}/weather",
    response_model=WeatherOut,
    summary="وضعیت آب‌وهوا",
)
async def destination_weather(slug: str, db: AsyncSession = Depends(get_db)) -> WeatherOut:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    snapshot = (
        await db.execute(
            select(WeatherSnapshot)
            .where(WeatherSnapshot.destination_id == dest.id)
            .order_by(WeatherSnapshot.observed_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if snapshot is None:
        raise NotFoundError("اطلاعات آب‌وهوا برای این مقصد موجود نیست.")
    return WeatherOut.model_validate(snapshot)


@router.get(
    "/destinations/{slug}/emergency",
    summary="اطلاعات اضطراری مقصد",
)
async def destination_emergency(slug: str, db: AsyncSession = Depends(get_db)) -> list[dict]:
    dest = (await db.execute(select(Destination).where(Destination.slug == slug))).scalar_one_or_none()
    if dest is None:
        raise NotFoundError("مقصد یافت نشد.")
    rows = (
        await db.execute(
            select(EmergencyContact)
            .where(EmergencyContact.destination_id == dest.id)
            .order_by(EmergencyContact.category)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "phone": r.phone,
            "address": r.address,
            "latitude": r.latitude,
            "longitude": r.longitude,
        }
        for r in rows
    ]


@router.get("/discovery/suggest", response_model=list[SuggestionOut], summary="جستجوی سریع")
async def suggest(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
) -> list[SuggestionOut]:
    pattern = f"%{q}%"
    items: list[SuggestionOut] = []
    rows = (
        await db.execute(
            select(Destination)
            .where(
                or_(Destination.name.ilike(pattern), Destination.name_local.ilike(pattern),
                    Destination.country.ilike(pattern))
            )
            .order_by(Destination.popularity.desc())
            .limit(limit)
        )
    ).scalars().all()
    items.extend(
        SuggestionOut(
            type="destination", id=d.id, slug=d.slug, title=d.name_local or d.name,
            subtitle=d.country, image_url=d.image_url,
        )
        for d in rows
    )
    if len(items) < limit:
        rows2 = (
            await db.execute(
                select(Attraction).where(Attraction.name.ilike(pattern), Attraction.is_active.is_(True))
                .order_by(Attraction.rating.desc()).limit(limit - len(items))
            )
        ).scalars().all()
        items.extend(
            SuggestionOut(
                type="attraction", id=a.id, slug=a.slug, title=a.name,
                subtitle=a.category.value, image_url=a.image_url,
            )
            for a in rows2
        )
    if len(items) < limit:
        rows3 = (
            await db.execute(
                select(Accommodation)
                .where(Accommodation.name.ilike(pattern), Accommodation.is_active.is_(True))
                .order_by(Accommodation.guest_rating.desc())
                .limit(limit - len(items))
            )
        ).scalars().all()
        items.extend(
            SuggestionOut(
                type="accommodation", id=a.id, slug=a.slug, title=a.name,
                subtitle=a.address, image_url=a.images[0] if a.images else None,
            )
            for a in rows3
        )
    return items


@router.get("/home", response_model=HomeResponse, summary="داده‌های صفحه اصلی")
async def home(db: AsyncSession = Depends(get_db)) -> HomeResponse:
    cached = await cache.get_json("home:v1")
    if cached:
        return HomeResponse.model_validate(cached)
    featured = list(
        (await db.execute(
            select(Destination).where(Destination.is_featured.is_(True))
            .order_by(Destination.popularity.desc()).limit(6)
        )).scalars().all()
    )
    popular = list(
        (await db.execute(
            select(Destination).order_by(Destination.popularity.desc()).limit(8)
        )).scalars().all()
    )
    all_dest = {d.id: d for d in featured + popular}
    counts = await _destination_counts(db, list(all_dest.values()))
    campaigns = list(
        (await db.execute(
            select(Campaign).where(Campaign.is_active.is_(True), Campaign.placement == "home")
            .order_by(Campaign.sort_order).limit(5)
        )).scalars().all()
    )
    attractions = list(
        (await db.execute(
            select(Attraction).options(selectinload(Attraction.destination))
            .where(Attraction.is_active.is_(True), Attraction.is_featured.is_(True))
            .order_by(Attraction.rating.desc()).limit(6)
        )).scalars().all()
    )
    experiences = list(
        (await db.execute(
            select(Experience).options(selectinload(Experience.destination))
            .where(Experience.is_active.is_(True), Experience.is_featured.is_(True))
            .order_by(Experience.rating.desc()).limit(4)
        )).scalars().all()
    )
    dest_objs = [destination_out(d, **counts[d.id]) for d in featured]
    popular_objs = [destination_out(d, **counts[d.id]) for d in popular]
    payload = HomeResponse(
        featured_destinations=dest_objs,
        popular_destinations=popular_objs,
        campaigns=[CampaignOut.model_validate(c) for c in campaigns],
        featured_attractions=[attraction_out(a) for a in attractions],
        featured_experiences=[experience_out(e) for e in experiences],
        deals=[
            {"title": "۲۰٪ تخفیف اولین رزرو", "code": "WELCOME20", "description": "برای سفرهای بالای ۵ میلیون تومان"},
            {"title": "صبحانه رایگان", "code": "STAYMORE", "description": "در اقامتگاه‌های منتخب شیراز و اصفهان"},
        ],
        stats={
            "destinations": (await db.execute(select(func.count(Destination.id)))).scalar_one(),
            "accommodations": (await db.execute(select(func.count(Accommodation.id)))).scalar_one(),
            "attractions": (await db.execute(select(func.count(Attraction.id)))).scalar_one(),
            "experiences": (await db.execute(select(func.count(Experience.id)))).scalar_one(),
        },
    )
    await cache.set_json("home:v1", payload.model_dump(mode="json"), 180)
    return payload
