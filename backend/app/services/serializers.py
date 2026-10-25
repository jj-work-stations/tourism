from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Accommodation,
    Attraction,
    Booking,
    BookingStatus,
    Destination,
    Experience,
    Favorite,
    Review,
    Restaurant,
    Trip,
)
from app.schemas.accommodation import AccommodationCard, AccommodationDetail
from app.schemas.booking import BookingOut, PaymentOut
from app.schemas.catalog import (
    AttractionOut,
    DestinationOut,
    ExperienceOut,
    RestaurantOut,
)
from app.schemas.engagement import FavoriteOut, ReviewOut
from app.schemas.transport import TransportOfferOut
from app.schemas.trip import TripOut


def destination_out(destination: Destination, **extra: Any) -> DestinationOut:
    data = DestinationOut.model_validate(destination)
    return data.model_copy(update=extra) if extra else data


def attraction_out(attraction: Attraction) -> AttractionOut:
    data = AttractionOut.model_validate(attraction)
    return data.model_copy(
        update={"destination_name": attraction.destination.name if attraction.destination else None}
    )


def restaurant_out(restaurant: Restaurant) -> RestaurantOut:
    data = RestaurantOut.model_validate(restaurant)
    return data.model_copy(
        update={"destination_name": restaurant.destination.name if restaurant.destination else None}
    )


def experience_out(experience: Experience) -> ExperienceOut:
    data = ExperienceOut.model_validate(experience)
    return data.model_copy(
        update={"destination_name": experience.destination.name if experience.destination else None}
    )


def transport_offer_out(offer: Any) -> TransportOfferOut:
    return TransportOfferOut.model_validate(offer)


def accommodation_card(
    item: Accommodation,
    *,
    nights: int = 0,
    min_price: int | None = None,
    rooms_available: int | None = None,
) -> AccommodationCard:
    price = min_price or item.base_price
    data = AccommodationCard.model_validate(item)
    return data.model_copy(
        update={
            "destination_name": item.destination.name if item.destination else None,
            "min_price": price,
            "total_price": price * nights if nights else None,
            "nights": nights,
            "rooms_available": rooms_available,
        }
    )


def accommodation_detail(item: Accommodation, nearby: list[dict[str, Any]] | None = None) -> AccommodationDetail:
    data = AccommodationDetail.model_validate(item)
    return data.model_copy(
        update={
            "destination_name": item.destination.name if item.destination else None,
            "nearby_attractions": nearby or [],
        }
    )


def payment_out(payment: Any) -> PaymentOut:
    return PaymentOut.model_validate(payment)


def booking_out(booking: Booking, *, now: datetime | None = None) -> BookingOut:
    now = now or datetime.now(UTC)
    data = BookingOut.model_validate(booking)
    image_url: str | None = None
    if booking.accommodation and booking.accommodation.images:
        image_url = booking.accommodation.images[0]
    elif booking.experience and booking.experience.image_url:
        image_url = booking.experience.image_url
    elif booking.destination and booking.destination.image_url:
        image_url = booking.destination.image_url
    latest_payment = None
    if booking.payments:
        latest_payment = sorted(booking.payments, key=lambda p: p.created_at)[-1]
    start: date | None = booking.check_in or booking.travel_date
    can_cancel = booking.status in {BookingStatus.PENDING, BookingStatus.CONFIRMED}
    if booking.cancellation_deadline is not None:
        deadline = booking.cancellation_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=UTC)
        can_cancel = can_cancel and deadline > now
    if start is not None and start < now.date():
        can_cancel = False
    return data.model_copy(
        update={
            "image_url": image_url,
            "payment": payment_out(latest_payment) if latest_payment else None,
            "can_cancel": can_cancel,
        }
    )


def review_out(review: Review) -> ReviewOut:
    return ReviewOut.model_validate(review)


def trip_out(trip: Trip) -> TripOut:
    return TripOut.model_validate(trip)


async def resolve_entity(db: AsyncSession, entity_type: str, entity_id: UUID) -> dict[str, Any] | None:
    model_map: dict[str, Any] = {
        "destination": Destination,
        "accommodation": Accommodation,
        "attraction": Attraction,
        "restaurant": Restaurant,
        "experience": Experience,
    }
    model = model_map.get(entity_type)
    if model is None:
        return None
    item = await db.get(model, entity_id)
    if item is None:
        return None
    if entity_type == "destination":
        return {
            "title": item.name,
            "subtitle": item.country,
            "image_url": item.image_url,
            "slug": item.slug,
            "url": f"/destinations/{item.slug}",
            "rating": None,
            "price": None,
        }
    if entity_type == "accommodation":
        return {
            "title": item.name,
            "subtitle": item.address,
            "image_url": item.images[0] if item.images else None,
            "slug": item.slug,
            "url": f"/stays/{item.id}",
            "rating": item.guest_rating,
            "price": item.base_price,
        }
    if entity_type == "experience":
        return {
            "title": item.name,
            "subtitle": item.meeting_point,
            "image_url": item.image_url,
            "slug": item.slug,
            "url": f"/experiences/{item.id}",
            "rating": item.rating,
            "price": item.price,
        }
    return {
        "title": item.name,
        "subtitle": getattr(item, "address", ""),
        "image_url": getattr(item, "image_url", None),
        "slug": item.slug,
        "url": f"/discover/{entity_type}/{item.id}",
        "rating": getattr(item, "rating", None),
        "price": getattr(item, "ticket_price", None),
    }


async def favorite_out(db: AsyncSession, favorite: Favorite) -> FavoriteOut:
    entity = await resolve_entity(db, favorite.entity_type.value, favorite.entity_id)
    payload = {
        "id": favorite.id,
        "entity_type": favorite.entity_type.value,
        "entity_id": favorite.entity_id,
        "created_at": favorite.created_at,
        **(entity or {}),
    }
    return FavoriteOut.model_validate(payload)


async def booked_entity_ids(
    db: AsyncSession, user_id: UUID, entity_type: str
) -> set[str]:
    type_map = {
        "accommodation": Booking.accommodation_id,
        "transport": Booking.transport_offer_id,
        "experience": Booking.experience_id,
    }
    column = type_map.get(entity_type)
    if column is None:
        return set()
    result = await db.execute(
        select(column).where(
            Booking.user_id == user_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
            column.is_not(None),
        )
    )
    return {str(row[0]) for row in result.all() if row[0]}
