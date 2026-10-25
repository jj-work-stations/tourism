from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.errors import AppError, ConflictError, UnauthorizedError
from app.core.security import (
    REFRESH_TOKEN,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import NotificationType, User, UserPreference, Wallet
from app.db.session import get_db
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    OTPRequest,
    OTPResponse,
    OTPVerifyRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserOut,
)
from app.schemas.common import Message
from app.services.notifications import notify
from app.services.otp import normalize_phone, request_otp, verify_otp

logger = logging.getLogger("seir.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(tokens=_tokens(user), user=UserOut.model_validate(user))


async def _create_user(
    db: AsyncSession,
    *,
    email: str | None = None,
    phone: str | None = None,
    password: str | None = None,
    full_name: str = "",
    city: str | None = None,
) -> User:
    user = User(
        email=email.lower() if email else None,
        phone=phone,
        hashed_password=hash_password(password) if password else None,
        full_name=full_name or "مسافر سیر",
        city=city,
        is_verified=True,
        last_login_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    db.add(UserPreference(user_id=user.id))
    db.add(Wallet(user_id=user.id))
    await notify(
        db,
        user.id,
        "به سیر خوش آمدید ✈️",
        "حساب شما آماده است. اولین سفر خود را جستجو کنید و پاسپورت سفرتان را بسازید.",
        notification_type=NotificationType.SYSTEM,
    )
    return user


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="ایجاد حساب کاربری",
)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    conditions = [User.email == payload.email.lower()]
    if payload.phone:
        conditions.append(User.phone == normalize_phone(payload.phone))
    existing = (await db.execute(select(User).where(or_(*conditions)))).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("کاربری با این ایمیل یا شماره موبایل قبلاً ثبت‌نام کرده است.")
    user = await _create_user(
        db,
        email=payload.email,
        phone=normalize_phone(payload.phone) if payload.phone else None,
        password=payload.password,
        full_name=payload.full_name,
        city=payload.city,
    )
    await db.commit()
    await db.refresh(user)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse, summary="ورود با ایمیل یا موبایل")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    identifier = payload.identifier.strip()
    result = await db.execute(
        select(User).where(
            or_(User.email == identifier.lower(), User.phone == normalize_phone(identifier))
        )
    )
    user = result.scalar_one_or_none()
    if user is None or not user.hashed_password:
        raise UnauthorizedError("ایمیل/موبایل یا رمز عبور اشتباه است.")
    if not verify_password(payload.password, user.hashed_password):
        raise UnauthorizedError("ایمیل/موبایل یا رمز عبور اشتباه است.")
    if not user.is_active:
        raise AppError("حساب کاربری غیرفعال شده است.", code="account_disabled", status_code=403)
    user.last_login_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(user)
    return _auth_response(user)


@router.post("/refresh", response_model=TokenPair, summary="تمدید توکن دسترسی")
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        data = decode_token(payload.refresh_token, expected_type=REFRESH_TOKEN)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("توکن تمدید معتبر نیست.") from exc
    try:
        user_id = UUID(str(data["sub"]))
    except (KeyError, ValueError) as exc:
        raise UnauthorizedError("توکن تمدید معتبر نیست.") from exc
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("کاربر معتبر نیست.")
    return _tokens(user)


@router.post("/otp/request", response_model=OTPResponse, summary="درخواست کد یک‌بارمصرف")
async def otp_request(payload: OTPRequest) -> OTPResponse:
    phone = normalize_phone(payload.phone)
    if len(phone) < 10:
        raise AppError("شماره موبایل معتبر نیست.", code="invalid_phone")
    code = await request_otp(phone)
    logger.info("OTP generated for %s (debug=%s)", phone, settings.otp_debug)
    return OTPResponse(
        message="کد تأیید ارسال شد.",
        expires_in=settings.otp_ttl_seconds,
        debug_code=code if settings.otp_debug else None,
    )


@router.post("/otp/verify", response_model=AuthResponse, summary="ورود/ثبت‌نام با کد یک‌بارمصرف")
async def otp_verify(payload: OTPVerifyRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    phone = normalize_phone(payload.phone)
    await verify_otp(phone, payload.code)
    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    if user is None:
        user = await _create_user(db, phone=phone, full_name=payload.full_name or "مسافر سیر")
    else:
        if not user.is_active:
            raise AppError("حساب کاربری غیرفعال شده است.", code="account_disabled", status_code=403)
        user.last_login_at = datetime.now(UTC)
        user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return _auth_response(user)


@router.post("/logout", response_model=Message, summary="خروج از حساب")
async def logout(user: User = Depends(get_current_user)) -> Message:
    # Tokens are short-lived and stateless; the client discards them. For
    # stronger revocation, rotate refresh tokens in Redis (see docs/architecture).
    return Message(message="از حساب خود خارج شدید.")


@router.post("/change-password", response_model=Message, summary="تغییر رمز عبور")
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    if user.hashed_password and not verify_password(payload.current_password, user.hashed_password):
        raise AppError("رمز عبور فعلی اشتباه است.", code="invalid_password")
    if payload.new_password.isdigit() or payload.new_password.isalpha():
        raise AppError("رمز عبور باید ترکیبی از حرف و رقم باشد.", code="weak_password")
    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return Message(message="رمز عبور با موفقیت تغییر کرد.")
