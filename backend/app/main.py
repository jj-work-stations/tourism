from __future__ import annotations

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import ORJSONResponse
from sqlalchemy import text

from app.api.router import api_router
from app.core.cache import cache
from app.core.config import settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import BodySizeLimitMiddleware, RateLimitMiddleware
from app.db.base import Base
from app.db.seed import seed_all
from app.db.session import SessionLocal, engine
from app.services.bookings import expire_pending_bookings

logger = logging.getLogger("seir.main")


async def _expiry_loop() -> None:
    while True:
        await asyncio.sleep(300)
        try:
            async with SessionLocal() as db:
                count = await expire_pending_bookings(db)
                if count:
                    logger.info("expired %s pending bookings", count)
        except Exception:
            logger.exception("booking expiry loop failed")


DEFAULT_SECRET = "change-me-in-production-a-long-random-secret-value"


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.debug)
    logger.info("starting %s (%s)", settings.app_name, settings.environment)
    if settings.is_production and settings.jwt_secret_key == DEFAULT_SECRET:
        raise RuntimeError("JWT_SECRET_KEY must be configured in production.")
    if settings.is_production and settings.auto_create_schema:
        logger.warning("AUTO_CREATE_SCHEMA is enabled in production; prefer Alembic migrations.")
    if settings.is_production and settings.seed_on_startup:
        logger.warning("SEED_ON_STARTUP is enabled in production; disable it for real deployments.")
    if settings.auto_create_schema:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    if settings.seed_on_startup:
        try:
            async with SessionLocal() as db:
                await seed_all(db)
        except Exception:
            logger.exception("seed failed; application continues with existing data")
    await cache.connect()
    task = asyncio.create_task(_expiry_loop())
    yield
    task.cancel()
    await cache.close()
    await engine.dispose()
    logger.info("shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API پلتفرم سفر سیر: جستجوی حمل‌ونقل و اقامتگاه، رزرو و پرداخت، "
        "مدیریت سفر، جاذبه‌ها، تجربه‌ها، نظرات، کیف پول، گیمیفیکیشن، دستیار هوشمند و پنل مدیریت."
    ),
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
    contact={"name": "Seir", "email": "api@seir.ir"},
    license_info={"name": "Proprietary"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
if "*" not in settings.allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
# The last added middleware runs first: reject oversized bodies, then rate limit.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(BodySizeLimitMiddleware)

install_error_handlers(app)


@app.middleware("http")
async def observability(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration = (time.perf_counter() - started) * 1000
        logger.exception(
            "request failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "duration_ms": round(duration, 2),
            },
        )
        raise
    duration = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = f"{duration:.1f}"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    if not request.url.path.startswith(("/docs", "/redoc", "/api/v1/openapi.json")):
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        )
    if not settings.debug:
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration, 2),
            },
        )
    return response


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["Health"], summary="اطلاعات سرویس")
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }


@app.get("/health", tags=["Health"], summary="سلامت سرویس")
async def health() -> dict:
    database = "ok"
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        database = "error"
    cache_status = "ok" if await cache.ping() else "degraded"
    healthy = database == "ok"
    return {
        "status": "ok" if healthy else "degraded",
        "database": database,
        "cache": cache_status,
        "version": settings.app_version,
    }


@app.get("/health/live", tags=["Health"], summary="Liveness probe")
async def liveness() -> dict:
    return {"status": "ok"}


@app.get("/health/ready", tags=["Health"], summary="Readiness probe")
async def readiness() -> ORJSONResponse:
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        return ORJSONResponse(status_code=503, content={"status": "not_ready"})
    return ORJSONResponse(content={"status": "ready"})
