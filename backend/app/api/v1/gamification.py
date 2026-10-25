from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import (
    Achievement,
    Challenge,
    Destination,
    PassportStamp,
    User,
    UserAchievement,
    UserChallenge,
)
from app.db.session import get_db
from app.schemas.engagement import (
    AchievementOut,
    ChallengeOut,
    GamificationOut,
    PassportStampOut,
)
from app.services.loyalty import LEVELS, get_or_create_wallet, next_level

router = APIRouter(prefix="/gamification", tags=["Gamification"])


@router.get("/profile", response_model=GamificationOut, summary="پاسپورت و دستاوردهای سفر")
async def profile(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> GamificationOut:
    wallet = await get_or_create_wallet(db, user.id)
    await db.commit()

    achievements = list(
        (await db.execute(select(Achievement).where(Achievement.is_active.is_(True)).order_by(Achievement.xp_reward)))
        .scalars().all()
    )
    unlocked_rows = list(
        (
            await db.execute(
                select(UserAchievement).where(UserAchievement.user_id == user.id)
            )
        ).scalars().all()
    )
    unlocked = {row.achievement_id: row.awarded_at for row in unlocked_rows}

    stamp_rows = list(
        (
            await db.execute(
                select(PassportStamp, Destination)
                .join(Destination, Destination.id == PassportStamp.destination_id)
                .where(PassportStamp.user_id == user.id)
                .order_by(PassportStamp.visited_at.desc())
            )
        ).all()
    )
    stamps = [
        PassportStampOut(
            destination_id=dest.id,
            name=dest.name,
            slug=dest.slug,
            country=dest.country,
            image_url=dest.image_url,
            visited_at=stamp.visited_at,
        )
        for stamp, dest in stamp_rows
    ]

    challenges = list(
        (
            await db.execute(
                select(Challenge).where(Challenge.is_active.is_(True)).order_by(Challenge.xp_reward)
            )
        ).scalars().all()
    )
    progress_rows = list(
        (
            await db.execute(
                select(UserChallenge).where(UserChallenge.user_id == user.id)
            )
        ).scalars().all()
    )
    progress = {row.challenge_id: row for row in progress_rows}

    next_name, remaining = next_level(wallet.xp)
    current_threshold = dict(LEVELS).get(wallet.level, 0)
    target_threshold = dict(LEVELS).get(next_name, current_threshold) if next_name else current_threshold
    span = max(1, target_threshold - current_threshold)
    level_progress = min(100.0, round((wallet.xp - current_threshold) / span * 100, 1)) if next_name else 100.0

    return GamificationOut(
        xp=wallet.xp,
        points=wallet.points,
        level=wallet.level,
        next_level=next_name,
        xp_to_next_level=remaining,
        level_progress=level_progress,
        stamps=stamps,
        achievements=[
            AchievementOut(
                id=a.id,
                code=a.code,
                title=a.title,
                description=a.description,
                icon=a.icon,
                category=a.category,
                xp_reward=a.xp_reward,
                unlocked=a.id in unlocked,
                awarded_at=unlocked.get(a.id),
            )
            for a in achievements
        ],
        challenges=[
            ChallengeOut(
                id=c.id,
                code=c.code,
                title=c.title,
                description=c.description,
                icon=c.icon,
                xp_reward=c.xp_reward,
                target=c.target,
                progress=progress.get(c.id).progress if c.id in progress else 0,
                completed=bool(progress.get(c.id) and progress[c.id].completed_at),
                ends_at=c.ends_at,
            )
            for c in challenges
        ],
    )


@router.get("/leaderboard", summary="جدول مسافران برتر")
async def leaderboard(db: AsyncSession = Depends(get_db)) -> list[dict]:
    from app.db.models import Wallet

    rows = (
        await db.execute(
            select(Wallet, User)
            .join(User, User.id == Wallet.user_id)
            .where(User.is_active.is_(True))
            .order_by(Wallet.xp.desc())
            .limit(20)
        )
    ).all()
    return [
        {
            "rank": index + 1,
            "name": user.full_name,
            "avatar_url": user.avatar_url,
            "level": wallet.level,
            "xp": wallet.xp,
            "points": wallet.points,
        }
        for index, (wallet, user) in enumerate(rows)
    ]
