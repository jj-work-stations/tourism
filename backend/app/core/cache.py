from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger("seir.cache")


class Cache:
    """Small async cache facade. Degrades to a no-op when Redis is unavailable."""

    def __init__(self, url: str | None = None) -> None:
        self.url = url
        self._client: redis.Redis | None = None
        self._memory: dict[str, str] = {}

    async def connect(self) -> None:
        if not self.url:
            return
        try:
            client = redis.from_url(self.url, encoding="utf-8", decode_responses=True)
            await client.ping()
            self._client = client
        except Exception as exc:  # pragma: no cover - infrastructure dependent
            logger.warning("Redis unavailable, using in-process cache: %s", exc)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_json(self, key: str) -> Any | None:
        if self._client is not None:
            try:
                raw = await self._client.get(key)
                return json.loads(raw) if raw else None
            except Exception:
                return None
        raw = self._memory.get(key)
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: Any, ttl: int | None = None) -> None:
        ttl = ttl or settings.cache_ttl_seconds
        raw = json.dumps(value, ensure_ascii=False, default=str)
        if self._client is not None:
            try:
                await self._client.set(key, raw, ex=ttl)
                return
            except Exception:
                pass
        if len(self._memory) > 2000:
            self._memory.clear()
        self._memory[key] = raw

    async def delete(self, *keys: str) -> None:
        if self._client is not None:
            try:
                if keys:
                    await self._client.delete(*keys)
            except Exception:
                pass
        for key in keys:
            self._memory.pop(key, None)

    async def set_raw(self, key: str, value: str, ttl: int) -> None:
        if self._client is not None:
            try:
                await self._client.set(key, value, ex=ttl)
                return
            except Exception:
                pass
        self._memory[key] = value

    async def get_raw(self, key: str) -> str | None:
        if self._client is not None:
            try:
                return await self._client.get(key)
            except Exception:
                pass
        return self._memory.get(key)

    async def incr(self, key: str, ttl: int) -> int:
        if self._client is not None:
            try:
                value = await self._client.incr(key)
                if value == 1:
                    await self._client.expire(key, ttl)
                return int(value)
            except Exception:
                pass
        current = int(self._memory.get(key, "0")) + 1
        self._memory[key] = str(current)
        return current

    async def delete_prefix(self, prefix: str) -> None:
        for key in [k for k in self._memory if k.startswith(prefix)]:
            self._memory.pop(key, None)
        if self._client is not None:
            try:
                async for key in self._client.scan_iter(match=f"{prefix}*"):
                    await self._client.delete(key)
            except Exception:
                pass


cache = Cache(settings.redis_url)
