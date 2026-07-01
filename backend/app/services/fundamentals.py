"""Fundamentals service — yfinance.info + Supabase cache (TTL 24h)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import yfinance as yf

from app.db import get_supabase
from app.models import Fundamentals


def _fetch_yfinance(ticker: str) -> dict:
    """Synchronous yfinance call — run via asyncio.to_thread."""
    return yf.Ticker(ticker).info or {}


def _info_to_fundamentals(ticker: str, info: dict) -> Fundamentals:
    def _int(key: str) -> int | None:
        v = info.get(key)
        return int(v) if v is not None else None

    def _float(key: str) -> float | None:
        v = info.get(key)
        return float(v) if v is not None else None

    return Fundamentals(
        symbol=ticker,
        market_cap=_int("marketCap"),
        pe_trailing=_float("trailingPE"),
        pe_forward=_float("forwardPE"),
        price_to_book=_float("priceToBook"),
        ev_to_ebitda=_float("enterpriseToEbitda"),
        price_to_sales=_float("priceToSalesTrailing12Months"),
        peg_ratio=_float("pegRatio"),
        eps_trailing=_float("trailingEps"),
        eps_forward=_float("forwardEps"),
        roe=_float("returnOnEquity"),
        roa=_float("returnOnAssets"),
        profit_margin=_float("profitMargins"),
        gross_margin=_float("grossMargins"),
        operating_margin=_float("operatingMargins"),
        ebitda_margin=_float("ebitdaMargins"),
        revenue_growth=_float("revenueGrowth"),
        earnings_growth=_float("earningsGrowth"),
        debt_to_equity=_float("debtToEquity"),
        current_ratio=_float("currentRatio"),
        quick_ratio=_float("quickRatio"),
        dividend_yield=_float("dividendYield"),
        payout_ratio=_float("payoutRatio"),
        beta=_float("beta"),
        fifty_two_week_high=_float("fiftyTwoWeekHigh"),
        fifty_two_week_low=_float("fiftyTwoWeekLow"),
        day_high=_float("dayHigh"),
        day_low=_float("dayLow"),
        previous_close=_float("previousClose"),
        total_revenue=_int("totalRevenue"),
        free_cashflow=_int("freeCashflow"),
        shares_outstanding=_int("sharesOutstanding"),
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )


def _upsert_ticker_minimal(ticker: str, info: dict) -> None:
    db = get_supabase()
    db.table("tickers").upsert(
        {
            "symbol": ticker,
            "name": info.get("longName") or info.get("shortName") or ticker,
            "exchange": info.get("exchange"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "currency": info.get("currency"),
            "isin": info.get("isin"),
        },
        on_conflict="symbol",
    ).execute()


def _read_cache(ticker: str) -> Fundamentals | None:
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    rows = (
        db.table("fundamentals_cache")
        .select("payload")
        .eq("symbol", ticker)
        .gt("expires_at", now)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return None
    return Fundamentals.model_validate(rows[0]["payload"])


def _write_cache(ticker: str, fund: Fundamentals) -> None:
    db = get_supabase()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    db.table("fundamentals_cache").upsert(
        {
            "symbol": ticker,
            "payload": fund.model_dump(),
            "fetched_at": fund.fetched_at,
            "expires_at": expires_at,
        },
        on_conflict="symbol",
    ).execute()


async def get_fundamentals(ticker: str) -> Fundamentals:
    """Return fundamentals for *ticker*. Raises ValueError if ticker not found."""
    ticker = ticker.upper()

    cached = _read_cache(ticker)
    if cached is not None:
        return cached

    info = await asyncio.to_thread(_fetch_yfinance, ticker)

    # A valid ticker always has at least a quoteType; empty info = unknown ticker
    if not info.get("quoteType"):
        raise ValueError(f"No data found for ticker '{ticker}'")

    _upsert_ticker_minimal(ticker, info)
    fund = _info_to_fundamentals(ticker, info)
    _write_cache(ticker, fund)
    return fund
