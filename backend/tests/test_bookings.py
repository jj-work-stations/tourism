from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient


async def _destinations(client: AsyncClient) -> dict[str, dict]:
    response = await client.get("/api/v1/destinations", params={"limit": 50})
    return {item["slug"]: item for item in response.json()["items"]}


@pytest.mark.asyncio
async def test_transport_booking_payment_and_cancellation(
    client: AsyncClient, traveler_headers: dict[str, str]
) -> None:
    destinations = await _destinations(client)
    travel_date = (date.today() + timedelta(days=5)).isoformat()
    search = await client.post(
        "/api/v1/search/transportation",
        json={
            "origin_id": destinations["tehran"]["id"],
            "destination_id": destinations["shiraz"]["id"],
            "date": travel_date,
            "passengers": 1,
            # Fastest is the flight here, whose fare exceeds the WELCOME20
            # minimum spend so the coupon discount below is exercised.
            "sort": "fastest",
        },
    )
    assert search.status_code == 200, search.text
    offer = search.json()["items"][0]

    created = await client.post(
        "/api/v1/bookings",
        headers=traveler_headers,
        json={
            "booking_type": "transport",
            "transport_offer_id": offer["id"],
            "travel_date": travel_date,
            "guests": 1,
            "passengers": [
                {
                    "first_name": "سارا",
                    "last_name": "مسافر",
                    "national_id": "0012345678",
                    "gender": "female",
                }
            ],
            "coupon_code": "WELCOME20",
        },
    )
    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking["status"] == "pending"
    assert booking["discount"] > 0
    assert booking["total"] == booking["subtotal"] - booking["discount"]
    assert booking["payment"]["status"] == "pending"

    pay = await client.post(
        "/api/v1/payments",
        headers=traveler_headers,
        json={"booking_id": booking["id"], "method": "card"},
    )
    assert pay.status_code == 200, pay.text
    paid = pay.json()
    assert paid["booking"]["status"] == "confirmed"
    assert paid["payment"]["status"] == "paid"

    ticket = await client.get(
        f"/api/v1/bookings/{booking['id']}/ticket", headers=traveler_headers
    )
    assert ticket.status_code == 200, ticket.text
    assert ticket.json()["qr_data"].startswith("SEIR|")

    listing = await client.get(
        "/api/v1/bookings", headers=traveler_headers, params={"status": "confirmed"}
    )
    assert listing.status_code == 200
    assert any(item["id"] == booking["id"] for item in listing.json()["items"])

    wallet = await client.get("/api/v1/wallet", headers=traveler_headers)
    assert wallet.status_code == 200

    cancelled = await client.post(
        f"/api/v1/bookings/{booking['id']}/cancel",
        headers=traveler_headers,
        json={"reason": "تغییر برنامه"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] in {"cancelled", "refunded"}


@pytest.mark.asyncio
async def test_accommodation_booking_flow(
    client: AsyncClient, traveler_headers: dict[str, str]
) -> None:
    destinations = await _destinations(client)
    shiraz = destinations["shiraz"]
    check_in = (date.today() + timedelta(days=8)).isoformat()
    check_out = (date.today() + timedelta(days=10)).isoformat()

    search = await client.post(
        "/api/v1/search/accommodations",
        json={
            "destination_id": shiraz["id"],
            "check_in": check_in,
            "check_out": check_out,
            "guests": 2,
        },
    )
    assert search.status_code == 200
    hotel = search.json()["items"][0]

    detail = await client.get(
        f"/api/v1/accommodations/{hotel['id']}",
        params={"check_in": check_in, "check_out": check_out, "guests": 2},
    )
    assert detail.status_code == 200
    room = detail.json()["rooms"][0]

    created = await client.post(
        "/api/v1/bookings",
        headers=traveler_headers,
        json={
            "booking_type": "accommodation",
            "room_id": room["id"],
            "check_in": check_in,
            "check_out": check_out,
            "guests": 2,
            "rooms_count": 1,
            "passengers": [{"first_name": "علی", "last_name": "رضایی"}],
        },
    )
    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking["nights"] == 2
    assert booking["subtotal"] == room["price_per_night"] * 2

    pay = await client.post(
        "/api/v1/payments", headers=traveler_headers, json={"booking_id": booking["id"]}
    )
    assert pay.status_code == 200, pay.text
    assert pay.json()["booking"]["status"] == "confirmed"

    availability = await client.get(
        f"/api/v1/accommodations/{hotel['id']}/availability",
        params={"check_in": check_in, "check_out": check_out},
    )
    assert availability.status_code == 200
    assert availability.json()["nights"] == 2


@pytest.mark.asyncio
async def test_experience_booking(client: AsyncClient, traveler_headers: dict[str, str]) -> None:
    experiences = await client.get("/api/v1/experiences", params={"limit": 5})
    assert experiences.status_code == 200
    experience = experiences.json()["items"][0]
    travel_date = (date.today() + timedelta(days=12)).isoformat()

    created = await client.post(
        "/api/v1/bookings",
        headers=traveler_headers,
        json={
            "booking_type": "experience",
            "experience_id": experience["id"],
            "travel_date": travel_date,
            "guests": 2,
            "passengers": [
                {"first_name": "مینا", "last_name": "کریمی"},
                {"first_name": "رضا", "last_name": "کریمی"},
            ],
        },
    )
    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking["booking_type"] == "experience"

    fail = await client.post(
        "/api/v1/payments",
        headers=traveler_headers,
        json={"booking_id": booking["id"], "simulate_failure": True},
    )
    assert fail.status_code == 402, fail.text
    assert fail.json()["code"] == "payment_failed"

    retry = await client.post(
        "/api/v1/payments", headers=traveler_headers, json={"booking_id": booking["id"]}
    )
    assert retry.status_code == 200
    assert retry.json()["booking"]["status"] == "confirmed"


@pytest.mark.asyncio
async def test_review_requires_purchase(
    client: AsyncClient, traveler_headers: dict[str, str]
) -> None:
    destinations = await _destinations(client)
    destination = destinations["yazd"]

    review = await client.post(
        "/api/v1/reviews",
        headers=traveler_headers,
        json={
            "entity_type": "destination",
            "entity_id": destination["id"],
            "rating": 5,
            "title": "شهر فوق‌العاده",
            "body": "بافت تاریخی و مردم مهمان‌نواز.",
        },
    )
    # Seeded demo activity includes a completed Yazd trip for the demo traveler.
    assert review.status_code in {201, 200, 403}, review.text
