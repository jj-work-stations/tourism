from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_and_root(client: AsyncClient) -> None:
    health = await client.get("/health")
    assert health.status_code == 200
    payload = health.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"

    root = await client.get("/")
    assert root.status_code == 200
    assert root.json()["api"] == "/api/v1"


@pytest.mark.asyncio
async def test_home_and_catalog(client: AsyncClient) -> None:
    home = await client.get("/api/v1/home")
    assert home.status_code == 200
    data = home.json()
    assert data["stats"]["destinations"] >= 8
    assert data["popular_destinations"]

    destinations = await client.get("/api/v1/destinations", params={"limit": 50})
    assert destinations.status_code == 200
    items = destinations.json()["items"]
    slugs = {item["slug"] for item in items}
    assert {"tehran", "shiraz", "isfahan", "yazd", "kish"} <= slugs

    detail = await client.get("/api/v1/destinations/shiraz")
    assert detail.status_code == 200
    assert detail.json()["attraction_count"] > 0

    map_data = await client.get("/api/v1/destinations/shiraz/map")
    assert map_data.status_code == 200
    assert map_data.json()["markers"]

    weather = await client.get("/api/v1/destinations/shiraz/weather")
    assert weather.status_code == 200
    assert "temperature_c" in weather.json()

    suggest = await client.get("/api/v1/discovery/suggest", params={"q": "شیراز"})
    assert suggest.status_code == 200
    assert suggest.json()

    meta = await client.get("/api/v1/meta/options")
    assert meta.status_code == 200
    assert meta.json()["interests"]


@pytest.mark.asyncio
async def test_transport_search_alias_and_validation(client: AsyncClient) -> None:
    destinations = (await client.get("/api/v1/destinations", params={"limit": 50})).json()["items"]
    by_slug = {item["slug"]: item for item in destinations}
    travel_date = (date.today() + timedelta(days=3)).isoformat()

    response = await client.post(
        "/api/v1/search/transportation",
        json={
            "origin_id": by_slug["tehran"]["id"],
            "destination_id": by_slug["shiraz"]["id"],
            "date": travel_date,
            "passengers": 1,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] > 0
    assert body["items"][0]["origin"]["slug"] == "tehran"
    assert body["items"][0]["destination"]["slug"] == "shiraz"

    recent = await client.get("/api/v1/search/recent")
    assert recent.status_code == 200
    assert recent.json()

    invalid = await client.post(
        "/api/v1/search/transportation",
        json={
            "origin_id": by_slug["tehran"]["id"],
            "destination_id": by_slug["tehran"]["id"],
            "date": travel_date,
        },
    )
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_accommodation_search(client: AsyncClient) -> None:
    destinations = (await client.get("/api/v1/destinations", params={"limit": 50})).json()["items"]
    shiraz = next(item for item in destinations if item["slug"] == "shiraz")
    check_in = (date.today() + timedelta(days=4)).isoformat()
    check_out = (date.today() + timedelta(days=6)).isoformat()

    response = await client.post(
        "/api/v1/search/accommodations",
        json={
            "destination_id": shiraz["id"],
            "check_in": check_in,
            "check_out": check_out,
            "guests": 2,
            "rooms": 1,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] > 0
    card = body["items"][0]
    assert card["nights"] == 2
    assert card["total_price"] == card["min_price"] * 2

    by_slug = await client.get(f"/api/v1/accommodations/slug/{card['slug']}", params={
        "check_in": check_in, "check_out": check_out, "guests": 2
    })
    assert by_slug.status_code == 200, by_slug.text
    assert by_slug.json()["rooms"]
