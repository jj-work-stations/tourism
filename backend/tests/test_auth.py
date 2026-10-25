from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_login_refresh(client: AsyncClient) -> None:
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    register = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Pass12345",
            "full_name": "کاربر تست",
            "phone": "09121234567",
            "city": "شیراز",
        },
    )
    assert register.status_code == 201, register.text
    body = register.json()
    assert body["user"]["email"] == email
    assert body["tokens"]["access_token"]

    duplicate = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Pass12345", "full_name": "کاربر تکراری"},
    )
    assert duplicate.status_code == 409

    bad_login = await client.post(
        "/api/v1/auth/login", json={"identifier": email, "password": "wrong-password"}
    )
    assert bad_login.status_code == 401

    login = await client.post(
        "/api/v1/auth/login", json={"identifier": email, "password": "Pass12345"}
    )
    assert login.status_code == 200
    tokens = login.json()["tokens"]

    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = await client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["full_name"] == "کاربر تست"

    updated = await client.patch(
        "/api/v1/users/me", headers=headers, json={"city": "تهران", "locale": "fa"}
    )
    assert updated.status_code == 200
    assert updated.json()["city"] == "تهران"

    preferences = await client.put(
        "/api/v1/users/me/preferences",
        headers=headers,
        json={"interests": ["food", "history"], "budget_level": "mid", "travel_style": "balanced"},
    )
    assert preferences.status_code == 200
    assert preferences.json()["interests"] == ["food", "history"]


@pytest.mark.asyncio
async def test_otp_login_flow(client: AsyncClient) -> None:
    phone = f"0912{uuid.uuid4().int % 10_000_000:07d}"
    request = await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert request.status_code == 200, request.text
    code = request.json()["debug_code"]
    assert code

    verify = await client.post(
        "/api/v1/auth/otp/verify", json={"phone": phone, "code": code, "full_name": "مسافر جدید"}
    )
    assert verify.status_code == 200, verify.text
    assert verify.json()["tokens"]["access_token"]


@pytest.mark.asyncio
async def test_profile_stats_and_change_password(client: AsyncClient) -> None:
    email = f"pwd-{uuid.uuid4().hex[:8]}@example.com"
    old_password = "OldPass123"
    new_password = "NewPass456"
    register = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": old_password, "full_name": "تست رمز"},
    )
    assert register.status_code == 201
    headers = {"Authorization": f"Bearer {register.json()['tokens']['access_token']}"}

    stats = await client.get("/api/v1/users/me/stats", headers=headers)
    assert stats.status_code == 200

    changed = await client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": old_password, "new_password": new_password},
    )
    assert changed.status_code == 200, changed.text

    login = await client.post(
        "/api/v1/auth/login", json={"identifier": email, "password": new_password}
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_favorites_roundtrip(client: AsyncClient, traveler_headers: dict[str, str]) -> None:
    destinations = (await client.get("/api/v1/destinations", params={"limit": 5})).json()["items"]
    destination = destinations[0]

    created = await client.post(
        "/api/v1/favorites",
        headers=traveler_headers,
        json={"entity_type": "destination", "entity_id": destination["id"]},
    )
    assert created.status_code == 200, created.text
    favorite = created.json()
    assert favorite["entity_id"] == destination["id"]

    listing = await client.get("/api/v1/favorites", headers=traveler_headers)
    assert listing.status_code == 200
    assert any(item["id"] == favorite["id"] for item in listing.json()["items"])

    removed = await client.delete(
        f"/api/v1/favorites/destination/{destination['id']}", headers=traveler_headers
    )
    assert removed.status_code == 200

    unauthorized = await client.get("/api/v1/favorites")
    assert unauthorized.status_code == 401
