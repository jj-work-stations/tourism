from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import ACCESS_TOKEN, decode_token
from app.db.models import Role, User
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")


async def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> User | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_token(credentials.credentials, expected_type=ACCESS_TOKEN)
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await _user_from_credentials(credentials, db)
    if user is None:
        raise UnauthorizedError()
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    return await _user_from_credentials(credentials, db)


def require_roles(*roles: Role | str) -> Callable:
    allowed = {Role(role) if isinstance(role, str) else role for role in roles}

    async def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise ForbiddenError()
        return user

    return dependency


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
