from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Achievement,
    Challenge,
    PassportStamp,
    UserAchievement,
    UserChallenge,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
)

LEVELS = [
    ("bronze", 0),
    ("silver", 500),
    ("gold", 1500),
    ("platinum", 4000),
]
POINTS_PER_XP = 10


def level_for_xp(xp: int) -> str:
    result = "bronze"
    for name, threshold in LEVELS:
        if xp >= threshold:
            result = name
    return result


def next_level(xp: int) -> tuple[str | None, int]:
    for name, threshold in LEVELS:
        if xp < threshold:
            return name, threshold - xp
    return None, 0


async def get_or_create_wallet(db: AsyncSession, user_id: UUID) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = Wallet(user_id=user_id, balance=0, points=0, xp=0, level="bronze")
        db.add(wallet)
        await db.flush()
    return wallet


async def add_xp(
    db: AsyncSession, user_id: UUID, xp: int, reason: str, reference: str | None = None
) -> Wallet:
    wallet = await get_or_create_wallet(db, user_id)
    wallet.xp += max(0, xp)
    wallet.points += max(0, xp) * POINTS_PER_XP
    wallet.level = level_for_xp(wallet.xp)
    db.add(
        WalletTransaction(
            wallet_id=wallet.id,
            transaction_type=WalletTransactionType.REWARD,
            amount=0,
            balance_after=wallet.balance,
            description=reason,
            reference=reference,
        )
    )
    await db.flush()
    return wallet


async def award_achievement(
    db: AsyncSession, user_id: UUID, code: str
) -> UserAchievement | None:
    achievement = (
        await db.execute(select(Achievement).where(Achievement.code == code))
    ).scalar_one_or_none()
    if achievement is None:
        return None
    existing = (
        await db.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_id == achievement.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return None
    item = UserAchievement(
        user_id=user_id,
        achievement_id=achievement.id,
        awarded_at=datetime.now(UTC),
    )
    db.add(item)
    await add_xp(db, user_id, achievement.xp_reward, f"دستاورد: {achievement.title}")
    return item


async def stamp_passport(
    db: AsyncSession, user_id: UUID, destination_id: UUID
) -> PassportStamp | None:
    existing = (
        await db.execute(
            select(PassportStamp).where(
                PassportStamp.user_id == user_id,
                PassportStamp.destination_id == destination_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return None
    stamp = PassportStamp(
        user_id=user_id,
        destination_id=destination_id,
        visited_at=datetime.now(UTC),
    )
    db.add(stamp)
    await add_xp(db, user_id, 30, "ثبت مقصد جدید در پاسپورت سفر", str(destination_id))
    count = len(
        (
            await db.execute(
                select(PassportStamp.id).where(PassportStamp.user_id == user_id)
            )
        ).all()
    ) + 1
    if count >= 1:
        await award_achievement(db, user_id, "first_destination")
    if count >= 5:
        await award_achievement(db, user_id, "five_cities")
    if count >= 10:
        await award_achievement(db, user_id, "ten_cities")
    return stamp


async def progress_challenges(db: AsyncSession, user_id: UUID, metric: str, amount: int = 1) -> None:
    now = datetime.now(UTC)
    challenges = (
        await db.execute(
            select(Challenge).where(
                Challenge.is_active.is_(True), Challenge.metric == metric
            )
        )
    ).scalars().all()
    for challenge in challenges:
        if challenge.ends_at and challenge.ends_at < now:
            continue
        current = (
            await db.execute(
                select(UserChallenge).where(
                    UserChallenge.user_id == user_id,
                    UserChallenge.challenge_id == challenge.id,
                )
            )
        ).scalar_one_or_none()
        if current is None:
            current = UserChallenge(user_id=user_id, challenge_id=challenge.id, progress=0)
            db.add(current)
        if current.completed_at is not None:
            continue
        current.progress += amount
        if current.progress >= challenge.target:
            current.completed_at = now
            await add_xp(db, user_id, challenge.xp_reward, f"چالش: {challenge.title}")
    await db.flush()
