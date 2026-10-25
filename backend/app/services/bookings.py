from __future__ import annotations

import secrets
import string
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.db.models import (
    Accommodation,
    AnalyticsEvent,
    Booking,
    BookingStatus,
    BookingType,
    Coupon,
    Destination,
    Experience,
    NotificationType,
    Passenger,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Room,
    TransportOffer,
    Trip,
    TripStatus,
    User,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
)
from app.services.loyalty import add_xp, progress_challenges, stamp_passport
from app.services.notifications import notify

BOOKING_ALPHABET = string.ascii_uppercase + string.digits
BOOKABLE = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED]


def generate_code(prefix: str = "SR") -> str:
    return f"{prefix}-{''.join(secrets.choice(BOOKING_ALPHABET) for _ in range(7))}"


def booking_tracking_code() -> str:
    return "".join(secrets.choice(BOOKING_ALPHABET) for _ in range(8))


async def track_event(
    db: AsyncSession,
    user_id: UUID | None,
    name: str,
    properties: dict[str, Any] | None = None,
    path: str | None = None,
) -> None:
    db.add(
        AnalyticsEvent(
            user_id=user_id,
            name=name,
            properties=properties or {},
            path=path,
        )
    )


async def validate_coupon(
    db: AsyncSession, code: str, amount: int, user_id: UUID
) -> tuple[Coupon, int]:
    normalized = code.strip().upper()
    coupon = (
        await db.execute(select(Coupon).where(Coupon.code == normalized))
    ).scalar_one_or_none()
    if coupon is None or not coupon.is_active:
        raise AppError("کد تخفیف معتبر نیست.", code="invalid_coupon")
    now = datetime.now(UTC)
    valid_from = coupon.valid_from
    valid_to = coupon.valid_to
    if valid_from and valid_from.tzinfo is None:
        valid_from = valid_from.replace(tzinfo=UTC)
    if valid_to and valid_to.tzinfo is None:
        valid_to = valid_to.replace(tzinfo=UTC)
    if (valid_from and valid_from > now) or (valid_to and valid_to < now):
        raise AppError("مهلت استفاده از کد تخفیف به پایان رسیده است.", code="coupon_expired")
    if coupon.used_count >= coupon.usage_limit:
        raise AppError("ظرفیت استفاده از این کد تخفیف تکمیل شده است.", code="coupon_exhausted")
    if amount < coupon.min_amount:
        raise AppError(
            f"حداقل مبلغ برای این کد {coupon.min_amount:,} تومان است.", code="coupon_min_amount"
        )
    user_usage = (
        await db.execute(
            select(func.count(Booking.id)).where(
                Booking.user_id == user_id,
                Booking.coupon_code == normalized,
                Booking.status.in_(BOOKABLE),
            )
        )
    ).scalar_one()
    if user_usage >= coupon.per_user_limit:
        raise AppError("شما قبلاً از این کد تخفیف استفاده کرده‌اید.", code="coupon_used")
    if coupon.coupon_type.value == "percent":
        discount = amount * coupon.value // 100
    else:
        discount = coupon.value
    if coupon.max_discount:
        discount = min(discount, coupon.max_discount)
    return coupon, min(discount, amount)


def _aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


