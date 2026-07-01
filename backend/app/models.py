"""Pydantic models for API I/O and LLM output validation."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, conlist

Confidence = Literal["low", "medium", "high"]
ValuationVerdict = Literal["sottovalutato", "fair_value", "sopravvalutato", "indeterminato"]


# ---------------------------------------------------------------------------
# Narrative output (validates what the LLM returns)
# ---------------------------------------------------------------------------
class BusinessSummary(BaseModel):
    text: str = Field(..., min_length=80)
    confidence: Confidence
    sources: list[str] = Field(default_factory=list)


class GrowthOutlook(BaseModel):
    text: str = Field(..., min_length=80)
    drivers: conlist(str, min_length=2, max_length=6)  # type: ignore[valid-type]
    risks: conlist(str, min_length=2, max_length=6)  # type: ignore[valid-type]
    confidence: Confidence


class MarketOutlook(BaseModel):
    text: str = Field(..., min_length=80)
    analyst_consensus_summary: str
    valuation_assessment: ValuationVerdict
    confidence: Confidence


class Narrative(BaseModel):
    business_summary: BusinessSummary
    growth_outlook: GrowthOutlook
    strengths: conlist(str, min_length=3, max_length=6)  # type: ignore[valid-type]
    weaknesses: conlist(str, min_length=3, max_length=6)  # type: ignore[valid-type]
    opportunities: conlist(str, min_length=2, max_length=5)  # type: ignore[valid-type]
    threats: conlist(str, min_length=2, max_length=5)  # type: ignore[valid-type]
    market_outlook: MarketOutlook
    confidence_overall: Confidence
    data_caveats: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
class SearchResult(BaseModel):
    symbol: str
    description: str
    type: str | None = None


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------
class PricePoint(BaseModel):
    date: str  # ISO YYYY-MM-DD
    open: float
    high: float
    low: float
    close: float
    adj_close: float | None = None
    volume: int | None = None


class StockMeta(BaseModel):
    symbol: str
    name: str
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None
    country: str | None = None
    currency: str | None = None
    isin: str | None = None


# ---------------------------------------------------------------------------
# Fundamentals
# ---------------------------------------------------------------------------
class Fundamentals(BaseModel):
    symbol: str
    # Valuation
    market_cap: int | None = None
    pe_trailing: float | None = None
    pe_forward: float | None = None
    price_to_book: float | None = None
    ev_to_ebitda: float | None = None
    price_to_sales: float | None = None
    peg_ratio: float | None = None
    eps_trailing: float | None = None
    eps_forward: float | None = None
    # Profitability
    roe: float | None = None
    roa: float | None = None
    profit_margin: float | None = None
    gross_margin: float | None = None
    operating_margin: float | None = None
    ebitda_margin: float | None = None
    # Growth (YoY)
    revenue_growth: float | None = None
    earnings_growth: float | None = None
    # Financial health
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    quick_ratio: float | None = None
    # Dividends
    dividend_yield: float | None = None
    payout_ratio: float | None = None
    # Market
    beta: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    total_revenue: int | None = None
    free_cashflow: int | None = None
    shares_outstanding: int | None = None
    fetched_at: str  # ISO datetime


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------
class NewsItem(BaseModel):
    finnhub_id: int
    symbol: str
    headline: str
    url: str
    source: str | None = None
    published_at: str  # ISO datetime
    summary: str | None = None
    image: str | None = None
    sentiment: float | None = None


# ---------------------------------------------------------------------------
# Watchlist / thesis
# ---------------------------------------------------------------------------
class WatchlistItem(BaseModel):
    symbol: str
    added_at: datetime
    notes: str | None = None


class InvestmentThesis(BaseModel):
    symbol: str
    thesis: str = Field(..., min_length=10, max_length=2000)
    target_horizon: Literal["short", "mid", "long"] | None = None
    invalidation: str | None = None
    updated_at: datetime | None = None
