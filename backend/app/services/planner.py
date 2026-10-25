from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.db.models import (
    Accommodation,
    Attraction,
    Destination,
    Experience,
    Restaurant,
    TransportOffer,
)
from app.schemas.ai import PlanTripRequest
from app.schemas.trip import PlanActivity, PlanDay, TripPlan

INTEREST_CATEGORIES: dict[str, set[str]] = {
    "history": {"historical", "museum"},
    "تاریخ": {"historical", "museum"},
    "فرهنگ": {"cultural", "museum"},
    "culture": {"cultural", "museum"},
    "nature": {"natural"},
    "طبیعت": {"natural"},
    "food": {"food_tour", "cooking"},
    "غذا": {"food_tour", "cooking"},
    "adventure": {"adventure", "hiking"},
    "ماجراجویی": {"adventure", "hiking"},
    "photography": {"photography"},
    "عکاسی": {"photography"},
    "shopping": {"shopping"},
    "خرید": {"shopping"},
    "religion": {"religious"},
    "مذهبی": {"religious"},
    "family": {"entertainment"},
    "خانواده": {"entertainment"},
}

PACE_ATTRACTIONS = {"relaxed": 1, "balanced": 2, "packed": 3}
SLOT_TIMES = ["09:00", "11:00", "16:00"]
DAY_TITLES = ["ورود و آشنایی با شهر", "کشف جاذبه‌های شاخص", "تجربه‌های محلی", "گشت و خرید", "طبیعت‌گردی"]


def _interest_categories(interests: list[str]) -> set[str]:
    result: set[str] = set()
    for interest in interests:
        result |= INTEREST_CATEGORIES.get(interest.strip().lower(), set())
        result |= INTEREST_CATEGORIES.get(interest.strip(), set())
    return result


def _rank(items: list[Any], categories: set[str], category_attr: str = "category") -> list[Any]:
    def score(item: Any) -> float:
        category = getattr(item, category_attr, None)
        value = getattr(category, "value", str(category)) if category is not None else ""
        return (
            (5 if value in categories else 0)
            + float(getattr(item, "rating", 0)) * 2
            + (1 if getattr(item, "is_featured", False) else 0)
        )

    return sorted(items, key=score, reverse=True)


