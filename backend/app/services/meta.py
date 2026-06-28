"""Stock metadata service — tickers table with yfinance fallback."""
from __future__ import annotations

import asyncio

import yfinance as yf

from app.db import get_supabase
from app.models import StockMeta


def _row_to_meta(row: dict) -> StockMeta:
    return StockMeta(
        symbol=row["symbol"],
        name=row["name"],
        exchange=row.get("exchange"),
        sector=row.get("sector"),
        industry=row.get("industry"),
        country=row.get("country"),
        currency=row.get("currency"),
        isin=row.get("isin"),
    )


def _fetch_yfinance(ticker: str) -> dict:
    return yf.Ticker(ticker).info or {}


async def get_stock_meta(ticker: str) -> StockMeta:
    """Return StockMeta from tickers table, falling back to yfinance. Raises ValueError if not found."""
    ticker = ticker.upper()
    db = get_supabase()

    rows = db.table("tickers").select("*").eq("symbol", ticker).limit(1).execute().data
    if rows:
        return _row_to_meta(rows[0])

    info = await asyncio.to_thread(_fetch_yfinance, ticker)
    if not info.get("quoteType"):
        raise ValueError(f"No data found for ticker '{ticker}'")

    row = {
        "symbol": ticker,
        "name": info.get("longName") or info.get("shortName") or ticker,
        "exchange": info.get("exchange"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "country": info.get("country"),
        "currency": info.get("currency"),
        "isin": info.get("isin"),
    }
    db.table("tickers").upsert(row, on_conflict="symbol").execute()
    return StockMeta(**row)
