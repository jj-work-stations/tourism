from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.pagination import Page, PageParams
from app.db.models import User, Wallet, WalletTransaction, WalletTransactionType
from app.db.session import get_db
from app.schemas.engagement import (
    WalletOut,
    WalletTopUpRequest,
    WalletTransactionOut,
)
from app.services.loyalty import get_or_create_wallet, next_level

router = APIRouter(prefix="/wallet", tags=["Wallet"])


def _wallet_out(wallet: Wallet) -> WalletOut:
    next_name, remaining = next_level(wallet.xp)
    return WalletOut(
        id=wallet.id,
        balance=wallet.balance,
        currency=wallet.currency,
        points=wallet.points,
        xp=wallet.xp,
        level=wallet.level,
        next_level=next_name,
        xp_to_next_level=remaining,
        transactions=[WalletTransactionOut.model_validate(t) for t in wallet.transactions[-10:]],
    )


@router.get("", response_model=WalletOut, summary="کیف پول من")
async def get_wallet(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> WalletOut:
    wallet = (
        await db.execute(
            select(Wallet)
            .options(selectinload(Wallet.transactions))
            .where(Wallet.user_id == user.id)
        )
    ).scalar_one_or_none()
    if wallet is None:
        wallet = await get_or_create_wallet(db, user.id)
        await db.commit()
    return _wallet_out(wallet)


@router.get("/transactions", response_model=Page[WalletTransactionOut], summary="تراکنش‌های کیف پول")
async def transactions(
    params: PageParams = Depends(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[WalletTransactionOut]:
    wallet = await get_or_create_wallet(db, user.id)
    total = len(wallet.transactions)
    rows = sorted(wallet.transactions, key=lambda t: t.created_at, reverse=True)
    paged = rows[params.offset : params.offset + params.limit]
    return Page.create([WalletTransactionOut.model_validate(t) for t in paged], total, params)


@router.post("/top-up", response_model=WalletOut, summary="شارژ کیف پول (سندباکس)")
async def top_up(
    payload: WalletTopUpRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WalletOut:
    wallet = await get_or_create_wallet(db, user.id)
    reference = f"TOPUP-{payload.idempotency_key}" if payload.idempotency_key else None
    if reference:
        existing = (
            await db.execute(
                select(WalletTransaction).where(
                    WalletTransaction.wallet_id == wallet.id,
                    WalletTransaction.reference == reference,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            return _wallet_out(wallet)
    wallet.balance += payload.amount
    db.add(
        WalletTransaction(
            wallet_id=wallet.id,
            transaction_type=WalletTransactionType.TOP_UP,
            amount=payload.amount,
            balance_after=wallet.balance,
            description="شارژ کیف پول",
            reference=reference,
        )
    )
    await db.commit()
    await db.refresh(wallet)
    return _wallet_out(wallet)
