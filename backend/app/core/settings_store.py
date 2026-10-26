"""Persistent application settings store (JSON file backed).

Used by the admin panel (``/admin/settings``). Settings are kept out of the
database so they can be changed without a migration and read on boot.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger("seir.settings")

DEFAULT_SETTINGS: dict[str, Any] = {
    "site_name": "سیر",
    "site_tagline": "سوپراپ سفر ایران",
    "support_phone": "۰۲۱-۱۲۳۴۵۶۷۸",
    "support_email": "support@seir.ir",
    "default_currency": "IRT",
    "default_locale": "fa",
    "booking_hold_minutes": 15,
    "cancellation_window_hours": 48,
    "commission_rate": 15.0,
    "maintenance_mode": False,
    "registration_open": True,
}


def _settings_path() -> Path:
    configured = os.getenv("APP_SETTINGS_FILE")
    base = Path(configured) if configured else Path(os.getenv("DATA_DIR", "./data")) / "app_settings.json"
    base.parent.mkdir(parents=True, exist_ok=True)
    return base


def get_app_settings() -> dict[str, Any]:
    """Read settings; unknown/missing values fall back to defaults."""
    settings = dict(DEFAULT_SETTINGS)
    path = _settings_path()
    try:
        stored = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(stored, dict):
            settings.update(stored)
    except FileNotFoundError:
        pass
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("app settings file unreadable (%s): %s", path, exc)
    return settings


def save_app_settings(settings: dict[str, Any]) -> None:
    """Persist settings atomically (defaults are not stored)."""
    path = _settings_path()
    payload = {k: v for k, v in settings.items() if k in DEFAULT_SETTINGS}
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp"
        ) as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            tmp_name = handle.name
        os.replace(tmp_name, path)
    except OSError as exc:
        logger.error("app settings could not be saved: %s", exc)
        raise
