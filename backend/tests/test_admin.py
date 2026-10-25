from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_rbac(client: AsyncClient, traveler_headers: dict[str, str]) -> None:
    forbidden = await client.get("/api/v1/admin/stats", headers=traveler_headers)
    assert forbidden.status_code == 403
    anonymous = await client.get("/api/v1/admin/stats")
    assert anonymous.status_code == 401

    # Provider itself is allowed to hit only the provider portal.
    provider_token = (
        await client.post(
            "/api/v1/auth/login",
            json={"identifier": "provider@seir.ir", "password": "Provider123"},
        )
    ).json()["tokens"]["access_token"]
    provider_admin = await client.get(
        "/api/v1/admin/stats", headers={"Authorization": f"Bearer {provider_token}"}
    )
    assert provider_admin.status_code == 403


@pytest.mark.asyncio
async def test_admin_dashboard_and_management(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    stats = await client.get("/api/v1/admin/stats", headers=admin_headers)
    assert stats.status_code == 200, stats.text
    body = stats.json()
    assert body["total_users"] >= 5
    assert "revenue_series" in body
    assert "recent_bookings" in body

    users = await client.get("/api/v1/admin/users", headers=admin_headers)
    assert users.status_code == 200
    assert users.json()["total"] >= 5
    target = next(user for user in users.json()["items"] if user["email"] == "traveler@seir.ir")

    updated = await client.patch(
        f"/api/v1/admin/users/{target['id']}",
        headers=admin_headers,
        json={"is_verified": True},
    )
    assert updated.status_code == 200
    assert updated.json()["is_verified"] is True

    bookings = await client.get("/api/v1/admin/bookings", headers=admin_headers)
    assert bookings.status_code == 200

    reviews = await client.get("/api/v1/admin/reviews", headers=admin_headers)
    assert reviews.status_code == 200

    providers = await client.get("/api/v1/admin/providers", headers=admin_headers)
    assert providers.status_code == 200
    assert providers.json()


@pytest.mark.asyncio
async def test_provider_dashboard(
    client: AsyncClient, provider_headers: dict[str, str]
) -> None:
    dashboard = await client.get("/api/v1/provider/dashboard", headers=provider_headers)
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["provider_name"]
    assert body["services_count"] >= 1

    services = await client.get("/api/v1/provider/services", headers=provider_headers)
    assert services.status_code == 200
    assert services.json()["accommodations"] or services.json()["transport"]
