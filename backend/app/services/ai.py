from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger("seir.ai")

SYSTEM_PROMPT = (
    "تو دستیار سفر «سیر» هستی. پاسخ‌ها را کوتاه، دقیق و فارسی بنویس. "
    "از اطلاعات داده‌شده خارج نشو و قیمت یا مکان جدیدی نساز. "
)


def _configuration() -> tuple[str, str, str] | None:
    """Return (provider, base_url, model) when the assistant is configured."""
    provider = settings.ai_provider
    if provider == "none" or not settings.ai_api_key:
        return None
    defaults = {
        "openai": "https://api.openai.com/v1",
        "openai_compatible": "https://api.openai.com/v1",
        "anthropic": "https://api.anthropic.com/v1",
        "gemini": "https://generativelanguage.googleapis.com/v1beta",
    }
    base_url = (settings.ai_base_url or defaults[provider]).rstrip("/")
    return provider, base_url, settings.ai_model


async def _openai_compatible(
    client: httpx.AsyncClient, base_url: str, model: str, system: str, message: str
) -> str:
    response = await client.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.ai_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0.4,
            "max_tokens": settings.ai_max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
        },
    )
    response.raise_for_status()
    data: dict[str, Any] = response.json()
    return str(data["choices"][0]["message"]["content"]).strip()


async def _anthropic(
    client: httpx.AsyncClient, base_url: str, model: str, system: str, message: str
) -> str:
    response = await client.post(
        f"{base_url}/messages",
        headers={
            "x-api-key": settings.ai_api_key or "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": settings.ai_max_tokens,
            "temperature": 0.4,
            "system": system,
            "messages": [{"role": "user", "content": message}],
        },
    )
    response.raise_for_status()
    data: dict[str, Any] = response.json()
    blocks = data.get("content") or []
    return "".join(str(block.get("text", "")) for block in blocks if block.get("type") == "text").strip()


async def _gemini(
    client: httpx.AsyncClient, base_url: str, model: str, system: str, message: str
) -> str:
    response = await client.post(
        f"{base_url}/models/{quote(model, safe='')}:generateContent",
        params={"key": settings.ai_api_key},
        headers={"content-type": "application/json"},
        json={
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": message}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": settings.ai_max_tokens,
            },
        },
    )
    response.raise_for_status()
    data: dict[str, Any] = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(str(part.get("text", "")) for part in parts).strip()


async def polish_reply(message: str, context: str, fallback: str) -> str:
    """Optionally rewrite a deterministic assistant reply with an LLM.

    ``settings.ai_provider`` selects OpenAI, any OpenAI-compatible gateway
    (OpenRouter, Groq, vLLM, Ollama, ...), Anthropic Claude, or Google Gemini.
    The deterministic planner remains the source of truth, so a provider
    outage or missing key never breaks the product.
    """
    configuration = _configuration()
    if configuration is None:
        return fallback
    provider, base_url, model = configuration
    system = SYSTEM_PROMPT + context
    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            if provider in {"openai", "openai_compatible"}:
                reply = await _openai_compatible(client, base_url, model, system, message)
            elif provider == "anthropic":
                reply = await _anthropic(client, base_url, model, system, message)
            else:
                reply = await _gemini(client, base_url, model, system, message)
        return reply or fallback
    except Exception as exc:  # pragma: no cover - external provider
        logger.warning("LLM provider failed, using deterministic reply: %s", exc)
        return fallback
