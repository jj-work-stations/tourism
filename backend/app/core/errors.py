from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger("seir.errors")


class AppError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "app_error",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: object | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str = "موردی یافت نشد.", code: str = "not_found") -> None:
        super().__init__(message, code=code, status_code=status.HTTP_404_NOT_FOUND)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "لطفاً وارد حساب خود شوید.") -> None:
        super().__init__(message, code="unauthorized", status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(AppError):
    def __init__(self, message: str = "دسترسی به این بخش مجاز نیست.") -> None:
        super().__init__(message, code="forbidden", status_code=status.HTTP_403_FORBIDDEN)


class ConflictError(AppError):
    def __init__(self, message: str, code: str = "conflict") -> None:
        super().__init__(message, code=code, status_code=status.HTTP_409_CONFLICT)


def _error_payload(request: Request, code: str, message: str, details: object = None) -> dict:
    payload: dict = {
        "detail": message,
        "code": code,
        "request_id": getattr(request.state, "request_id", None),
    }
    if details is not None:
        payload["errors"] = details
    return payload


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> ORJSONResponse:
        return ORJSONResponse(
            status_code=exc.status_code,
            content=_error_payload(request, exc.code, exc.message, exc.details),
            headers={"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        request: Request, exc: RequestValidationError
    ) -> ORJSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in error["loc"][1:]),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return ORJSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_payload(
                request, "validation_error", "اطلاعات ارسال‌شده معتبر نیست.", errors
            ),
        )

    @app.exception_handler(IntegrityError)
    async def integrity_handler(request: Request, exc: IntegrityError) -> ORJSONResponse:
        logger.warning("integrity error: %s", exc.orig)
        return ORJSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_error_payload(
                request, "conflict", "این اطلاعات قبلاً ثبت شده یا با داده‌های دیگر تناقض دارد."
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> ORJSONResponse:
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return ORJSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload(
                request, "internal_error", "خطای غیرمنتظره‌ای رخ داد. لطفاً بعداً تلاش کنید."
            ),
        )
