"""Exchange rate endpoint — EUR/USD live via yfinance, 1h in-memory cache."""
from __future__ import annotations

import asyncio
import time

import yfinance as yf
from fastapi import APIRouter, HTTPException

router = APIRouter()

_cache: dict[str, float | None] = {"rate": None, "updated_at": None}
_CACHE_TTL = 3600.0  # seconds


def _fetch_rate() -> float:
    ticker = yf.Ticker("EURUSD=X")
    try:
        rate = float(ticker.fast_info.last_price)
    except Exception:
        hist = ticker.history(period="1d")
        if hist.empty:
            raise ValueError("Cannot fetch EUR/USD rate")
        rate = float(hist["Close"].iloc[-1])
    if not rate or rate <= 0:
        raise ValueError("Invalid EUR/USD rate received")
    return rate


@router.get("/exchange-rate")
async def get_exchange_rate() -> dict:
    """Return live EUR/USD exchange rate (USD per 1 EUR), cached 1h."""
    now = time.time()
    cached_at = _cache["updated_at"]
    if _cache["rate"] is None or cached_at is None or (now - cached_at) > _CACHE_TTL:
        try:
            rate = await asyncio.to_thread(_fetch_rate)
        except Exception as exc:
            if _cache["rate"] is not None:
                # serve stale cache rather than failing
                return {"rate": _cache["rate"], "updated_at": _cache["updated_at"], "stale": True}
            raise HTTPException(status_code=502, detail=f"Cannot fetch exchange rate: {exc}") from exc
        _cache["rate"] = rate
        _cache["updated_at"] = now

    return {"rate": _cache["rate"], "updated_at": _cache["updated_at"], "stale": False}
