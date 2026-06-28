"""Narrative generation service: calls Gemini and validates output."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import yfinance as yf
from google import genai
from google.genai import types
from pydantic import ValidationError

from app.config import get_settings
from app.db import get_supabase
from app.models import Narrative
from app.prompts.templates import (
    SYSTEM_PROMPT,
    build_messages,
    fmt_consensus,
    fmt_earnings,
    fmt_fundamentals,
    fmt_news,
    fmt_peer_multiples,
)
from app.services.fundamentals import get_fundamentals
from app.services.meta import get_stock_meta
from app.services.news import get_news

log = logging.getLogger(__name__)


class NarrativeService:
    def __init__(self) -> None:
        s = get_settings()
        self._client = genai.Client(api_key=s.gemini_api_key)
        self._model_name = s.gemini_model
        self._gen_config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            max_output_tokens=s.gemini_max_output_tokens,
        )
        self._cache_hours = s.narrative_cache_hours

    async def generate(self, ticker: str, *, force_refresh: bool = False) -> tuple[Narrative, str]:
        """
        Return (narrative, input_hash) for *ticker*.

        Reads from Supabase cache unless force_refresh=True or cache expired.
        input_hash is sha256 of the assembled prompt context — changes when
        fundamentals or news change, which invalidates the cache entry.
        """
        ticker = ticker.upper()

        ctx = await _build_context(ticker)
        input_hash = _hash_context(ctx)

        if not force_refresh:
            cached = _read_cache(ticker)
            if cached is not None:
                log.info("Narrative cache hit ticker=%s", ticker)
                return cached, input_hash

        user_prompt = build_messages(ctx)[0]["content"]

        log.info("Calling Gemini for ticker=%s hash=%s", ticker, input_hash[:8])
        response = await self._client.aio.models.generate_content(
            model=self._model_name,
            contents=user_prompt,
            config=self._gen_config,
        )

        narrative = _parse_and_validate(response.text)
        _write_cache(ticker, narrative, input_hash, self._cache_hours)
        return narrative, input_hash


# ---------------------------------------------------------------------------
# Context assembly
# ---------------------------------------------------------------------------
async def _build_context(ticker: str) -> dict[str, Any]:
    """Fetch meta, fundamentals, news concurrently and assemble prompt context."""
    meta, fund, news_items, biz_desc = await asyncio.gather(
        get_stock_meta(ticker),
        get_fundamentals(ticker),
        get_news(ticker, limit=5),
        asyncio.to_thread(_fetch_business_description, ticker),
        return_exceptions=True,
    )

    name = meta.name if not isinstance(meta, Exception) else ticker
    sector = meta.sector if not isinstance(meta, Exception) else None
    industry = meta.industry if not isinstance(meta, Exception) else None
    country = meta.country if not isinstance(meta, Exception) else None
    currency = meta.currency if not isinstance(meta, Exception) else None

    fund_dict: dict[str, Any] | None = None
    if not isinstance(fund, Exception):
        fund_dict = {
            "market_cap": fund.market_cap,
            "pe_ratio": fund.pe_trailing,
            "forward_pe": fund.pe_forward,
            "pb_ratio": fund.price_to_book,
            "ev_ebitda": fund.ev_to_ebitda,
            "roe": fund.roe,
            "debt_equity": fund.debt_to_equity,
            "dividend_yield": fund.dividend_yield,
            "payout_ratio": fund.payout_ratio,
            "profit_margin": fund.profit_margin,
        }

    news_list: list[dict[str, Any]] | None = None
    if not isinstance(news_items, Exception) and news_items:
        news_list = [
            {
                "published_at": n.published_at,
                "headline": n.headline,
                "sentiment": n.sentiment,
            }
            for n in news_items
        ]

    business_description = (
        biz_desc
        if not isinstance(biz_desc, Exception) and biz_desc
        else "non disponibile"
    )

    return {
        "ticker": ticker,
        "name": name,
        "sector": sector or "n/d",
        "industry": industry or "n/d",
        "country": country or "n/d",
        "currency": currency or "n/d",
        "business_description": business_description,
        "fundamentals_block": fmt_fundamentals(fund_dict),
        "earnings_block": fmt_earnings(None),
        "consensus_block": fmt_consensus(None),
        "peer_multiples_block": fmt_peer_multiples(None),
        "news_block": fmt_news(news_list),
    }


def _fetch_business_description(ticker: str) -> str | None:
    info = yf.Ticker(ticker).info or {}
    return info.get("longBusinessSummary") or None


# ---------------------------------------------------------------------------
# Supabase cache
# ---------------------------------------------------------------------------
def _read_cache(ticker: str) -> Narrative | None:
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    rows = (
        db.table("narrative_cache")
        .select("payload")
        .eq("symbol", ticker)
        .gt("expires_at", now)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return None
    try:
        return Narrative.model_validate(rows[0]["payload"])
    except (ValidationError, KeyError):
        return None


def _write_cache(ticker: str, narrative: Narrative, input_hash: str, cache_hours: int) -> None:
    db = get_supabase()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=cache_hours)).isoformat()
    db.table("narrative_cache").upsert(
        {
            "symbol": ticker,
            "lang": "it",
            "model": get_settings().gemini_model,
            "input_hash": input_hash,
            "payload": narrative.model_dump(),
            "created_at": now.isoformat(),
            "expires_at": expires_at,
        },
        on_conflict="symbol,lang",
    ).execute()


# ---------------------------------------------------------------------------
# Parsing and hashing
# ---------------------------------------------------------------------------
def _parse_and_validate(raw: str) -> Narrative:
    """Parse JSON from Gemini response and validate with Pydantic."""
    cleaned = raw.strip()
    # Defensive: strip markdown fences even though JSON mode should prevent them
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        log.error("Gemini returned non-JSON output: %s", cleaned[:500])
        raise ValueError(f"Gemini output is not valid JSON: {e}") from e

    try:
        return Narrative.model_validate(data)
    except ValidationError as e:
        log.error("Gemini JSON did not match schema: %s", e)
        raise


def _hash_context(ctx: dict[str, Any]) -> str:
    payload = json.dumps(ctx, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
