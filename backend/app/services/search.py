"""Symbol search service — Finnhub symbol_lookup + in-memory LRU cache (TTL 1h, max 200)."""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

import finnhub

from app.config import get_settings
from app.models import SearchResult

_cache: OrderedDict[str, tuple[list[SearchResult], datetime]] = OrderedDict()
_TTL = timedelta(hours=1)
_MAX = 200


def _get(key: str) -> list[SearchResult] | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    results, expires_at = entry
    if datetime.now(timezone.utc) > expires_at:
        del _cache[key]
        return None
    _cache.move_to_end(key)
    return results


def _set(key: str, results: list[SearchResult]) -> None:
    if key in _cache:
        _cache.move_to_end(key)
    _cache[key] = (results, datetime.now(timezone.utc) + _TTL)
    while len(_cache) > _MAX:
        _cache.popitem(last=False)


def _fetch(q: str) -> list[SearchResult]:
    client = finnhub.Client(api_key=get_settings().finnhub_api_key)
    raw = client.symbol_lookup(q)
    items = (raw or {}).get("result") or []
    return [
        SearchResult(
            symbol=item["symbol"],
            description=item.get("description", ""),
            type=item.get("type") or None,
        )
        for item in items[:10]
    ]


async def search_symbols(q: str) -> list[SearchResult]:
    if len(q) < 2:
        return []
    key = q.lower()
    cached = _get(key)
    if cached is not None:
        return cached
    results = await asyncio.to_thread(_fetch, q)
    _set(key, results)
    return results
