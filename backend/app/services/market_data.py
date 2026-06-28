"""Market data service — yfinance primary, Supabase cache."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta

import yfinance as yf

from app.db import get_supabase
from app.models import PricePoint, StockMeta

_RANGE_TO_DAYS: dict[str, int | None] = {
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "3y": 365 * 3,
    "5y": 365 * 5,
    "max": None,
}


def _range_start(range_: str) -> date | None:
    days = _RANGE_TO_DAYS[range_]
    return date.today() - timedelta(days=days) if days is not None else None


def _fetch_yfinance(ticker: str, start: date | None) -> tuple[list[PricePoint], StockMeta | None]:
    """Synchronous yfinance call — run via asyncio.to_thread."""
    t = yf.Ticker(ticker)
    kwargs: dict = {"auto_adjust": False}
    if start:
        kwargs["start"] = start.isoformat()
    else:
        kwargs["period"] = "max"

    df = t.history(**kwargs)
    if df.empty:
        return [], None

    info = t.info or {}
    meta = StockMeta(
        symbol=ticker.upper(),
        name=info.get("longName") or info.get("shortName") or ticker.upper(),
        exchange=info.get("exchange"),
        sector=info.get("sector"),
        industry=info.get("industry"),
        country=info.get("country"),
        currency=info.get("currency"),
        isin=info.get("isin"),
    )

    import math

    def _nan_to_none(v: float) -> float | None:
        return None if math.isnan(v) else v

    points: list[PricePoint] = []
    for idx, row in df.iterrows():
        close = float(row["Close"])
        if math.isnan(close):
            continue
        points.append(
            PricePoint(
                date=idx.strftime("%Y-%m-%d"),
                open=_nan_to_none(float(row["Open"])),
                high=_nan_to_none(float(row["High"])),
                low=_nan_to_none(float(row["Low"])),
                close=close,
                adj_close=_nan_to_none(float(row.get("Adj Close", row["Close"]))),
                volume=int(row["Volume"]) if row["Volume"] and not math.isnan(float(row["Volume"])) else None,
            )
        )
    return points, meta


def _is_cache_fresh(cached_dates: list[str]) -> bool:
    if not cached_dates:
        return False
    latest = date.fromisoformat(max(cached_dates))
    today = date.today()
    # Accept today or yesterday (covers weekends/holidays)
    return (today - latest).days <= 1


def _upsert_ticker(meta: StockMeta) -> None:
    db = get_supabase()
    db.table("tickers").upsert(
        {
            "symbol": meta.symbol,
            "name": meta.name,
            "exchange": meta.exchange,
            "sector": meta.sector,
            "industry": meta.industry,
            "country": meta.country,
            "currency": meta.currency,
            "isin": meta.isin,
        },
        on_conflict="symbol",
    ).execute()


def _upsert_prices(symbol: str, points: list[PricePoint]) -> None:
    db = get_supabase()
    rows = [
        {
            "symbol": symbol,
            "date": p.date,
            "open": p.open,
            "high": p.high,
            "low": p.low,
            "close": p.close,
            "adj_close": p.adj_close,
            "volume": p.volume,
        }
        for p in points
    ]
    # Batch in chunks to avoid request size limits
    chunk = 500
    for i in range(0, len(rows), chunk):
        db.table("price_history_cache").upsert(
            rows[i : i + chunk], on_conflict="symbol,date"
        ).execute()


def _read_cache(symbol: str, start: date | None) -> list[PricePoint]:
    db = get_supabase()
    query = db.table("price_history_cache").select("*").eq("symbol", symbol)
    if start:
        query = query.gte("date", start.isoformat())
    rows = query.order("date").execute().data
    return [
        PricePoint(
            date=r["date"],
            open=float(r["open"]),
            high=float(r["high"]),
            low=float(r["low"]),
            close=float(r["close"]),
            adj_close=float(r["adj_close"]) if r["adj_close"] is not None else None,
            volume=int(r["volume"]) if r["volume"] is not None else None,
        )
        for r in rows
    ]


async def get_prices(ticker: str, range_: str) -> list[PricePoint]:
    """Return OHLCV history for *ticker* over *range_*. Raises ValueError if not found."""
    ticker = ticker.upper()
    start = _range_start(range_)

    # --- Cache read ---
    cached = _read_cache(ticker, start)
    if _is_cache_fresh([p.date for p in cached]):
        return cached

    # --- Cache miss: fetch from yfinance ---
    points, meta = await asyncio.to_thread(_fetch_yfinance, ticker, start)
    if not points:
        raise ValueError(f"No data found for ticker '{ticker}'")

    # --- Persist ---
    _upsert_ticker(meta)  # type: ignore[arg-type]
    _upsert_prices(ticker, points)

    return points
