from __future__ import annotations

import logging
import time

import orjson
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.cache import cache
from app.core.config import settings

logger = logging.getLogger("seir.rate_limit")

SKIP_PATHS = {
    "/",
    "/health",
    "/health/live",
    "/health/ready",
    "/docs",
    "/redoc",
    "/api/v1/openapi.json",
    "/favicon.ico",
}

AUTH_PREFIXES = ("/api/v1/auth", "/api/v1/payments", "/api/v1/orders")


def _client_ip(scope: Scope) -> str:
    headers = dict(scope.get("headers") or [])
    forwarded = headers.get(b"x-forwarded-for")
    if forwarded:
        return forwarded.decode("latin-1").split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


def _json_response(status_code: int, payload: dict, extra_headers: dict[str, str]) -> list[Message]:
    body = orjson.dumps(payload)
    headers = [
        (b"content-type", b"application/json; charset=utf-8"),
        (b"content-length", str(len(body)).encode()),
        (b"cache-control", b"no-store"),
    ]
    headers.extend((key.lower().encode(), value.encode()) for key, value in extra_headers.items())
    return [
        {"type": "http.response.start", "status": status_code, "headers": headers},
        {"type": "http.response.body", "body": body},
    ]


class RateLimitMiddleware:
    """Small Redis-backed fixed-window rate limiter with a memory fallback.

    The limiter intentionally lives in the ASGI layer so it also protects
    routes that fail before dependency resolution.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            not settings.rate_limit_enabled
            or scope["type"] != "http"
            or scope["method"] == "OPTIONS"
        ):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIP_PATHS or path.startswith(("/docs/", "/redoc/")):
            await self.app(scope, receive, send)
            return

        is_auth = path.startswith(AUTH_PREFIXES)
        limit = settings.auth_rate_limit_requests if is_auth else settings.rate_limit_requests
        window = settings.rate_limit_window_seconds
        bucket = "auth" if is_auth else "api"
        key = f"ratelimit:{bucket}:{_client_ip(scope)}:{int(time.time()) // window}"

        try:
            current = await cache.incr(key, window)
        except Exception:  # pragma: no cover - cache should never break traffic
            logger.debug("rate limiter unavailable; allowing request")
            await self.app(scope, receive, send)
            return

        if current > limit:
            for message in _json_response(
                429,
                {
                    "detail": "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.",
                    "code": "rate_limited",
                },
                {
                    "Retry-After": str(window),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            ):
                await send(message)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                headers.append((b"x-ratelimit-limit", str(limit).encode()))
                headers.append((b"x-ratelimit-remaining", str(max(0, limit - current)).encode()))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


class BodySizeLimitMiddleware:
    """Reject oversized requests early using the Content-Length header."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.max_bytes = settings.max_request_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers") or [])
        length = headers.get(b"content-length")
        if length is not None:
            try:
                if int(length) > self.max_bytes:
                    for message in _json_response(
                        413,
                        {
                            "detail": "حجم درخواست بیش از حد مجاز است.",
                            "code": "payload_too_large",
                        },
                        {},
                    ):
                        await send(message)
                    return
            except ValueError:
                pass
        await self.app(scope, receive, send)
