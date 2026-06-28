"""Auth endpoints for invite-code validation."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_supabase

router = APIRouter()


class InviteValidateRequest(BaseModel):
    code: str


class InviteValidateResponse(BaseModel):
    valid: bool


class InviteMarkUsedRequest(BaseModel):
    code: str
    user_id: str


@router.post("/validate-invite", response_model=InviteValidateResponse)
async def validate_invite(body: InviteValidateRequest) -> InviteValidateResponse:
    code = body.code.strip()
    if not code:
        return InviteValidateResponse(valid=False)

    db = get_supabase()
    rows = (
        db.table("invite_codes")
        .select("id")
        .eq("code", code)
        .eq("is_active", True)
        .is_("used_by", "null")
        .limit(1)
        .execute()
        .data
    )
    return InviteValidateResponse(valid=bool(rows))


@router.post("/mark-invite-used", status_code=204)
async def mark_invite_used(body: InviteMarkUsedRequest) -> None:
    code = body.code.strip()
    user_id = body.user_id.strip()
    if not code or not user_id:
        raise HTTPException(status_code=422, detail="code e user_id sono obbligatori.")

    db = get_supabase()
    rows = (
        db.table("invite_codes")
        .select("id")
        .eq("code", code)
        .eq("is_active", True)
        .is_("used_by", "null")
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Codice invito non trovato o già usato.")

    db.table("invite_codes").update({
        "used_by": user_id,
        "used_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", rows[0]["id"]).execute()
