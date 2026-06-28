"""StockView FastAPI entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, auth_router, exchange_rate, narrative, search, stocks, watchlist, thesis
from app.config import get_settings
from app.services.alert_checker import check_all_alerts

settings = get_settings()


def _parse_check_time(t: str) -> tuple[int, int]:
    """Parse 'HH:MM' into (hour, minute)."""
    parts = t.split(":")
    return int(parts[0]), int(parts[1])


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    scheduler = AsyncIOScheduler(timezone="Europe/Rome")
    hour, minute = _parse_check_time(settings.alert_check_time)
    scheduler.add_job(
        check_all_alerts,
        CronTrigger(hour=hour, minute=minute, timezone="Europe/Rome"),
    )
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="StockView API",
    version="0.1.0",
    description="Backend API for the StockView personal stock analysis webapp.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "env": settings.env}


app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["stocks"])
app.include_router(narrative.router, prefix="/api/stocks", tags=["narrative"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(thesis.router, prefix="/api/thesis", tags=["thesis"])
app.include_router(exchange_rate.router, prefix="/api", tags=["exchange-rate"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
