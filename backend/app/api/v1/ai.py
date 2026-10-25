from __future__ import annotations

import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_optional_user
from app.core.errors import NotFoundError
from app.db.models import Destination, Trip, User
from app.db.session import get_db
from app.schemas.ai import (
    AssistantRequest,
    AssistantResponse,
    ModifyTripRequest,
    PlanTripRequest,
    RecommendationResponse,
)
from app.schemas.common import DestinationBrief
from app.schemas.trip import TripPlan
from app.services.ai import polish_reply
from app.services.bookings import track_event
from app.services.planner import build_plan
from app.services.recommendations import recommend_destinations

router = APIRouter(prefix="/ai", tags=["AI Travel Assistant"])

PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

PERSIAN_DAY_WORDS: dict[str, int] = {
    "یک": 1,
    "دو": 2,
    "سه": 3,
    "چهار": 4,
    "پنج": 5,
    "شش": 6,
    "هفت": 7,
    "هشت": 8,
    "نه": 9,
    "ده": 10,
    "یازده": 11,
    "دوازده": 12,
    "سیزده": 13,
    "چهارده": 14,
    "پانزده": 15,
    "شانزده": 16,
    "هفده": 17,
    "هجده": 18,
    "نوزده": 19,
    "بیست": 20,
}

INTEREST_KEYWORDS: dict[str, str] = {
    "تاریخ": "history",
    "historical": "history",
    "موزه": "history",
    "فرهنگ": "culture",
    "culture": "culture",
    "طبیعت": "nature",
    "nature": "nature",
    "کوه": "nature",
    "غذا": "food",
    "غذایی": "food",
    "food": "food",
    "خرید": "shopping",
    "shopping": "shopping",
    "ماجرا": "adventure",
    "adventure": "adventure",
    "عکاسی": "photography",
    "photography": "photography",
    "مذهبی": "religion",
    "زیارتی": "religion",
    "خانواده": "family",
    "family": "family",
    "دریا": "nature",
    "ساحل": "nature",
}


def _normalize_digits(text: str) -> str:
    return text.translate(PERSIAN_DIGITS)


