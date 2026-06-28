"""Stock endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.models import Fundamentals, NewsItem, PricePoint, StockMeta
from app.services.fundamentals import get_fundamentals
from app.services.market_data import get_prices
from app.services.meta import get_stock_meta
from app.services.news import get_news

router = APIRouter()

_VALID_RANGES = {"1m", "3m", "6m", "1y", "3y", "5y", "max"}


@router.get("/{ticker}", response_model=StockMeta)
async def stock_meta(ticker: str) -> StockMeta:
    try:
        return await get_stock_meta(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{ticker}/prices", response_model=list[PricePoint])
async def stock_prices(
    ticker: str,
    range: Annotated[str, Query(description="1m 3m 6m 1y 3y 5y max")] = "3y",
) -> list[PricePoint]:
    if range not in _VALID_RANGES:
        raise HTTPException(status_code=400, detail=f"Invalid range '{range}'. Valid: {sorted(_VALID_RANGES)}")
    try:
        return await get_prices(ticker, range)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{ticker}/fundamentals", response_model=Fundamentals)
async def stock_fundamentals(ticker: str) -> Fundamentals:
    try:
        return await get_fundamentals(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{ticker}/news", response_model=list[NewsItem])
async def stock_news(
    ticker: str,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[NewsItem]:
    return await get_news(ticker, limit)
