from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import Accommodation, Attraction, Experience, Restaurant
from app.db.session import get_db
from app.schemas.catalog import AttractionOut, ExperienceOut, RestaurantOut
from app.services.serializers import attraction_out, experience_out, restaurant_out

router = APIRouter(tags=["Discovery"])


@router.get("/attractions", response_model=Page[AttractionOut], summary="جاذبه‌های گردشگری")
async def list_attractions(
    destination_id: UUID | None = None,
    category: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    featured: bool | None = None,
    sort: str = Query(default="rating", pattern="^(rating|name|price)$"),
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[AttractionOut]:
    filters = [Attraction.is_active.is_(True)]
    if destination_id:
        filters.append(Attraction.destination_id == destination_id)
    if category:
        filters.append(Attraction.category == category)
    if q:
        filters.append(or_(Attraction.name.ilike(f"%{q}%"), Attraction.description.ilike(f"%{q}%")))
    if min_rating is not None:
        filters.append(Attraction.rating >= min_rating)
    if featured is not None:
        filters.append(Attraction.is_featured.is_(featured))
    total = (await db.execute(select(func.count(Attraction.id)).where(*filters))).scalar_one()
    order = {
        "rating": (Attraction.rating.desc(), Attraction.review_count.desc()),
        "name": (Attraction.name,),
        "price": (Attraction.ticket_price.asc(),),
    }[sort]
    rows = (
        await db.execute(
            select(Attraction)
            .options(selectinload(Attraction.destination))
            .where(*filters)
            .order_by(*order)
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([attraction_out(a) for a in rows], total, params)


@router.get("/attractions/{attraction_id}", response_model=AttractionOut, summary="جزئیات جاذبه")
async def get_attraction(attraction_id: UUID, db: AsyncSession = Depends(get_db)) -> AttractionOut:
    item = (
        await db.execute(
            select(Attraction)
            .options(selectinload(Attraction.destination))
            .where(Attraction.id == attraction_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("جاذبه یافت نشد.")
    return attraction_out(item)


@router.get("/restaurants", response_model=Page[RestaurantOut], summary="رستوران‌ها")
async def list_restaurants(
    destination_id: UUID | None = None,
    cuisine: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    price_range: int | None = Query(default=None, ge=1, le=4),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    sort: str = Query(default="rating", pattern="^(rating|price|name)$"),
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[RestaurantOut]:
    filters = [Restaurant.is_active.is_(True)]
    if destination_id:
        filters.append(Restaurant.destination_id == destination_id)
    if cuisine:
        filters.append(Restaurant.cuisine.ilike(f"%{cuisine}%"))
    if q:
        filters.append(or_(Restaurant.name.ilike(f"%{q}%"), Restaurant.description.ilike(f"%{q}%")))
    if price_range:
        filters.append(Restaurant.price_range == price_range)
    if min_rating is not None:
        filters.append(Restaurant.rating >= min_rating)
    total = (await db.execute(select(func.count(Restaurant.id)).where(*filters))).scalar_one()
    order = {
        "rating": (Restaurant.rating.desc(), Restaurant.review_count.desc()),
        "price": (Restaurant.average_price.asc(),),
        "name": (Restaurant.name,),
    }[sort]
    rows = (
        await db.execute(
            select(Restaurant)
            .options(selectinload(Restaurant.destination))
            .where(*filters)
            .order_by(*order)
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([restaurant_out(r) for r in rows], total, params)


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantOut, summary="جزئیات رستوران")
async def get_restaurant(restaurant_id: UUID, db: AsyncSession = Depends(get_db)) -> RestaurantOut:
    item = (
        await db.execute(
            select(Restaurant)
            .options(selectinload(Restaurant.destination))
            .where(Restaurant.id == restaurant_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("رستوران یافت نشد.")
    return restaurant_out(item)


@router.get("/experiences", response_model=Page[ExperienceOut], summary="تجربه‌های محلی")
async def list_experiences(
    destination_id: UUID | None = None,
    category: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    max_price: int | None = Query(default=None, ge=0),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    featured: bool | None = None,
    sort: str = Query(default="rating", pattern="^(rating|price|name)$"),
    params: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Page[ExperienceOut]:
    filters = [Experience.is_active.is_(True)]
    if destination_id:
        filters.append(Experience.destination_id == destination_id)
    if category:
        filters.append(Experience.category == category)
    if q:
        filters.append(or_(Experience.name.ilike(f"%{q}%"), Experience.description.ilike(f"%{q}%")))
    if max_price is not None:
        filters.append(Experience.price <= max_price)
    if min_rating is not None:
        filters.append(Experience.rating >= min_rating)
    if featured is not None:
        filters.append(Experience.is_featured.is_(featured))
    total = (await db.execute(select(func.count(Experience.id)).where(*filters))).scalar_one()
    order = {
        "rating": (Experience.rating.desc(), Experience.review_count.desc()),
        "price": (Experience.price.asc(),),
        "name": (Experience.name,),
    }[sort]
    rows = (
        await db.execute(
            select(Experience)
            .options(selectinload(Experience.destination))
            .where(*filters)
            .order_by(*order)
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([experience_out(e) for e in rows], total, params)


@router.get("/experiences/{experience_id}", response_model=ExperienceOut, summary="جزئیات تجربه")
async def get_experience(experience_id: UUID, db: AsyncSession = Depends(get_db)) -> ExperienceOut:
    item = (
        await db.execute(
            select(Experience)
            .options(selectinload(Experience.destination))
            .where(Experience.id == experience_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("تجربه یافت نشد.")
    return experience_out(item)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


@router.get("/discovery/nearby", summary="مکان‌های نزدیک")
async def nearby(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=5, ge=0.2, le=50),
    types: str = Query(default="accommodation,attraction,restaurant,experience"),
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict:
    requested = {x.strip() for x in types.split(",")}
    results: list[dict] = []
    if "accommodation" in requested:
        for item in (await db.execute(select(Accommodation).where(Accommodation.is_active.is_(True)))).scalars():
            d = _haversine_km(lat, lng, item.latitude, item.longitude)
            if d <= radius_km:
                results.append({"id": item.id, "type": "accommodation", "name": item.name, "lat": item.latitude, "lng": item.longitude, "distance_km": round(d, 2), "rating": item.guest_rating, "price": item.base_price, "image": item.images[0] if item.images else None, "slug": item.slug})
    if "attraction" in requested:
        for item in (await db.execute(select(Attraction).where(Attraction.is_active.is_(True)))).scalars():
            d = _haversine_km(lat, lng, item.latitude, item.longitude)
            if d <= radius_km:
                results.append({"id": item.id, "type": "attraction", "name": item.name, "lat": item.latitude, "lng": item.longitude, "distance_km": round(d, 2), "rating": item.rating, "image": item.image_url})
    if "restaurant" in requested:
        for item in (await db.execute(select(Restaurant).where(Restaurant.is_active.is_(True)))).scalars():
            d = _haversine_km(lat, lng, item.latitude, item.longitude)
            if d <= radius_km:
                results.append({"id": item.id, "type": "restaurant", "name": item.name, "lat": item.latitude, "lng": item.longitude, "distance_km": round(d, 2), "rating": item.rating, "image": item.image_url, "price_range": item.price_range})
    if "experience" in requested:
        for item in (await db.execute(select(Experience).where(Experience.is_active.is_(True)))).scalars():
            d = _haversine_km(lat, lng, item.latitude, item.longitude)
            if d <= radius_km:
                results.append({"id": item.id, "type": "experience", "name": item.name, "lat": item.latitude, "lng": item.longitude, "distance_km": round(d, 2), "rating": item.rating, "price": item.price, "image": item.image_url})
    results.sort(key=lambda x: x["distance_km"])
    return {"center": {"lat": lat, "lng": lng}, "radius_km": radius_km, "items": results[:limit]}
