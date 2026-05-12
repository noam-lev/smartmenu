from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from core.config import Settings

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"


def _format_lead_email(
    *,
    name: str,
    restaurant: str,
    phone: str,
    locale: str,
) -> tuple[str, str, str]:
    if locale == "he":
        subject = f"פנייה חדשה מ-{name} ({restaurant})"
        text = (
            "פנייה חדשה מהדף הנחיתה של Tafrito\n\n"
            f"שם: {name}\n"
            f"מסעדה: {restaurant}\n"
            f"טלפון: {phone}\n"
            f"שפה: {locale}\n"
        )
    else:
        subject = f"New lead from {name} ({restaurant})"
        text = (
            "New landing-page lead for Tafrito\n\n"
            f"Name: {name}\n"
            f"Restaurant: {restaurant}\n"
            f"Phone: {phone}\n"
            f"Locale: {locale}\n"
        )

    html = (
        "<p><strong>New landing-page lead for Tafrito</strong></p>"
        f"<p>Name: {name}<br/>Restaurant: {restaurant}<br/>Phone: {phone}<br/>Locale: {locale}</p>"
    )
    return subject, text, html


def send_lead_notification(
    settings: Settings,
    *,
    name: str,
    restaurant: str,
    phone: str,
    locale: str,
) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("Lead email is not configured.")

    subject, text, html = _format_lead_email(
        name=name,
        restaurant=restaurant,
        phone=phone,
        locale=locale,
    )
    payload: dict[str, Any] = {
        "from": settings.lead_from_email,
        "to": [settings.lead_notification_email],
        "subject": subject,
        "text": text,
        "html": html,
        "reply_to": settings.lead_reply_to_email or None,
    }
    payload = {key: value for key, value in payload.items() if value is not None}

    request = urllib.request.Request(
        _RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if response.status >= 400:
                body = response.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Resend returned {response.status}: {body}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.exception("Resend HTTP error while sending lead notification: %s", body)
        raise RuntimeError("Failed to send lead notification email.") from exc
    except urllib.error.URLError as exc:
        logger.exception("Resend network error while sending lead notification")
        raise RuntimeError("Failed to send lead notification email.") from exc
