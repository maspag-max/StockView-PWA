"""Watchlist endpoints — authenticated, per-user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.db import get_supabase
from app.models import WatchlistItem
from app.services.meta import get_stock_meta

router = APIRouter()


@router.get("", response_model=list[WatchlistItem])
async def get_watchlist(user_id: str = Depends(get_current_user)) -> list[WatchlistItem]:
    db = get_supabase()
    rows = (
        db.table("watchlist")
        .select("*")
        .eq("user_id", user_id)
        .order("added_at", desc=True)
        .execute()
        .data
    )
    return [WatchlistItem(**r) for r in rows]


@router.post("", response_model=WatchlistItem, status_code=201)
async def add_to_watchlist(
    body: dict,
    user_id: str = Depends(get_current_user),
) -> WatchlistItem:
    symbol = (body.get("symbol") or "").strip().upper()
    if not symbol:
        raise HTTPException(status_code=422, detail="symbol is required")

    try:
        await get_stock_meta(symbol)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Ticker '{symbol}' not found")

    db = get_supabase()
    existing = (
        db.table("watchlist")
        .select("symbol")
        .eq("symbol", symbol)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        row = (
            db.table("watchlist")
            .select("*")
            .eq("symbol", symbol)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data[0]
        )
        return WatchlistItem(**row)

    db.table("watchlist").insert({"symbol": symbol, "user_id": user_id}).execute()
    row = (
        db.table("watchlist")
        .select("*")
        .eq("symbol", symbol)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data[0]
    )
    return WatchlistItem(**row)


@router.delete("/{symbol}", status_code=204)
async def remove_from_watchlist(
    symbol: str,
    user_id: str = Depends(get_current_user),
) -> None:
    symbol = symbol.upper()
    db = get_supabase()
    existing = (
        db.table("watchlist")
        .select("symbol")
        .eq("symbol", symbol)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail=f"'{symbol}' not in watchlist")
    db.table("watchlist").delete().eq("symbol", symbol).eq("user_id", user_id).execute()
