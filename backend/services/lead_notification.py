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
    email: str,
    phone: str,
    locale: str,
) -> tuple[str, str, str]:
    phone_line_he = f"טלפון: {phone}\n" if phone.strip() else ""
    phone_line_en = f"Phone: {phone}\n" if phone.strip() else ""

    if locale == "he":
        subject = f"פנייה חדשה מ-{name} ({restaurant})"
        text = (
            "פנייה חדשה מהדף הנחיתה של Tafrito\n\n"
            f"שם: {name}\n"
            f"מסעדה: {restaurant}\n"
            f"אימייל: {email}\n"
            f"{phone_line_he}"
            f"שפה: {locale}\n"
        )
    else:
        subject = f"New lead from {name} ({restaurant})"
        text = (
            "New landing-page lead for Tafrito\n\n"
            f"Name: {name}\n"
            f"Restaurant: {restaurant}\n"
            f"Email: {email}\n"
            f"{phone_line_en}"
            f"Locale: {locale}\n"
        )

    phone_html = f"<br/>Phone: {phone}" if phone.strip() else ""
    html = (
        "<p><strong>New landing-page lead for Tafrito</strong></p>"
        f"<p>Name: {name}<br/>Restaurant: {restaurant}<br/>Email: {email}{phone_html}<br/>Locale: {locale}</p>"
    )
    return subject, text, html


def send_lead_notification(
    settings: Settings,
    *,
    name: str,
    restaurant: str,
    email: str,
    phone: str,
    locale: str,
) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("Lead email is not configured.")

    subject, text, html = _format_lead_email(
        name=name,
        restaurant=restaurant,
        email=email,
        phone=phone,
        locale=locale,
    )
    reply_to = (settings.lead_reply_to_email or "").strip() or email

    payload: dict[str, Any] = {
        "from": settings.lead_from_email,
        "to": [settings.lead_notification_email],
        "subject": subject,
        "text": text,
        "html": html,
        "reply_to": reply_to,
    }
    payload = {key: value for key, value in payload.items() if value is not None}

    request = urllib.request.Request(
        _RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            # Resend rejects requests without User-Agent (403, error code 1010).
            "User-Agent": "SmartMenu-Backend/1.0 (lead-notification)",
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
