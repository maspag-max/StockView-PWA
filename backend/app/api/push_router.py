"""Web Push subscription endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user
from app.config import get_settings
from app.db import get_supabase

router = APIRouter()


class SubscribeRequest(BaseModel):
    subscription: dict


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
def get_vapid_public_key() -> dict[str, str]:
    """Public endpoint — returns the VAPID public key for the frontend."""
    return {"publicKey": get_settings().vapid_public_key}


@router.post("/subscribe", status_code=201)
async def subscribe(
    body: SubscribeRequest,
    user_id: str = Depends(get_current_user),
) -> dict[str, bool]:
    """Save (or refresh) a push subscription for the authenticated user."""
    db = get_supabase()
    endpoint: str = body.subscription.get("endpoint", "")

    existing = (
        db.table("push_subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .eq("endpoint", endpoint)
        .limit(1)
        .execute()
        .data
    )

    if existing:
        db.table("push_subscriptions").update(
            {"subscription": body.subscription}
        ).eq("id", existing[0]["id"]).execute()
    else:
        db.table("push_subscriptions").insert(
            {"user_id": user_id, "subscription": body.subscription}
        ).execute()

    return {"ok": True}


@router.delete("/unsubscribe", status_code=204)
async def unsubscribe(
    body: UnsubscribeRequest,
    user_id: str = Depends(get_current_user),
) -> None:
    """Remove a push subscription for the authenticated user."""
    db = get_supabase()
    db.table("push_subscriptions").delete().eq("user_id", user_id).eq(
        "endpoint", body.endpoint
    ).execute()