async def create_booking(db: AsyncSession, user: User, payload: Any) -> Booking:
    if payload.booking_type == BookingType.TRANSPORT:
        booking = await _build_transport(db, user, payload)
    elif payload.booking_type == BookingType.ACCOMMODATION:
        booking = await _build_accommodation(db, user, payload)
    else:
        booking = await _build_experience(db, user, payload)

    subtotal = booking.subtotal
    discount = 0
    if payload.coupon_code:
        coupon, discount = await validate_coupon(
            db, payload.coupon_code, subtotal, user.id
        )
        booking.coupon_code = coupon.code
    booking.discount = discount
    booking.total = max(0, subtotal - discount)
    booking.code = generate_code()
    booking.expires_at = datetime.now(UTC) + timedelta(minutes=30)
    booking.status = BookingStatus.PENDING
    db.add(booking)
    await db.flush()

    for passenger in payload.passengers:
        db.add(Passenger(booking_id=booking.id, **passenger.model_dump()))
    payment = Payment(
        booking_id=booking.id,
        user_id=user.id,
        amount=booking.total,
        currency=booking.currency,
        method=PaymentMethod.CARD,
        status=PaymentStatus.PENDING,
        reference=f"PAY-{secrets.token_hex(8).upper()}",
        gateway="sandbox",
        gateway_payload={"sandbox": True, "currency": booking.currency},
    )
    db.add(payment)
    await track_event(
        db,
        user.id,
        "booking_started",
        {"booking_id": str(booking.id), "type": booking.booking_type.value, "total": booking.total},
    )
    await notify(
        db,
        user.id,
        "رزرو در انتظار پرداخت",
        f"رزرو «{booking.title}» به مبلغ {booking.total:,} تومان ایجاد شد. تا ۳۰ دقیقه تکمیل کنید.",
        notification_type=NotificationType.BOOKING,
        data={"booking_id": str(booking.id), "code": booking.code},
    )
    await db.flush()
    return booking


