from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.db.models import (
    Booking,
    BookingStatus,
    Coupon,
    Payment,
    PaymentStatus,
    Role,
    User,
)
from app.db.session import get_db
from app.schemas.booking import (
    CouponOut,
    CouponValidateRequest,
    PaymentCreate,
    PaymentOut,
    PaymentResult,
)
from app.services.bookings import pay_booking, validate_coupon
from app.services.serializers import booking_out, payment_out

router = APIRouter(prefix="/payments", tags=["Payments"])
coupons_router = APIRouter(prefix="/coupons", tags=["Coupons"])


@router.post("", response_model=PaymentResult, summary="پرداخت رزرو")
async def pay(
    payload: PaymentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentResult:
    payment, booking = await pay_booking(
        db,
        user,
        payload.booking_id,
        payload.method,
        simulate_failure=payload.simulate_failure,
    )
    await db.commit()
    from app.api.v1.bookings import load_booking

    booking = await load_booking(db, booking.id)
    return PaymentResult(
        payment=payment_out(payment),
        booking=booking_out(booking),
        message="پرداخت با موفقیت انجام شد و رزرو تأیید شد.",
    )


@router.get("/{payment_id}", response_model=PaymentOut, summary="جزئیات پرداخت")
async def get_payment(
    payment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentOut:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("پرداخت یافت نشد.")
    if payment.user_id != user.id and user.role not in {Role.ADMIN, Role.SUPPORT_AGENT}:
        raise ForbiddenError()
    return payment_out(payment)


@router.post(
    "/{payment_id}/refund",
    response_model=PaymentOut,
    summary="بازگشت وجه (پشتیبانی)",
)
async def refund(
    payment_id: UUID,
    _: User = Depends(require_roles(Role.ADMIN, Role.SUPPORT_AGENT)),
    db: AsyncSession = Depends(get_db),
) -> PaymentOut:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("پرداخت یافت نشد.")
    if payment.status != PaymentStatus.PAID:
        raise AppError("تنها پرداخت‌های موفق قابل بازگشت هستند.", code="invalid_payment_state")
    from app.services.bookings import _credit_refund

    await _credit_refund(db, payment.user_id, payment.amount, payment.reference)
    payment.status = PaymentStatus.REFUNDED
    payment.refunded_amount = payment.amount
    payment.refunded_at = datetime.now(UTC)
    booking = await db.get(Booking, payment.booking_id)
    if booking:
        booking.status = BookingStatus.REFUNDED
    await db.commit()
    await db.refresh(payment)
    return payment_out(payment)


@coupons_router.post("/validate", response_model=CouponOut, summary="بررسی کد تخفیف")
async def validate(
    payload: CouponValidateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CouponOut:
    coupon, discount = await validate_coupon(db, payload.code, payload.amount, user.id)
    return CouponOut(
        code=coupon.code,
        title=coupon.title,
        description=coupon.description,
        coupon_type=coupon.coupon_type.value,
        value=coupon.value,
        discount=discount,
        final_amount=max(0, payload.amount - discount),
        min_amount=coupon.min_amount,
        valid_to=coupon.valid_to,
    )


@coupons_router.get("/active", response_model=list[CouponOut], summary="کدهای تخفیف فعال")
async def active_coupons(db: AsyncSession = Depends(get_db)) -> list[CouponOut]:
    now = datetime.now(UTC)
    coupons = (
        await db.execute(
            select(Coupon).where(
                Coupon.is_active.is_(True),
                (Coupon.valid_to.is_(None) | (Coupon.valid_to >= now)),
            ).order_by(Coupon.created_at.desc()).limit(10)
        )
    ).scalars().all()
    return [
        CouponOut(
            code=c.code,
            title=c.title,
            description=c.description,
            coupon_type=c.coupon_type.value,
            value=c.value,
            min_amount=c.min_amount,
            valid_to=c.valid_to,
        )
        for c in coupons
    ]
