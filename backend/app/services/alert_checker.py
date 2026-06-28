"""Nightly job: checks all active alerts and fires emails."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

import pandas as pd
import yfinance as yf

from app.db import get_supabase
from app.services.email_service import send_alert_email

logger = logging.getLogger(__name__)

_CONSECUTIVE_KINDS = {"consecutive_down_days", "consecutive_up_days"}
_ALL_KINDS = _CONSECUTIVE_KINDS | {"price_change_pct"}


async def check_all_alerts() -> None:
    """Entry point called by APScheduler every evening at 18:30 Europe/Rome."""
    logger.info("Alert check started")
    db = get_supabase()

    result = (
        db.table("alerts")
        .select("id, symbol, kind, config, last_triggered")
        .eq("active", True)
        .in_("kind", list(_ALL_KINDS))
        .execute()
    )
    alerts = result.data or []
    logger.info("Found %d active alert(s)", len(alerts))

    today = date.today()

    for alert in alerts:
        symbol: str = alert["symbol"]
        kind: str = alert["kind"]
        config: dict = alert["config"]
        email: str = config.get("email", "")
        last_triggered_raw: str | None = alert.get("last_triggered")

        try:
            if kind in _CONSECUTIVE_KINDS:
                days = int(config.get("days", 3))
                _process_consecutive_alert(
                    db, alert["id"], symbol, kind, days, email, today, last_triggered_raw
                )
            elif kind == "price_change_pct":
                threshold_pct = float(config.get("threshold_pct", 5.0))
                ref_price = float(config.get("ref_price", 0.0))
                direction = config.get("direction", "down")
                _process_pct_alert(
                    db, alert["id"], symbol, threshold_pct, ref_price, direction, email, today, last_triggered_raw
                )
        except Exception:
            logger.exception("Error processing alert id=%s symbol=%s", alert["id"], symbol)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _already_triggered_today(last_triggered_raw: str | None, today: date) -> bool:
    if not last_triggered_raw:
        return False
    return pd.Timestamp(last_triggered_raw).date() == today


def _fetch_prices(symbol: str) -> pd.DataFrame | None:
    """Download recent daily closes. Returns DataFrame with [date, close] sorted oldest→newest."""
    try:
        raw = yf.download(symbol, period="60d", interval="1d", progress=False, auto_adjust=True)
        if raw.empty:
            return None

        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)

        df = raw[["Close"]].copy()
        df.columns = ["close"]
        df.index.name = "date"
        df = df.reset_index()
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        df = df.dropna(subset=["close"]).reset_index(drop=True)
        return df
    except Exception:
        logger.exception("yfinance download failed for %s", symbol)
        return None


def _mark_triggered(db, alert_id: int) -> None:
    now_utc = datetime.now(timezone.utc).isoformat()
    db.table("alerts").update({"last_triggered": now_utc}).eq("id", alert_id).execute()


# ---------------------------------------------------------------------------
# Consecutive days processor
# ---------------------------------------------------------------------------

def _process_consecutive_alert(
    db,
    alert_id: int,
    symbol: str,
    kind: str,
    days: int,
    email: str,
    today: date,
    last_triggered_raw: str | None,
) -> None:
    if _already_triggered_today(last_triggered_raw, today):
        logger.debug("Alert %s already triggered today — skipping", alert_id)
        return

    prices = _fetch_prices(symbol)
    if prices is None or len(prices) < days + 1:
        logger.warning("Not enough price data for %s (need %d rows)", symbol, days + 1)
        return

    tail = prices.tail(days + 1).reset_index(drop=True)

    if kind == "consecutive_up_days":
        condition_met = all(
            tail.loc[i, "close"] > tail.loc[i - 1, "close"] for i in range(1, days + 1)
        )
    else:
        condition_met = all(
            tail.loc[i, "close"] < tail.loc[i - 1, "close"] for i in range(1, days + 1)
        )

    if not condition_met:
        logger.debug("%s: condition not met (kind=%s, days=%d)", symbol, kind, days)
        return

    logger.info("%s: condition met (kind=%s, %d days) — sending alert", symbol, kind, days)
    send_alert_email(symbol, kind, days, email, tail)
    _mark_triggered(db, alert_id)


# ---------------------------------------------------------------------------
# Price change % processor
# ---------------------------------------------------------------------------

def _process_pct_alert(
    db,
    alert_id: int,
    symbol: str,
    threshold_pct: float,
    ref_price: float,
    direction: str,
    email: str,
    today: date,
    last_triggered_raw: str | None,
) -> None:
    if _already_triggered_today(last_triggered_raw, today):
        logger.debug("Alert %s already triggered today — skipping", alert_id)
        return

    if ref_price <= 0:
        logger.warning("Alert %s has invalid ref_price=%s — skipping", alert_id, ref_price)
        return

    prices = _fetch_prices(symbol)
    if prices is None or prices.empty:
        logger.warning("No price data for %s", symbol)
        return

    current_price = float(prices.iloc[-1]["close"])
    change_pct = ((current_price - ref_price) / ref_price) * 100.0

    if direction == "up" and change_pct < threshold_pct:
        logger.debug(
            "%s: change %.2f%% below up-threshold +%.2f%% — skipping",
            symbol, change_pct, threshold_pct,
        )
        return
    if direction == "down" and change_pct > -threshold_pct:
        logger.debug(
            "%s: change %.2f%% above down-threshold -%.2f%% — skipping",
            symbol, change_pct, threshold_pct,
        )
        return

    logger.info(
        "%s: change %.2f%% meets threshold (direction=%s, ±%.2f%%) — sending alert",
        symbol, change_pct, direction, threshold_pct,
    )
    send_alert_email(
        symbol,
        "price_change_pct",
        None,
        email,
        prices.tail(1),
        extra={
            "ref_price": ref_price,
            "current_price": current_price,
            "change_pct": change_pct,
            "threshold_pct": threshold_pct,
            "direction": direction,
        },
    )
    _mark_triggered(db, alert_id)
