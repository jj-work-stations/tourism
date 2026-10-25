from __future__ import annotations

import secrets

from app.core.cache import cache
from app.core.config import settings
from app.core.errors import AppError


def _key(phone: str) -> str:
    return f"otp:{phone}"


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit() or c == "+")
    return digits


async def request_otp(phone: str) -> str:
    code = f"{secrets.randbelow(900000) + 100000}"
    await cache.set_raw(_key(phone), code, settings.otp_ttl_seconds)
    return code


async def verify_otp(phone: str, code: str) -> None:
    expected = await cache.get_raw(_key(phone))
    if expected is None:
        raise AppError("کد تأیید منقضی شده است. لطفاً دوباره درخواست کنید.", code="otp_expired")
    attempts_key = f"otp_attempts:{phone}"
    attempts = await cache.incr(attempts_key, settings.otp_ttl_seconds)
    if attempts > settings.otp_max_attempts:
        await cache.delete(_key(phone), attempts_key)
        raise AppError("تعداد تلاش‌ها بیش از حد مجاز است.", code="otp_locked")
    if not secrets.compare_digest(str(expected), str(code).strip()):
        raise AppError("کد تأیید نامعتبر است.", code="otp_invalid")
    await cache.delete(_key(phone), attempts_key)
