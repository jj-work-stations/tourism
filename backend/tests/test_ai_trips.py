from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_plan_and_assistant(client: AsyncClient) -> None:
    destinations = (await client.get("/api/v1/destinations", params={"limit": 50})).json()["items"]
    shiraz = next(item for item in destinations if item["slug"] == "shiraz")

    plan = await client.post(
        "/api/v1/ai/plan-trip",
        json={
            "destination_id": shiraz["id"],
            "days": 3,
            "budget": 20_000_000,
            "travelers": 2,
            "interests": ["history", "food"],
            "start_date": (date.today() + timedelta(days=10)).isoformat(),
        },
    )
    assert plan.status_code == 200, plan.text
    body = plan.json()
    assert len(body["days"]) == 3
    assert body["estimated_total"] > 0
    assert body["budget_breakdown"]
    assert body["suggested_hotel"] is not None

    assistant = await client.post(
        "/api/v1/ai/travel-assistant",
        json={"message": "سه روز می‌خوام برم شیراز، بودجه ۱۵ میلیون و به غذا علاقه دارم"},
    )
    assert assistant.status_code == 200, assistant.text
    reply = assistant.json()
    assert reply["intent"] in {"trip_plan", "plan_trip"}
    assert reply["plan"]["destination"]["slug"] == "shiraz"

    unknown = await client.post(
        "/api/v1/ai/travel-assistant", json={"message": "سلام، یه سفر خوب پیشنهاد بده"}
    )
    assert unknown.status_code == 200
    assert unknown.json()["intent"] == "recommend_destinations"


@pytest.mark.asyncio
async def test_trip_lifecycle(
    client: AsyncClient, traveler_headers: dict[str, str]
) -> None:
    destinations = (await client.get("/api/v1/destinations", params={"limit": 50})).json()["items"]
    isfahan = next(item for item in destinations if item["slug"] == "isfahan")
    start = date.today() + timedelta(days=20)
    end = start + timedelta(days=2)

    created = await client.post(
        "/api/v1/trips",
        headers=traveler_headers,
        json={
            "destination_id": isfahan["id"],
            "title": "سفر به اصفهان",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "travelers": 2,
            "budget": 15_000_000,
            "interests": ["history", "food"],
        },
    )
    assert created.status_code == 201, created.text
    trip = created.json()
    assert len(trip["days"]) == 3

    auto = await client.post(
        f"/api/v1/trips/{trip['id']}/auto-plan",
        headers=traveler_headers,
        json={"interests": ["history"], "pace": "balanced"},
    )
    assert auto.status_code == 200, auto.text
    planned = auto.json()
    assert planned["budget_breakdown"]
    assert any(day["activities"] for day in planned["days"])

    add = await client.post(
        f"/api/v1/trips/{trip['id']}/activities",
        headers=traveler_headers,
        json={
            "day_number": 1,
            "activity_type": "note",
            "title": "خرید سوغات",
            "start_time": "18:00:00",
            "cost": 500_000,
        },
    )
    assert add.status_code == 200, add.text
    assert any(
        activity["title"] == "خرید سوغات"
        for day in add.json()["days"]
        for activity in day["activities"]
    )

    timeline = await client.get(
        f"/api/v1/trips/{trip['id']}/timeline", headers=traveler_headers
    )
    assert timeline.status_code == 200
    assert timeline.json()["events"]

    published = await client.post(
        f"/api/v1/trips/{trip['id']}/publish", headers=traveler_headers
    )
    assert published.status_code == 200
    share_slug = published.json()["share_slug"]
    assert share_slug

    public = await client.get(f"/api/v1/trips/public/{share_slug}")
    assert public.status_code == 200
    assert public.json()["bookings"] == []

    summary = await client.get(
        f"/api/v1/trips/{trip['id']}/booking-summary", headers=traveler_headers
    )
    assert summary.status_code == 200

    listing = await client.get(
        "/api/v1/trips", headers=traveler_headers, params={"tab": "upcoming"}
    )
    assert listing.status_code == 200
    assert any(item["id"] == trip["id"] for item in listing.json()["items"])


@pytest.mark.asyncio
async def test_gamification_wallet_and_notifications(
    client: AsyncClient, traveler_headers: dict[str, str]
) -> None:
    profile = await client.get("/api/v1/gamification/profile", headers=traveler_headers)
    assert profile.status_code == 200, profile.text
    data = profile.json()
    assert data["level"] in {"bronze", "silver", "gold", "platinum"}
    assert data["achievements"]
    assert data["challenges"]

    leaderboard = await client.get("/api/v1/gamification/leaderboard")
    assert leaderboard.status_code == 200
    assert leaderboard.json()

    wallet = await client.get("/api/v1/wallet", headers=traveler_headers)
    assert wallet.status_code == 200
    balance = wallet.json()["balance"]

    topup = await client.post(
        "/api/v1/wallet/top-up", headers=traveler_headers, json={"amount": 100_000}
    )
    assert topup.status_code == 200, topup.text
    assert topup.json()["balance"] == balance + 100_000

    transactions = await client.get("/api/v1/wallet/transactions", headers=traveler_headers)
    assert transactions.status_code == 200
    assert transactions.json()["items"]

    notifications = await client.get("/api/v1/notifications", headers=traveler_headers)
    assert notifications.status_code == 200
    unread = await client.get("/api/v1/notifications/unread-count", headers=traveler_headers)
    assert unread.status_code == 200
    assert "count" in unread.json()
    if notifications.json()["items"]:
        notification_id = notifications.json()["items"][0]["id"]
        read = await client.patch(
            f"/api/v1/notifications/{notification_id}/read", headers=traveler_headers
        )
        assert read.status_code == 200
        assert read.json()["is_read"] is True


@pytest.mark.asyncio
async def test_support_and_events(client: AsyncClient, traveler_headers: dict[str, str]) -> None:
    faq = await client.get("/api/v1/support/faq")
    assert faq.status_code == 200
    assert faq.json()

    ticket = await client.post(
        "/api/v1/support/tickets",
        headers=traveler_headers,
        json={
            "subject": "سؤال درباره لغو رزرو",
            "message": "چطور می‌توانم بلیت خود را لغو کنم؟",
            "category": "booking",
            "priority": "normal",
        },
    )
    assert ticket.status_code == 201, ticket.text
    ticket_id = ticket.json()["id"]

    tickets = await client.get("/api/v1/support/tickets", headers=traveler_headers)
    assert tickets.status_code == 200
    assert any(item["id"] == ticket_id for item in tickets.json()["items"])

    closed = await client.post(
        f"/api/v1/support/tickets/{ticket_id}/close", headers=traveler_headers
    )
    assert closed.status_code == 200

    event = await client.post(
        "/api/v1/events",
        headers=traveler_headers,
        json={"name": "app_opened", "path": "/", "properties": {"source": "test"}},
    )
    assert event.status_code == 200
