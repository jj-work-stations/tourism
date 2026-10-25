from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("seir.ai")


async def polish_reply(message: str, context: str, fallback: str) -> str:
    """Optionally rewrite a deterministic assistant reply with an LLM.

    The product works fully without an API key; when configured, any
    OpenAI-compatible endpoint can be used for a more conversational tone.
    """
    if not settings.ai_api_key:
        return fallback
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(
                f"{settings.ai_base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.ai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.ai_model,
                    "temperature": 0.4,
                    "max_tokens": 450,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "تو دستیار سفر «سیر» هستی. پاسخ‌ها را کوتاه، دقیق و فارسی بنویس. "
                                "از اطلاعات داده‌شده خارج نشو و قیمت جدیدی نساز. " + context
                            ),
                        },
                        {"role": "user", "content": message},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # pragma: no cover - external provider
        logger.warning("LLM provider failed, using deterministic reply: %s", exc)
        return fallback
