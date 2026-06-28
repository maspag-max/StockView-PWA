"""Investment thesis endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db import get_supabase
from app.models import InvestmentThesis
from app.services.meta import get_stock_meta

router = APIRouter()


@router.get("/{ticker}", response_model=InvestmentThesis)
async def get_thesis(ticker: str) -> InvestmentThesis:
    ticker = ticker.upper()
    db = get_supabase()
    rows = db.table("investment_thesis").select("*").eq("symbol", ticker).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail=f"No thesis for '{ticker}'")
    return InvestmentThesis(**rows[0])


@router.put("/{ticker}", response_model=InvestmentThesis)
async def save_thesis(ticker: str, body: InvestmentThesis) -> InvestmentThesis:
    ticker = ticker.upper()

    try:
        await get_stock_meta(ticker)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found")

    db = get_supabase()

    # Archive current version before overwriting
    existing = db.table("investment_thesis").select("*").eq("symbol", ticker).limit(1).execute().data
    if existing:
        old = existing[0]
        db.table("investment_thesis_history").insert({
            "symbol": ticker,
            "thesis": old["thesis"],
            "target_horizon": old.get("target_horizon"),
            "invalidation": old.get("invalidation"),
        }).execute()

    payload = {
        "symbol": ticker,
        "thesis": body.thesis,
        "target_horizon": body.target_horizon,
        "invalidation": body.invalidation,
    }
    db.table("investment_thesis").upsert(payload, on_conflict="symbol").execute()

    row = db.table("investment_thesis").select("*").eq("symbol", ticker).limit(1).execute().data[0]
    return InvestmentThesis(**row)
