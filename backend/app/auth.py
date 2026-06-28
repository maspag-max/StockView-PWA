"""JWT authentication via Supabase."""
from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import get_supabase

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Validate a Supabase JWT and return the user_id (uuid as str)."""
    token = credentials.credentials
    db = get_supabase()
    try:
        response = db.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=401, detail="Token non valido o scaduto.")
        return str(response.user.id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto.")
