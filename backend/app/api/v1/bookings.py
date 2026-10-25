from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.errors import ForbiddenError, NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import Booking, BookingStatus, Role, User
from app.db.session import get_db
from app.schemas.booking import BookingCreate, BookingOut, RefundRequest
from app.schemas.common import Message
from app.services.bookings import cancel_booking, create_booking
from app.services.serializers import booking_out

router = APIRouter(prefix="/bookings", tags=["Bookings"])

BOOKING_LOADS = (
    selectinload(Booking.passengers),
    selectinload(Booking.payments),
    selectinload(Booking.destination),
    selectinload(Booking.accommodation),
    selectinload(Booking.experience),
    selectinload(Booking.transport_offer),
)


async def load_booking(db: AsyncSession, booking_id: UUID) -> Booking:
    booking = (
        await db.execute(
            select(Booking).options(*BOOKING_LOADS).where(Booking.id == booking_id)
        )
    ).scalar_one_or_none()
    if booking is None:
        raise NotFoundError("رزرو یافت نشد.")
    return booking


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED, summary="ایجاد رزرو")
async def create(
    payload: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingOut:
    booking = await create_booking(db, user, payload)
    await db.commit()
    booking = await load_booking(db, booking.id)
    return booking_out(booking)


@router.get("", response_model=Page[BookingOut], summary="رزروهای من")
async def my_bookings(
    booking_type: str | None = Query(default=None),
    booking_status: str | None = Query(default=None, alias="status"),
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[BookingOut]:
    filters = [Booking.user_id == user.id]
    if booking_type:
        filters.append(Booking.booking_type == booking_type)
    if booking_status:
        filters.append(Booking.status == booking_status)
    total = (await db.execute(select(func.count(Booking.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Booking)
            .options(*BOOKING_LOADS)
            .where(*filters)
            .order_by(Booking.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([booking_out(b) for b in rows], total, params)


@router.get("/{booking_id}", response_model=BookingOut, summary="جزئیات رزرو")
async def get_booking(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingOut:
    booking = await load_booking(db, booking_id)
    if booking.user_id != user.id and user.role not in {
        Role.ADMIN,
        Role.SUPPORT_AGENT,
    }:
        raise ForbiddenError()
    return booking_out(booking)


@router.post("/{booking_id}/cancel", response_model=BookingOut, summary="لغو رزرو")
async def cancel(
    booking_id: UUID,
    payload: RefundRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingOut:
    booking = await cancel_booking(db, user, booking_id, payload.reason if payload else None)
    await db.commit()
    booking = await load_booking(db, booking.id)
    return booking_out(booking)


@router.get("/{booking_id}/ticket", summary="بلیت و QR")
async def ticket(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    booking = await load_booking(db, booking_id)
    if booking.user_id != user.id and user.role not in {Role.ADMIN, Role.SUPPORT_AGENT}:
        raise ForbiddenError()
    if booking.status not in {BookingStatus.CONFIRMED, BookingStatus.COMPLETED}:
        raise ForbiddenError("بلیت فقط برای رزروهای تأییدشده صادر می‌شود.")
    return {
        "booking_id": booking.id,
        "code": booking.code,
        "qr_data": f"SEIR|{booking.code}|{booking.id}|{booking.total}",
        "title": booking.title,
        "status": booking.status,
        "total": booking.total,
        "currency": booking.currency,
        "travel_date": booking.travel_date,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "passengers": [
            {"name": f"{p.first_name} {p.last_name}", "seat": p.seat_number}
            for p in booking.passengers
        ],
        "details": booking.details,
    }


@router.post("/{booking_id}/complete", response_model=Message, summary="ثبت پایان سفر")
async def complete(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    booking = await load_booking(db, booking_id)
    if booking.user_id != user.id:
        raise ForbiddenError()
    if booking.status != BookingStatus.CONFIRMED:
        raise ForbiddenError("تنها رزرو تأییدشده قابل تکمیل است.")
    booking.status = BookingStatus.COMPLETED
    await db.commit()
    return Message(message="سفر با موفقیت تکمیل شد. امیدواریم لذت برده باشید!")
