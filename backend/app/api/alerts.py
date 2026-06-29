"""Alert CRUD endpoints — authenticated, per-user."""
from __future__ import annotations

import asyncio
import re
from typing import Any

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator, model_validator

from app.auth import get_current_user
from app.db import get_supabase
from app.services.meta import get_stock_meta

router = APIRouter()

_MAX_ALERTS = 100
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CONSECUTIVE_KINDS = {"consecutive_down_days", "consecutive_up_days"}
_ALL_KINDS = _CONSECUTIVE_KINDS | {"price_change_pct"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AlertCreate(BaseModel):
    symbol: str
    kind: str = "consecutive_down_days"
    days: int | None = None
    threshold_pct: float | None = None
    direction: str = "down"
    email: str
    active: bool = True

    @field_validator("symbol")
    @classmethod
    def normalise_symbol(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("symbol cannot be empty")
        return v

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        if v not in _ALL_KINDS:
            raise ValueError(f"kind must be one of {sorted(_ALL_KINDS)}")
        return v

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: int | None) -> int | None:
        if v is not None and not (2 <= v <= 10):
            raise ValueError("days must be between 2 and 10")
        return v

    @field_validator("threshold_pct")
    @classmethod
    def validate_threshold_pct(cls, v: float | None) -> float | None:
        if v is not None and not (1.0 <= v <= 50.0):
            raise ValueError("threshold_pct must be between 1.0 and 50.0")
        return v

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str) -> str:
        if v not in ("up", "down"):
            raise ValueError("direction must be 'up' or 'down'")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email address")
        return v

    @model_validator(mode="after")
    def validate_for_kind(self) -> "AlertCreate":
        if self.kind in _CONSECUTIVE_KINDS:
            if self.days is None:
                raise ValueError("days is required for consecutive alert kinds")
        elif self.kind == "price_change_pct":
            if self.threshold_pct is None:
                raise ValueError("threshold_pct is required for price_change_pct alerts")
        return self


class AlertPatch(BaseModel):
    active: bool | None = None
    days: int | None = None
    threshold_pct: float | None = None
    direction: str | None = None
    email: str | None = None

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: int | None) -> int | None:
        if v is not None and not (2 <= v <= 10):
            raise ValueError("days must be between 2 and 10")
        return v

    @field_validator("threshold_pct")
    @classmethod
    def validate_threshold_pct(cls, v: float | None) -> float | None:
        if v is not None and not (1.0 <= v <= 50.0):
            raise ValueError("threshold_pct must be between 1.0 and 50.0")
        return v

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str | None) -> str | None:
        if v is not None and v not in ("up", "down"):
            raise ValueError("direction must be 'up' or 'down'")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip().lower()
            if not _EMAIL_RE.match(v):
                raise ValueError("invalid email address")
        return v


class AlertOut(BaseModel):
    id: int
    symbol: str
    kind: str
    days: int | None
    threshold_pct: float | None
    ref_price: float | None
    direction: str | None
    email: str
    active: bool
    last_triggered: str | None
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_out(row: dict[str, Any]) -> AlertOut:
    config = row.get("config") or {}
    kind = row["kind"]
    return AlertOut(
        id=row["id"],
        symbol=row["symbol"],
        kind=kind,
        days=int(config["days"]) if "days" in config else None,
        threshold_pct=float(config["threshold_pct"]) if "threshold_pct" in config else None,
        ref_price=float(config["ref_price"]) if "ref_price" in config else None,
        direction=config.get("direction") if kind == "price_change_pct" else None,
        email=config.get("email", ""),
        active=row["active"],
        last_triggered=row.get("last_triggered"),
        created_at=row["created_at"],
    )


def _validate_ticker_yfinance(symbol: str) -> float:
    """Return last_price for symbol, or raise HTTP 422 if not found."""
    try:
        fast_info = yf.Ticker(symbol).fast_info
        last_price = getattr(fast_info, "last_price", None)
        if last_price is None or last_price <= 0:
            raise HTTPException(
                status_code=422,
                detail=f"Ticker '{symbol}' non trovato o non valido.",
            )
        return float(last_price)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Ticker '{symbol}' non trovato o non valido.",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[AlertOut])
async def get_alerts(user_id: str = Depends(get_current_user)) -> list[AlertOut]:
    db = get_supabase()
    rows = (
        db.table("alerts")
        .select("*")
        .eq("user_id", user_id)
        .in_("kind", list(_ALL_KINDS))
        .order("created_at", desc=False)
        .execute()
        .data
    )
    return [_row_to_out(r) for r in rows]


@router.post("", response_model=AlertOut, status_code=201)
async def create_alert(
    body: AlertCreate,
    user_id: str = Depends(get_current_user),
) -> AlertOut:
    db = get_supabase()

    count = (
        db.table("alerts")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .in_("kind", list(_ALL_KINDS))
        .execute()
        .count
    ) or 0
    if count >= _MAX_ALERTS:
        raise HTTPException(
            status_code=422,
            detail=f"Limite di {_MAX_ALERTS} alert raggiunto.",
        )

    last_price = await asyncio.to_thread(_validate_ticker_yfinance, body.symbol)

    try:
        await get_stock_meta(body.symbol)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Ticker '{body.symbol}' non trovato o non valido.",
        )

    if body.kind in _CONSECUTIVE_KINDS:
        config: dict[str, Any] = {"days": body.days, "email": body.email}
    else:
        config = {
            "threshold_pct": body.threshold_pct,
            "ref_price": last_price,
            "direction": body.direction,
            "email": body.email,
        }

    row = db.table("alerts").insert({
        "symbol": body.symbol,
        "kind": body.kind,
        "config": config,
        "active": body.active,
        "user_id": user_id,
    }).execute().data[0]

    return _row_to_out(row)


@router.patch("/{alert_id}", response_model=AlertOut)
async def update_alert(
    alert_id: int,
    body: AlertPatch,
    user_id: str = Depends(get_current_user),
) -> AlertOut:
    db = get_supabase()

    existing = (
        db.table("alerts")
        .select("*")
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .in_("kind", list(_ALL_KINDS))
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Alert non trovato.")

    current = existing[0]
    updates: dict[str, Any] = {}

    if body.active is not None:
        updates["active"] = body.active

    config_fields = {
        "days": body.days,
        "threshold_pct": body.threshold_pct,
        "direction": body.direction,
        "email": body.email,
    }
    if any(v is not None for v in config_fields.values()):
        config = dict(current.get("config") or {})
        for key, val in config_fields.items():
            if val is not None:
                config[key] = val
        updates["config"] = config

    if not updates:
        return _row_to_out(current)

    updated = db.table("alerts").update(updates).eq("id", alert_id).eq("user_id", user_id).execute().data[0]
    return _row_to_out(updated)


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: int,
    user_id: str = Depends(get_current_user),
) -> None:
    db = get_supabase()
    existing = (
        db.table("alerts")
        .select("id")
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .in_("kind", list(_ALL_KINDS))
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Alert non trovato.")
    db.table("alerts").delete().eq("id", alert_id).eq("user_id", user_id).execute()
