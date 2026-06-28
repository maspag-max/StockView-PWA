"""Search endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.models import SearchResult
from app.services.search import search_symbols

router = APIRouter()


@router.get("/search", response_model=list[SearchResult])
async def search(q: str = Query(default="")) -> list[SearchResult]:
    return await search_symbols(q)
