from __future__ import annotations

from pydantic import Field

from app.schemas.common import ORMModel


class PreferenceOut(ORMModel):
    interests: list[str] = Field(default_factory=list)
    budget_level: str = "mid"
    travel_style: str = "balanced"
    preferred_transport: str | None = None
    preferred_accommodation: str | None = None
    dietary_preferences: list[str] = Field(default_factory=list)
    accessibility_needs: list[str] = Field(default_factory=list)
    marketing_opt_in: bool = True


class PreferenceUpdate(ORMModel):
    interests: list[str] | None = None
    budget_level: str | None = Field(default=None, pattern="^(budget|mid|luxury)$")
    travel_style: str | None = None
    preferred_transport: str | None = None
    preferred_accommodation: str | None = None
    dietary_preferences: list[str] | None = None
    accessibility_needs: list[str] | None = None
    marketing_opt_in: bool | None = None


class UserUpdate(ORMModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    avatar_url: str | None = Field(default=None, max_length=500)
    locale: str | None = Field(default=None, pattern="^(fa|en|ar|tr)$")
    currency: str | None = Field(default=None, max_length=8)
    city: str | None = Field(default=None, max_length=120)
    privacy_settings: dict | None = None
    notification_settings: dict | None = None


class UserWithPreferences(ORMModel):
    id: str
    full_name: str
    avatar_url: str | None
    preferences: PreferenceOut | None = None