def _parse_days(text: str) -> int | None:
    match = re.search(r"(\d+)\s*(?:روز|day|days)", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    # Persian speakers often write the duration as a word ("سه روز").
    word = re.search(r"(یک|دو|سه|چهار|پنج|شش|ششت|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)\s*روز", text)
    if word:
        return PERSIAN_DAY_WORDS[word.group(1)]
    weeks = re.search(r"(یک|دو|سه|چهار)\s*(?:هفته|week|weeks)", text, re.IGNORECASE)
    if weeks:
        return PERSIAN_DAY_WORDS[weeks.group(1)] * 7
    return None


def _parse_budget(text: str) -> int | None:
    match = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(میلیون|میلیارد|million|billion)", text, re.IGNORECASE
    )
    if match:
        amount = float(match.group(1).replace(",", "."))
        multiplier = 1_000_000_000 if match.group(2) in {"میلیارد", "billion"} else 1_000_000
        return int(amount * multiplier)
    match = re.search(r"(?:بودجه|budget)[^\d]{0,12}(\d{6,})", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _parse_interests(text: str) -> list[str]:
    found: list[str] = []
    lowered = text.lower()
    for keyword, interest in INTEREST_KEYWORDS.items():
        if keyword in lowered and interest not in found:
            found.append(interest)
    return found


def _find_destination(message: str, destinations: list[Destination]) -> Destination | None:
    lowered = message.lower()
    for dest in destinations:
        for candidate in (dest.name, dest.name_local, dest.slug, dest.name_local.replace(" ", "")):
            if candidate and candidate.lower() in lowered:
                return dest
    return None


def _format_money(amount: int) -> str:
    if amount >= 1_000_000:
        value = amount / 1_000_000
        return f"{value:,.1f}".rstrip("0").rstrip(".") + " میلیون تومان"
    return f"{amount:,} تومان"


def _plan_reply(plan: TripPlan, days: int) -> str:
    lines = [
        f"برنامه {days} روزه {plan.destination.name} آماده شد ✨",
        f"برآورد هزینه: {_format_money(plan.estimated_total)}",
    ]
    if plan.budget:
        status = "در محدوده بودجه" if plan.budget_remaining >= 0 else "بیشتر از بودجه"
        lines.append(f"بودجه شما: {_format_money(plan.budget)} ({status})")
    lines.append("خلاصه روزها:")
    for day in plan.days[:5]:
        titles = "، ".join(a.title for a in day.activities[:2])
        lines.append(f"• روز {day.day_number}: {titles}")
    lines.append("برای رزرو هتل و بلیت، از دکمه‌های پیشنهادی دستیار استفاده کنید.")
    return "\n".join(lines)


@router.post("/plan-trip", response_model=TripPlan, summary="ساخت برنامه سفر")
async def plan_trip(
    payload: PlanTripRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> TripPlan:
    plan = await build_plan(db, payload)
    await track_event(
        db,
        user.id if user else None,
        "ai_plan_requested",
        {"destination_id": str(payload.destination_id), "days": payload.days, "budget": payload.budget},
        "/ai",
    )
    await db.commit()
    return plan


@router.post("/travel-assistant", response_model=AssistantResponse, summary="دستیار هوشمند سفر")
async def travel_assistant(
    payload: AssistantRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantResponse:
    normalized = _normalize_digits(payload.message)
    destinations = list((await db.execute(select(Destination))).scalars().all())
    destination = (
        await db.get(Destination, payload.destination_id) if payload.destination_id else None
    )
    if destination is None:
        destination = _find_destination(payload.message, destinations)
    days = payload.days or _parse_days(normalized)
    budget = payload.budget if payload.budget is not None else _parse_budget(normalized)
    interests = payload.interests or _parse_interests(payload.message)

    if destination is None:
        recs = await recommend_destinations(db, user, limit=4)
        suggestions = [
            {
                "id": str(item.destination.id),
                "slug": item.destination.slug,
                "name": item.destination.name,
                "reason": item.reason,
                "image_url": item.destination.image_url,
            }
            for item in recs.items
        ]
        names = "، ".join(item.destination.name for item in recs.items[:3])
        reply = (
            f"مقصد خاصی را متوجه نشدم؛ اما این‌ها را پیشنهاد می‌کنم: {names}.\n"
            "بگویید چند روز سفر می‌کنید و بودجه‌تان چقدر است تا برنامه دقیق بسازم."
        )
        await track_event(
            db, user.id if user else None, "ai_plan_requested",
            {"intent": "recommend", "message": payload.message[:180]}, "/ai",
        )
        await db.commit()
        return AssistantResponse(
            reply=reply,
            intent="recommend_destinations",
            follow_up_questions=["چند روز سفر می‌کنید؟", "بودجه تقریبی‌تان چقدر است؟"],
            suggestions=suggestions,
        )

    if days is None:
        reply = (
            f"عالی! {destination.name} انتخاب خوبی است. "
            "چند روز می‌خواهید بمانید و بودجه تقریبی‌تان چقدر است؟"
        )
        polished = await polish_reply(
            payload.message,
            f"مقصد: {destination.name}. از کاربر تعداد روز و بودجه را بپرس.",
            reply,
        )
        return AssistantResponse(
            reply=polished,
            intent="plan_trip",
            destination=DestinationBrief.model_validate(destination),
            follow_up_questions=["چند روز؟", "بودجه تقریبی؟", "علاقه‌مندی‌های اصلی؟"],
        )

    plan = await build_plan(
        db,
        PlanTripRequest(
            destination_id=destination.id,
            days=days,
            budget=budget or 0,
            travelers=payload.travelers,
            interests=interests,
            start_date=date.today() + timedelta(days=7),
            pace="balanced",
        ),
    )
    fallback = _plan_reply(plan, days)
    context = (
        f"مقصد: {destination.name}، روزها: {days}، بودجه: {budget or 'نامشخص'}، "
        f"هزینه تخمینی: {plan.estimated_total}، علائق: {', '.join(interests) or 'عمومی'}."
    )
    reply = await polish_reply(payload.message, context, fallback)
    await track_event(
        db,
        user.id if user else None,
        "ai_plan_requested",
        {"destination_id": str(destination.id), "days": days, "budget": budget},
        "/ai",
    )
    await db.commit()
    return AssistantResponse(
        reply=reply,
        intent="trip_plan",
        destination=DestinationBrief.model_validate(destination),
        plan=plan,
        suggestions=[
            {
                "type": "hotel",
                "name": plan.suggested_hotel["name"],
                "url": f"/stays/{plan.suggested_hotel['id']}",
            }
        ]
        if plan.suggested_hotel
        else [],
    )


@router.post("/recommend", response_model=RecommendationResponse, summary="پیشنهاد هوشمند")
async def recommend(
    limit: int = 8,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    return await recommend_destinations(db, user, max(1, min(limit, 20)))


@router.post("/modify-trip", response_model=TripPlan, summary="بازطراحی برنامه سفر")
async def modify_trip(
    payload: ModifyTripRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripPlan:
    trip = await db.get(Trip, payload.trip_id)
    if trip is None or (trip.user_id != user.id and user.role.value != "admin"):
        raise NotFoundError("سفر یافت نشد.")
    days = payload.days or ((trip.end_date - trip.start_date).days + 1)
    plan = await build_plan(
        db,
        PlanTripRequest(
            destination_id=trip.destination_id,
            origin_id=trip.origin_id,
            days=days,
            budget=payload.budget if payload.budget is not None else trip.budget,
            travelers=payload.travelers or trip.travelers,
            interests=payload.interests or trip.interests,
            start_date=trip.start_date,
            pace=payload.pace,
        ),
    )
    return plan
