from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.errors import ForbiddenError, NotFoundError
from app.core.pagination import Page, PageParams
from app.db.models import Role, SupportTicket, User
from app.db.session import get_db
from app.schemas.common import Message
from app.schemas.engagement import SupportTicketCreate, SupportTicketOut

router = APIRouter(prefix="/support", tags=["Support"])

FAQ = [
    {"question": "چگونه می‌توانم بلیت خود را لغو کنم؟", "answer": "از بخش سفرهای من، رزرو را باز کنید و در صورت مجاز بودن، دکمه لغو را بزنید. مبلغ طبق قوانین به کیف پول بازمی‌گردد."},
    {"question": "کد تخفیف را کجا وارد کنم؟", "answer": "در مرحله پرداخت، بخش کد تخفیف را باز کنید و کد را وارد کنید."},
    {"question": "آیا رزرو بدون پرداخت نگه داشته می‌شود؟", "answer": "بله، رزروها ۳۰ دقیقه در وضعیت در انتظار پرداخت باقی می‌مانند."},
    {"question": "چطور پاسپورت سفر بسازم؟", "answer": "با اولین رزرو تأییدشده، مقصد در پاسپورت دیجیتال شما ثبت می‌شود و امتیاز می‌گیرید."},
    {"question": "پشتیبانی در سفر چگونه است؟", "answer": "از بخش پشتیبانی تیکت ثبت کنید؛ تیم پشتیبانی در تمام روزهای سفر همراه شماست."},
]


@router.get("/faq", summary="سوالات متداول")
async def faq() -> list[dict]:
    return FAQ


@router.post("/tickets", response_model=SupportTicketOut, status_code=201, summary="ثبت تیکت")
async def create_ticket(
    payload: SupportTicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketOut:
    ticket = SupportTicket(
        user_id=user.id,
        booking_id=payload.booking_id,
        subject=payload.subject,
        category=payload.category,
        message=payload.message,
        priority=payload.priority,
        status="open",
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return SupportTicketOut.model_validate(ticket)


@router.get("/tickets", response_model=Page[SupportTicketOut], summary="تیکت‌های من")
async def my_tickets(
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[SupportTicketOut]:
    from sqlalchemy import func

    total = (
        await db.execute(
            select(func.count(SupportTicket.id)).where(SupportTicket.user_id == user.id)
        )
    ).scalar_one()
    rows = (
        await db.execute(
            select(SupportTicket)
            .where(SupportTicket.user_id == user.id)
            .order_by(SupportTicket.created_at.desc())
            .offset(params.offset)
            .limit(params.limit)
        )
    ).scalars().all()
    return Page.create([SupportTicketOut.model_validate(t) for t in rows], total, params)


@router.get("/tickets/{ticket_id}", response_model=SupportTicketOut, summary="جزئیات تیکت")
async def get_ticket(
    ticket_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketOut:
    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFoundError("تیکت یافت نشد.")
    if ticket.user_id != user.id and user.role not in {
        Role.SUPPORT_AGENT,
        Role.ADMIN,
    }:
        raise ForbiddenError()
    return SupportTicketOut.model_validate(ticket)


@router.post(
    "/tickets/{ticket_id}/reply",
    response_model=SupportTicketOut,
    summary="پاسخ پشتیبانی",
)
async def reply_ticket(
    ticket_id: UUID,
    message: str,
    _: User = Depends(require_roles(Role.SUPPORT_AGENT, Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketOut:
    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFoundError("تیکت یافت نشد.")
    ticket.response = message
    ticket.status = "resolved"
    await db.commit()
    await db.refresh(ticket)
    return SupportTicketOut.model_validate(ticket)


@router.post("/tickets/{ticket_id}/close", response_model=Message, summary="بستن تیکت")
async def close_ticket(
    ticket_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Message:
    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFoundError("تیکت یافت نشد.")
    if ticket.user_id != user.id and user.role not in {Role.SUPPORT_AGENT, Role.ADMIN}:
        raise ForbiddenError()
    ticket.status = "closed"
    await db.commit()
    return Message(message="تیکت بسته شد.")