async def _build_transport(db: AsyncSession, user: User, payload: Any) -> Booking:
    offer = (
        await db.execute(
            select(TransportOffer)
            .options(
                selectinload(TransportOffer.provider),
                selectinload(TransportOffer.origin),
                selectinload(TransportOffer.destination),
            )
            .where(TransportOffer.id == payload.transport_offer_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if offer is None or not offer.is_active:
        raise NotFoundError("بلیت موردنظر یافت نشد.")
    if offer.seats_available < payload.guests:
        raise ConflictError("ظرفیت این سفر تکمیل شده است. گزینه دیگری انتخاب کنید.", code="sold_out")
    if payload.travel_date != offer.departure_at.date():
        # Compare in destination timezone as offers are stored in UTC.
        from zoneinfo import ZoneInfo

        local_date = offer.departure_at.astimezone(
            ZoneInfo(offer.destination.timezone or "Asia/Tehran")
        ).date()
        if payload.travel_date != local_date:
            raise AppError("تاریخ انتخاب‌شده با تاریخ حرکت هم‌خوانی ندارد.", code="date_mismatch")
    offer.seats_available -= payload.guests
    duration = offer.duration_minutes
    departure = _aware(offer.departure_at)
    return Booking(
        user_id=user.id,
        booking_type=BookingType.TRANSPORT,
        destination_id=offer.destination_id,
        transport_offer_id=offer.id,
        travel_date=payload.travel_date,
        guests=payload.guests,
        unit_price=offer.price,
        subtotal=offer.price * payload.guests,
        currency=offer.currency,
        title=f"{offer.type.value} {(offer.origin.name_local or offer.origin.name)} به {(offer.destination.name_local or offer.destination.name)}",
        cancellation_deadline=departure - timedelta(hours=24) if departure else None,
        details={
            "provider": offer.provider.name,
            "transport_type": offer.type.value,
            "origin": offer.origin.name_local or offer.origin.name,
            "destination": offer.destination.name_local or offer.destination.name,
            "departure_at": offer.departure_at.isoformat(),
            "arrival_at": offer.arrival_at.isoformat(),
            "duration_minutes": duration,
            "stops": offer.stops,
            "baggage": offer.baggage_allowance,
            "amenities": offer.amenities,
            "cancellation_policy": offer.cancellation_policy,
            "notes": payload.notes,
        },
    )


async def _build_accommodation(db: AsyncSession, user: User, payload: Any) -> Booking:
    room = (
        await db.execute(
            select(Room)
            .options(
                selectinload(Room.accommodation).selectinload(Accommodation.destination)
            )
            .where(Room.id == payload.room_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if room is None or not room.is_active:
        raise NotFoundError("اتاق موردنظر یافت نشد.")
    if room.capacity < (payload.guests + payload.rooms_count - 1) // payload.rooms_count:
        raise AppError("ظرفیت اتاق برای تعداد مسافران کافی نیست.", code="capacity_exceeded")
    nights = (payload.check_out - payload.check_in).days
    if nights < 1:
        raise AppError("مدت اقامت باید حداقل یک شب باشد.", code="invalid_dates")
    if payload.check_in < date.today():
        raise AppError("تاریخ ورود نمی‌تواند در گذشته باشد.", code="invalid_dates")
    booked = (
        await db.execute(
            select(func.coalesce(func.sum(Booking.rooms_count), 0)).where(
                Booking.room_id == room.id,
                Booking.booking_type == BookingType.ACCOMMODATION,
                Booking.status.in_(BOOKABLE),
                Booking.check_in < payload.check_out,
                Booking.check_out > payload.check_in,
            )
        )
    ).scalar_one()
    if int(booked) + payload.rooms_count > room.total_rooms:
        raise ConflictError("برای این بازه اتاق خالی وجود ندارد.", code="sold_out")
    hotel = room.accommodation
    return Booking(
        user_id=user.id,
        booking_type=BookingType.ACCOMMODATION,
        destination_id=hotel.destination_id,
        accommodation_id=hotel.id,
        room_id=room.id,
        check_in=payload.check_in,
        check_out=payload.check_out,
        nights=nights,
        guests=payload.guests,
        rooms_count=payload.rooms_count,
        unit_price=room.price_per_night,
        subtotal=room.price_per_night * nights * payload.rooms_count,
        currency="IRT",
        title=hotel.name,
        cancellation_deadline=datetime.combine(payload.check_in, datetime.min.time(), tzinfo=UTC)
        - timedelta(days=2),
        details={
            "accommodation": hotel.name,
            "room": room.name,
            "address": hotel.address,
            "check_in": payload.check_in.isoformat(),
            "check_out": payload.check_out.isoformat(),
            "nights": nights,
            "rooms": payload.rooms_count,
            "guests": payload.guests,
            "breakfast": room.breakfast_included,
            "cancellation_policy": hotel.cancellation_policy,
            "notes": payload.notes,
        },
    )


async def _build_experience(db: AsyncSession, user: User, payload: Any) -> Booking:
    experience = (
        await db.execute(
            select(Experience)
            .options(selectinload(Experience.destination))
            .where(Experience.id == payload.experience_id)
        )
    ).scalar_one_or_none()
    if experience is None or not experience.is_active:
        raise NotFoundError("تجربه موردنظر یافت نشد.")
    if payload.travel_date < date.today():
        raise AppError("تاریخ تجربه نمی‌تواند در گذشته باشد.", code="invalid_dates")
    if payload.guests > experience.max_participants:
        raise AppError("تعداد نفرات بیش از ظرفیت این تجربه است.", code="capacity_exceeded")
    return Booking(
        user_id=user.id,
        booking_type=BookingType.EXPERIENCE,
        destination_id=experience.destination_id,
        experience_id=experience.id,
        travel_date=payload.travel_date,
        guests=payload.guests,
        unit_price=experience.price,
        subtotal=experience.price * payload.guests,
        currency=experience.currency,
        title=experience.name,
        cancellation_deadline=datetime.combine(payload.travel_date, datetime.min.time(), tzinfo=UTC)
        - timedelta(days=1),
        details={
            "experience": experience.name,
            "meeting_point": experience.meeting_point,
            "duration_minutes": experience.duration_minutes,
            "languages": experience.languages,
            "includes": experience.includes,
            "date": payload.travel_date.isoformat(),
            "guests": payload.guests,
            "notes": payload.notes,
        },
    )


async def _find_or_create_trip(
    db: AsyncSession, user: User, booking: Booking
) -> Trip:
    start = booking.check_in or booking.travel_date or date.today()
    end = booking.check_out or start
    trip = (
        await db.execute(
            select(Trip)
            .where(
                Trip.user_id == user.id,
                Trip.destination_id == booking.destination_id,
                Trip.start_date <= end + timedelta(days=3),
                Trip.end_date >= start - timedelta(days=3),
            )
            .order_by(Trip.start_date.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if trip is None and booking.trip_id:
        trip = await db.get(Trip, booking.trip_id)
    destination = await db.get(Destination, booking.destination_id)
    if trip is None:
        trip = Trip(
            user_id=user.id,
            destination_id=booking.destination_id,
            title=f"سفر به {destination.name_local or destination.name}" if destination else "سفر من",
            start_date=start,
            end_date=end,
            status=TripStatus.UPCOMING,
            cover_image=destination.image_url if destination else None,
        )
        db.add(trip)
        await db.flush()
    else:
        trip.start_date = min(trip.start_date, start)
        trip.end_date = max(trip.end_date, end)
    return trip


async def pay_booking(
    db: AsyncSession,
    user: User,
    booking_id: UUID,
    method: PaymentMethod,
    *,
    simulate_failure: bool = False,
) -> tuple[Payment, Booking]:
    booking = (
        await db.execute(
            select(Booking)
            .options(
                selectinload(Booking.passengers),
                selectinload(Booking.payments),
                selectinload(Booking.trip),
                selectinload(Booking.accommodation),
                selectinload(Booking.experience),
                selectinload(Booking.destination),
            )
            .where(Booking.id == booking_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("رزرو یافت نشد.")
    if booking.user_id != user.id and user.role.value not in {"admin", "support_agent"}:
        raise ForbiddenError()
    if booking.status != BookingStatus.PENDING:
        raise ConflictError("این رزرو در وضعیت قابل پرداخت نیست.", code="invalid_booking_state")
    if booking.expires_at and _aware(booking.expires_at) < datetime.now(UTC):
        raise ConflictError("مهلت پرداخت این رزرو به پایان رسیده است.", code="booking_expired")
    payment = next(
        (p for p in sorted(booking.payments, key=lambda p: p.created_at) if p.status == PaymentStatus.PENDING),
        None,
    )
    if payment is None:
        payment = Payment(
            booking_id=booking.id,
            user_id=user.id,
            amount=booking.total,
            currency=booking.currency,
            method=method,
            status=PaymentStatus.PENDING,
            reference=f"PAY-{secrets.token_hex(8).upper()}",
            gateway="sandbox",
        )
        db.add(payment)

    payment.method = method
    if simulate_failure:
        payment.status = PaymentStatus.FAILED
        payment.gateway_payload = {"sandbox": True, "result": "failed", "reason": "simulated"}
        await db.flush()
        raise AppError(
            "پرداخت ناموفق بود. مبلغی از حساب شما کسر نشد.", code="payment_failed", status_code=402
        )

    if method == PaymentMethod.WALLET:
        wallet = (
            await db.execute(
                select(Wallet).where(Wallet.user_id == user.id).with_for_update()
            )
        ).scalar_one_or_none()
        if wallet is None or wallet.balance < booking.total:
            raise AppError("موجودی کیف پول کافی نیست.", code="insufficient_balance")
        wallet.balance -= booking.total
        db.add(
            WalletTransaction(
                wallet_id=wallet.id,
                transaction_type=WalletTransactionType.PAYMENT,
                amount=-booking.total,
                balance_after=wallet.balance,
                description=f"پرداخت رزرو {booking.code}",
                reference=booking.code,
            )
        )

    now = datetime.now(UTC)
    payment.status = PaymentStatus.PAID
    payment.paid_at = now
    payment.gateway_payload = {
        "sandbox": True,
        "result": "success",
        "method": method.value,
        "authorized_at": now.isoformat(),
    }
    booking.status = BookingStatus.CONFIRMED
    booking.confirmed_at = now
    booking.expires_at = None

    if booking.coupon_code:
        coupon = (
            await db.execute(select(Coupon).where(Coupon.code == booking.coupon_code))
        ).scalar_one_or_none()
        if coupon:
            coupon.used_count += 1

    xp = 20 + min(80, booking.total // 100_000)
    await add_xp(db, user.id, xp, f"پرداخت موفق رزرو {booking.code}", booking.code)
    await progress_challenges(db, user.id, "bookings")
    if booking.destination_id:
        await stamp_passport(db, user.id, booking.destination_id)
    await progress_challenges(db, user.id, "visits")

    trip = await _find_or_create_trip(db, user, booking)
    booking.trip_id = trip.id
    await notify(
        db,
        user.id,
        "رزرو شما تأیید شد ✅",
        f"کد رزرو {booking.code} صادر شد. جزئیات سفر در بخش سفرهای من در دسترس است.",
        notification_type=NotificationType.BOOKING,
        data={"booking_id": str(booking.id), "code": booking.code, "trip_id": str(trip.id)},
    )
    await track_event(
        db,
        user.id,
        "booking_completed",
        {"booking_id": str(booking.id), "type": booking.booking_type.value, "total": booking.total},
    )
    await db.flush()
    return payment, booking


async def cancel_booking(
    db: AsyncSession, user: User, booking_id: UUID, reason: str | None = None
) -> Booking:
    booking = (
        await db.execute(
            select(Booking)
            .options(
                selectinload(Booking.payments),
                selectinload(Booking.passengers),
                selectinload(Booking.accommodation),
                selectinload(Booking.experience),
                selectinload(Booking.destination),
            )
            .where(Booking.id == booking_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("رزرو یافت نشد.")
    if booking.user_id != user.id and user.role.value not in {"admin", "support_agent"}:
        raise ForbiddenError()
    if booking.status not in {BookingStatus.PENDING, BookingStatus.CONFIRMED}:
        raise ConflictError("این رزرو قابل لغو نیست.", code="invalid_booking_state")
    deadline = _aware(booking.cancellation_deadline)
    if deadline and deadline < datetime.now(UTC):
        raise AppError("مهلت لغو این رزرو به پایان رسیده است.", code="cancellation_expired")
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = datetime.now(UTC)
    if booking.transport_offer_id:
        offer = await db.get(TransportOffer, booking.transport_offer_id)
        if offer:
            offer.seats_available = min(offer.capacity, offer.seats_available + booking.guests)
    for payment in booking.payments:
        if payment.status == PaymentStatus.PAID:
            payment.status = PaymentStatus.REFUNDED
            payment.refunded_amount = payment.amount
            payment.refunded_at = datetime.now(UTC)
            wallet = await _credit_refund(db, user.id, payment.amount, booking.code)
            if wallet:
                pass
    await notify(
        db,
        user.id,
        "رزرو لغو شد",
        f"رزرو {booking.code} لغو و مبلغ آن به کیف پول شما بازگشت.",
        notification_type=NotificationType.BOOKING,
        data={"booking_id": str(booking.id), "reason": reason},
    )
    await track_event(
        db,
        user.id,
        "booking_cancelled",
        {"booking_id": str(booking.id), "reason": reason},
    )
    await db.flush()
    return booking


async def _credit_refund(db: AsyncSession, user_id: UUID, amount: int, code: str) -> Wallet:
    wallet = (
        await db.execute(select(Wallet).where(Wallet.user_id == user_id).with_for_update())
    ).scalar_one_or_none()
    if wallet is None:
        wallet = Wallet(user_id=user_id)
        db.add(wallet)
        await db.flush()
    wallet.balance += amount
    db.add(
        WalletTransaction(
            wallet_id=wallet.id,
            transaction_type=WalletTransactionType.REFUND,
            amount=amount,
            balance_after=wallet.balance,
            description=f"بازگشت وجه رزرو {code}",
            reference=code,
        )
    )
    return wallet


async def expire_pending_bookings(db: AsyncSession) -> int:
    now = datetime.now(UTC)
    expired = (
        await db.execute(
            select(Booking)
            .options(selectinload(Booking.payments))
            .where(
                Booking.status == BookingStatus.PENDING,
                Booking.expires_at.is_not(None),
                Booking.expires_at < now,
            )
            .limit(100)
        )
    ).scalars().all()
    if not expired:
        return 0
    for booking in expired:
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = now
        if booking.transport_offer_id:
            offer = await db.get(TransportOffer, booking.transport_offer_id)
            if offer:
                offer.seats_available = min(
                    offer.capacity, offer.seats_available + booking.guests
                )
        for payment in booking.payments:
            if payment.status == PaymentStatus.PENDING:
                payment.status = PaymentStatus.FAILED
                payment.gateway_payload = {"sandbox": True, "result": "expired"}
    await db.commit()
    return len(expired)