async def build_plan(
    db: AsyncSession,
    payload: PlanTripRequest,
) -> TripPlan:
    destination = await db.get(Destination, payload.destination_id)
    if destination is None:
        raise NotFoundError("مقصد یافت نشد.")

    attractions = list(
        (
            await db.execute(
                select(Attraction).where(
                    Attraction.destination_id == destination.id,
                    Attraction.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    restaurants = list(
        (
            await db.execute(
                select(Restaurant).where(
                    Restaurant.destination_id == destination.id,
                    Restaurant.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    experiences = list(
        (
            await db.execute(
                select(Experience).where(
                    Experience.destination_id == destination.id,
                    Experience.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    hotels = list(
        (
            await db.execute(
                select(Accommodation)
                .options(selectinload(Accommodation.rooms))
                .where(
                    Accommodation.destination_id == destination.id,
                    Accommodation.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    if not attractions and not experiences and not restaurants:
        raise NotFoundError("برای این مقصد هنوز محتوای کافی ثبت نشده است.")

    categories = _interest_categories(payload.interests)
    attractions = _rank(attractions, categories)
    experiences = _rank(experiences, categories | {"food_tour", "cooking"} if "غذا" in payload.interests else categories)
    restaurants = _rank(restaurants, set())

    nights = max(1, payload.days - 1)
    rooms_needed = max(1, (payload.travelers + 1) // 2)
    nightly_budget = int(payload.budget * 0.32 / nights) if payload.budget else None
    eligible_hotels = [
        h for h in hotels if nightly_budget is None or h.base_price <= nightly_budget
    ] or hotels
    hotel = (
        sorted(
            eligible_hotels,
            key=lambda h: (h.guest_rating, -h.base_price),
            reverse=True,
        )[0]
        if eligible_hotels
        else None
    )

    transport = None
    if payload.origin_id:
        offers = list(
            (
                await db.execute(
                    select(TransportOffer)
                    .options(
                        selectinload(TransportOffer.provider),
                        selectinload(TransportOffer.origin),
                        selectinload(TransportOffer.destination),
                    )
                    .where(
                        TransportOffer.origin_id == payload.origin_id,
                        TransportOffer.destination_id == destination.id,
                        TransportOffer.is_active.is_(True),
                    )
                    .order_by(TransportOffer.price.asc())
                    .limit(1)
                )
            ).scalars().all()
        )
        if offers:
            offer = offers[0]
            transport = {
                "id": str(offer.id),
                "type": offer.type.value,
                "provider": offer.provider.name,
                "price": offer.price,
                "departure_at": offer.departure_at.isoformat(),
                "arrival_at": offer.arrival_at.isoformat(),
                "duration_minutes": offer.duration_minutes,
            }

    start = payload.start_date or date.today() + timedelta(days=1)
    attractions_per_day = PACE_ATTRACTIONS[payload.pace]
    food_cost = 0
    activity_cost = 0
    attractions_cursor = 0
    restaurants_cursor = 0
    experiences_cursor = 0
    days: list[PlanDay] = []

    for day_index in range(payload.days):
        day_date = start + timedelta(days=day_index)
        is_first = day_index == 0
        is_last = day_index == payload.days - 1 and payload.days > 1
        activities: list[PlanActivity] = []
        day_cost = 0

        if is_first:
            activities.append(
                PlanActivity(
                    time="10:00",
                    end_time="12:00",
                    title=f"ورود به {destination.name} و استقرار در هتل",
                    description="تحویل اتاق، استراحت کوتاه و آماده‌سازی برای گشت شهری.",
                    activity_type="check_in",
                    location_name=hotel.name if hotel else destination.name,
                    latitude=hotel.latitude if hotel else destination.latitude,
                    longitude=hotel.longitude if hotel else destination.longitude,
                    cost=0,
                    entity_type="accommodation",
                    entity_id=hotel.id if hotel else None,
                )
            )

        lunch = restaurants[restaurants_cursor % len(restaurants)] if restaurants else None
        if lunch:
            food_cost += lunch.average_price * payload.travelers
            day_cost += lunch.average_price * payload.travelers
            activities.append(
                PlanActivity(
                    time="13:00",
                    end_time="14:15",
                    title=f"ناهار در {lunch.name}",
                    description=f"{lunch.cuisine} • امتیاز {lunch.rating}",
                    activity_type="restaurant",
                    location_name=lunch.address,
                    latitude=lunch.latitude,
                    longitude=lunch.longitude,
                    cost=lunch.average_price * payload.travelers,
                    entity_type="restaurant",
                    entity_id=lunch.id,
                )
            )
            restaurants_cursor += 1

        if is_last:
            activities.append(
                PlanActivity(
                    time="12:00",
                    title="تسویه حساب و آماده‌سازی برای بازگشت",
                    description="خروج از هتل و انتقال به ترمینال یا ایستگاه.",
                    activity_type="check_in",
                    location_name=hotel.name if hotel else destination.name,
                    cost=0,
                )
            )

        slots = 1 if is_last else (2 if is_first else attractions_per_day)
        for slot in range(slots):
            if attractions_cursor >= len(attractions):
                break
            attraction = attractions[attractions_cursor]
            attractions_cursor += 1
            time_value = SLOT_TIMES[(slot + (1 if is_first else 0)) % len(SLOT_TIMES)]
            if time_value in {"13:00", "20:00"}:
                time_value = "16:00" if slot else "09:00"
            ticket = attraction.ticket_price * payload.travelers
            activity_cost += ticket
            day_cost += ticket
            activities.append(
                PlanActivity(
                    time=time_value,
                    end_time=f"{int(time_value[:2]) + 2:02d}:{time_value[3:]}",
                    title=f"بازدید از {attraction.name}",
                    description=attraction.description[:300],
                    activity_type="attraction",
                    location_name=attraction.address,
                    latitude=attraction.latitude,
                    longitude=attraction.longitude,
                    cost=ticket,
                    entity_type="attraction",
                    entity_id=attraction.id,
                )
            )

        if (day_index % 2 == 1 or payload.pace == "packed") and experiences:
            experience = experiences[experiences_cursor % len(experiences)]
            experiences_cursor += 1
            cost = experience.price * payload.travelers
            activity_cost += cost
            day_cost += cost
            activities.append(
                PlanActivity(
                    time="17:30",
                    end_time=f"{17 + experience.duration_minutes // 60:02d}:{experience.duration_minutes % 60:02d}",
                    title=f"تجربه {experience.name}",
                    description=experience.description[:300],
                    activity_type="experience",
                    location_name=experience.meeting_point,
                    latitude=experience.latitude,
                    longitude=experience.longitude,
                    cost=cost,
                    entity_type="experience",
                    entity_id=experience.id,
                )
            )

        dinner = restaurants[restaurants_cursor % len(restaurants)] if restaurants else None
        if dinner:
            food_cost += dinner.average_price * payload.travelers
            day_cost += dinner.average_price * payload.travelers
            activities.append(
                PlanActivity(
                    time="20:00",
                    end_time="21:30",
                    title=f"شام در {dinner.name}",
                    description="طعم غذاهای محلی و استراحت شبانه.",
                    activity_type="restaurant",
                    location_name=dinner.address,
                    latitude=dinner.latitude,
                    longitude=dinner.longitude,
                    cost=dinner.average_price * payload.travelers,
                    entity_type="restaurant",
                    entity_id=dinner.id,
                )
            )
            restaurants_cursor += 1
            if dinner.signature_dishes:
                activities[-1].description = "پیشنهاد: " + "، ".join(dinner.signature_dishes[:3])

        activities.sort(key=lambda a: a.time)
        days.append(
            PlanDay(
                day_number=day_index + 1,
                date=day_date,
                title=(
                    f"روز {day_index + 1}: {DAY_TITLES[(day_index) % len(DAY_TITLES)]}"
                    if not is_first
                    else f"روز ۱: {DAY_TITLES[0]}"
                ),
                estimated_cost=day_cost,
                activities=activities,
            )
        )

    lodging_cost = hotel.base_price * nights * rooms_needed if hotel else 0
    transport_cost = int(transport["price"]) * payload.travelers if transport else 0
    other_cost = int((food_cost + activity_cost + lodging_cost + transport_cost) * 0.05)
    estimated_total = food_cost + activity_cost + lodging_cost + transport_cost + other_cost
    remaining = payload.budget - estimated_total if payload.budget else 0
    breakdown = {
        "transport": transport_cost,
        "accommodation": lodging_cost,
        "food": food_cost,
        "activities": activity_cost,
        "other": other_cost,
    }
    tips = [
        f"بهترین فصل سفر به {destination.name}: {destination.best_season or 'بهار و پاییز'}",
        "قیمت‌ها تخمینی هستند و در زمان رزرو نهایی می‌شوند.",
    ]
    if payload.budget and remaining < 0:
        tips.append("برنامه پیشنهادی از بودجه شما بیشتر است؛ می‌توانید هتل اقتصادی‌تر یا تعداد روزها را کمتر کنید.")
    if not transport:
        tips.append("برای مشاهده بلیت‌های حمل‌ونقل، مبدأ سفر را مشخص کنید.")
    if destination.tags:
        tips.append("می‌توانید از تجربه‌های محلی مانند " + "، ".join(destination.tags[:2]) + " هم دیدن کنید.")

    from app.schemas.common import DestinationBrief

    return TripPlan(
        destination=DestinationBrief.model_validate(destination),
        title=f"{payload.days} روز در {destination.name}",
        days=days,
        estimated_total=estimated_total,
        budget=payload.budget,
        budget_remaining=remaining,
        budget_breakdown=breakdown,
        suggested_hotel=(
            {
                "id": str(hotel.id),
                "name": hotel.name,
                "slug": hotel.slug,
                "price": hotel.base_price,
                "rating": hotel.guest_rating,
                "image_url": hotel.images[0] if hotel.images else None,
            }
            if hotel
            else None
        ),
        suggested_transport=transport,
        tips=tips,
    )
