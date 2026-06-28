"""Narrative endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import Narrative
from app.services.narrative import NarrativeService

router = APIRouter()
_svc = NarrativeService()


@router.get("/{ticker}/narrative", response_model=Narrative)
async def get_narrative(ticker: str) -> Narrative:
    """Return AI narrative for *ticker*, served from 24h cache when available."""
    try:
        narrative, _ = await _svc.generate(ticker)
        return narrative
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Narrative generation failed: {exc}") from exc


@router.post("/{ticker}/narrative/refresh", response_model=Narrative)
async def refresh_narrative(ticker: str) -> Narrative:
    """Force re-generation of the narrative, bypassing cache."""
    try:
        narrative, _ = await _svc.generate(ticker, force_refresh=True)
        return narrative
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Narrative generation failed: {exc}") from exc
