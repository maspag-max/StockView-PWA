"""Web Push notification delivery via pywebpush."""
from __future__ import annotations

import base64
import json
import logging

from pywebpush import WebPushException, webpush

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_push_notification(
    subscription_info: dict,
    title: str,
    body: str,
    url: str = "/",
) -> bool:
    """Send a Web Push notification to a single subscription.

    Returns True on success, False if the subscription is expired (410 Gone)
    so the caller can remove it from the database.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        logger.warning("VAPID_PRIVATE_KEY not configured — skipping push")
        return False

    # VAPID_PRIVATE_KEY is stored as base64-encoded PEM
    private_key_pem = base64.b64decode(settings.vapid_private_key).decode("utf-8")

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": "/icon.svg",
    })

    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=private_key_pem,
            vapid_claims={"sub": settings.vapid_subject},
        )
        return True
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code == 410:
            logger.info(
                "Push subscription expired (410) — endpoint: %s",
                subscription_info.get("endpoint", ""),
            )
            return False
        logger.error("WebPush delivery failed: %s", exc)
        return False
    except Exception:
        logger.exception("Unexpected error sending push notification")
        return False
