from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import ORMModel


class RegisterRequest(ORMModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, max_length=120)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if value.isdigit() or value.isalpha():
            raise ValueError("رمز عبور باید ترکیبی از حرف و رقم باشد.")
        return value


class LoginRequest(ORMModel):
    identifier: str = Field(min_length=3, max_length=255, description="Email or phone")
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(ORMModel):
    refresh_token: str


class OTPRequest(ORMModel):
    phone: str = Field(min_length=8, max_length=20)


class OTPVerifyRequest(ORMModel):
    phone: str = Field(min_length=8, max_length=20)
    code: str = Field(min_length=4, max_length=8)
    full_name: str | None = Field(default=None, max_length=160)


class OTPResponse(ORMModel):
    message: str
    expires_in: int
    debug_code: str | None = None


class ChangePasswordRequest(ORMModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(ORMModel):
    id: UUID
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str
    avatar_url: str | None = None
    locale: str
    currency: str
    city: str | None = None
    role: str
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None = None
    created_at: datetime
    privacy_settings: dict = Field(default_factory=dict)
    notification_settings: dict = Field(default_factory=dict)


class TokenPair(ORMModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(ORMModel):
    tokens: TokenPair
    user: UserOut
