"""News service — Finnhub company_news + Supabase cache (TTL 6h, cleanup 60d)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import finnhub

from app.config import get_settings
from app.db import get_supabase
from app.models import NewsItem


def _finnhub_client() -> finnhub.Client:
    return finnhub.Client(api_key=get_settings().finnhub_api_key)


def _fetch_news_and_profile(ticker: str) -> tuple[list[dict], dict]:
    """Synchronous Finnhub calls — run via asyncio.to_thread."""
    client = _finnhub_client()
    today = datetime.now(timezone.utc).date()
    thirty_days_ago = today - timedelta(days=30)
    news = client.company_news(ticker, _from=thirty_days_ago.isoformat(), to=today.isoformat())
    profile = client.company_profile2(symbol=ticker)
    return news or [], profile or {}


def _to_news_item(ticker: str, raw: dict) -> NewsItem:
    published_at = datetime.fromtimestamp(raw["datetime"], tz=timezone.utc).isoformat()
    return NewsItem(
        finnhub_id=raw["id"],
        symbol=ticker,
        headline=raw.get("headline", ""),
        url=raw.get("url", ""),
        source=raw.get("source") or None,
        published_at=published_at,
        summary=raw.get("summary") or None,
        image=raw.get("image") or None,
        sentiment=None,
    )


def _is_cache_fresh(ticker: str) -> bool:
    db = get_supabase()
    rows = (
        db.table("news_cache")
        .select("fetched_at")
        .eq("symbol", ticker)
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return False
    fetched_at = datetime.fromisoformat(rows[0]["fetched_at"])
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - fetched_at) < timedelta(hours=6)


def _read_cache(ticker: str, limit: int) -> list[NewsItem]:
    db = get_supabase()
    rows = (
        db.table("news_cache")
        .select("*")
        .eq("symbol", ticker)
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    return [
        NewsItem(
            finnhub_id=r["id"],
            symbol=r["symbol"],
            headline=r["headline"],
            url=r["url"],
            source=r.get("source"),
            published_at=r["published_at"],
            summary=r.get("summary"),
            image=None,
            sentiment=float(r["sentiment"]) if r.get("sentiment") is not None else None,
        )
        for r in rows
    ]


def _upsert_ticker(ticker: str, profile: dict) -> None:
    db = get_supabase()
    db.table("tickers").upsert(
        {
            "symbol": ticker,
            "name": profile.get("name") or ticker,
            "exchange": profile.get("exchange"),
            "country": profile.get("country"),
            "currency": profile.get("currency"),
        },
        on_conflict="symbol",
    ).execute()


def _upsert_news(ticker: str, items: list[NewsItem]) -> None:
    if not items:
        return
    db = get_supabase()
    # Keep only the 100 most recent to avoid bloating the table
    for item in items[:100]:
        db.table("news_cache").upsert(
            {
                "symbol": ticker,
                "headline": item.headline,
                "url": item.url,
                "source": item.source,
                "published_at": item.published_at,
                "sentiment": item.sentiment,
                "summary": item.summary,
            },
            on_conflict="symbol,url",
            ignore_duplicates=True,
        ).execute()


def _cleanup_old_news(ticker: str) -> None:
    db = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    db.table("news_cache").delete().eq("symbol", ticker).lt("published_at", cutoff).execute()


async def get_news(ticker: str, limit: int) -> list[NewsItem]:
    """Return latest *limit* news for *ticker* from cache or Finnhub."""
    ticker = ticker.upper()

    if _is_cache_fresh(ticker):
        return _read_cache(ticker, limit)

    raw_news, profile = await asyncio.to_thread(_fetch_news_and_profile, ticker)

    _upsert_ticker(ticker, profile)
    items = [_to_news_item(ticker, r) for r in raw_news]
    _upsert_news(ticker, items)
    _cleanup_old_news(ticker)

    return sorted(items, key=lambda x: x.published_at, reverse=True)[:limit]
