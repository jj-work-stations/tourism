from __future__ import annotations

import os
from pathlib import Path

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

DB_PATH = Path("/tmp/opencode/seir_test.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DB_PATH.unlink(missing_ok=True)

os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite+aiosqlite:///{DB_PATH}",
        "REDIS_URL": "",
        "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-tests",
        "AUTO_CREATE_SCHEMA": "true",
        "SEED_ON_STARTUP": "true",
        "RATE_LIMIT_ENABLED": "false",
        "OTP_DEBUG": "true",
        "DEBUG": "false",
    }
)

from app.main import app  # noqa: E402


@pytest_asyncio.fixture(scope="session")
async def client():
    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as http:
            yield http


async def login(client: AsyncClient, identifier: str, password: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": password}
    )
    assert response.status_code == 200, response.text
    token = response.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def traveler_headers(client: AsyncClient) -> dict[str, str]:
    return await login(client, "traveler@seir.ir", "Traveler123")


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient) -> dict[str, str]:
    return await login(client, "admin@seir.ir", "Admin12345")


@pytest_asyncio.fixture
async def provider_headers(client: AsyncClient) -> dict[str, str]:
    return await login(client, "provider@seir.ir", "Provider123")


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"
