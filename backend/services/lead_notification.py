from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from html import escape
from typing import Any

from core.config import Settings

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"
_USER_AGENT = "SmartMenu-Backend/1.0 (lead-notification)"


def _post_resend(settings: Settings, payload: dict[str, Any]) -> None:
    """Send one email via Resend. Raises RuntimeError on failure."""
    if not settings.resend_api_key:
        raise RuntimeError("Lead email is not configured.")

    payload = {key: value for key, value in payload.items() if value is not None}

    request = urllib.request.Request(
        _RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": _USER_AGENT,
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
        logger.exception("Resend HTTP error: %s", body)
        raise RuntimeError("Failed to send email via Resend.") from exc
    except urllib.error.URLError:
        logger.exception("Resend network error")
        raise RuntimeError("Failed to send email via Resend.") from exc


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

    phone_html = f"<br/>Phone: {escape(phone)}" if phone.strip() else ""
    html = (
        "<p><strong>New landing-page lead for Tafrito</strong></p>"
        f"<p>Name: {escape(name)}<br/>Restaurant: {escape(restaurant)}<br/>"
        f"Email: {escape(email)}{phone_html}<br/>Locale: {escape(locale)}</p>"
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
    subject, text, html = _format_lead_email(
        name=name,
        restaurant=restaurant,
        email=email,
        phone=phone,
        locale=locale,
    )
    reply_to = (settings.lead_reply_to_email or "").strip() or email

    _post_resend(
        settings,
        {
            "from": settings.lead_from_email,
            "to": [settings.lead_notification_email],
            "subject": subject,
            "text": text,
            "html": html,
            "reply_to": reply_to,
        },
    )


def _guest_first_name(name: str) -> str:
    parts = name.strip().split()
    return parts[0] if parts else name.strip()


def _welcome_email_he(*, guest_name: str, site_url: str) -> tuple[str, str, str]:
    subject = "ברוכים הבאים ל-Tafrito! 🥗"
    safe = escape(guest_name)
    text = (
        f"היי {guest_name},\n\n"
        "כאן נעם מ-Tafrito. איזה כיף שהשארתם פרטים — תודה על האמון.\n\n"
        "נחזור אליכם בקרוב עם המשך ועם כל מה שצריך כדי להתחיל בנוחות.\n\n"
        f"בינתיים אפשר לבקר אצלנו באתר: {site_url}\n\n"
        "בברכה,\nנעם\nTafrito\n"
    )
    link = escape(site_url)
    html = f"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body {{
      margin: 0;
      padding: 32px 24px;
      background: #F5F2EB;
      color: #3E2723;
      font-family: 'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 17px;
      line-height: 1.55;
      letter-spacing: -0.01em;
    }}
    .card {{
      max-width: 520px;
      margin: 0 auto;
      background: #FFFDF8;
      border: 1px solid #D7CCC8;
      border-radius: 4px;
      padding: 28px 32px;
      box-shadow: 0 12px 40px rgba(62, 39, 35, 0.08);
    }}
    h1 {{
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0 0 20px;
      color: #3E2723;
    }}
    p {{ margin: 0 0 16px; }}
    a {{
      color: #2E7D32;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 3px;
    }}
    .signoff {{ margin-top: 28px; color: #5D4037; font-size: 0.95rem; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>ברוכים הבאים ל-Tafrito</h1>
    <p>היי {safe},</p>
    <p>כאן נעם מ-Tafrito. איזה כיף שהשארתם פרטים — תודה על האמון.</p>
    <p>נחזור אליכם בקרוב עם המשך ועם כל מה שצריך כדי להתחיל בנוחות.</p>
    <p>בינתיים אפשר לבקר אצלנו <a href="{link}">באתר</a>.</p>
    <p class="signoff">בברכה,<br/>נעם<br/>Tafrito</p>
  </div>
</body>
</html>"""
    return subject, text, html


def _welcome_email_en(*, guest_name: str, site_url: str) -> tuple[str, str, str]:
    subject = "Welcome to Tafrito! 🥗"
    safe = escape(guest_name)
    text = (
        f"Hi {guest_name},\n\n"
        "This is Noam from Tafrito. Thanks so much for leaving your details — we really appreciate it.\n\n"
        "We’ll be in touch shortly with next steps and anything you need to get started smoothly.\n\n"
        f"In the meantime, you can visit our site: {site_url}\n\n"
        "Warmly,\nNoam\nTafrito\n"
    )
    link = escape(site_url)
    html = f"""<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body {{
      margin: 0;
      padding: 32px 24px;
      background: #F5F2EB;
      color: #3E2723;
      font-family: 'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 17px;
      line-height: 1.55;
      letter-spacing: -0.01em;
    }}
    .card {{
      max-width: 520px;
      margin: 0 auto;
      background: #FFFDF8;
      border: 1px solid #D7CCC8;
      border-radius: 4px;
      padding: 28px 32px;
      box-shadow: 0 12px 40px rgba(62, 39, 35, 0.08);
    }}
    h1 {{
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0 0 20px;
      color: #3E2723;
    }}
    p {{ margin: 0 0 16px; }}
    a {{
      color: #2E7D32;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 3px;
    }}
    .signoff {{ margin-top: 28px; color: #5D4037; font-size: 0.95rem; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome to Tafrito</h1>
    <p>Hi {safe},</p>
    <p>This is Noam from Tafrito. Thanks so much for leaving your details — we really appreciate it.</p>
    <p>We’ll be in touch shortly with next steps and anything you need to get started smoothly.</p>
    <p>In the meantime, you can <a href="{link}">visit our website</a>.</p>
    <p class="signoff">Warmly,<br/>Noam<br/>Tafrito</p>
  </div>
</body>
</html>"""
    return subject, text, html


def send_welcome_email_safe(
    settings: Settings,
    *,
    to_email: str,
    name: str,
    locale: str,
) -> None:
    """
    Send welcome email to the lead. Failures are logged only — does not raise.
    """
    if not settings.resend_api_key:
        logger.warning("Welcome email skipped: RESEND_API_KEY is not configured.")
        return

    site_url = settings.lead_site_url.rstrip("/") or "https://tafrito.com"
    guest = _guest_first_name(name)

    try:
        if locale == "he":
            subject, text, html = _welcome_email_he(guest_name=guest, site_url=site_url)
        else:
            subject, text, html = _welcome_email_en(guest_name=guest, site_url=site_url)

        _post_resend(
            settings,
            {
                "from": settings.lead_from_email,
                "to": [to_email],
                "subject": subject,
                "text": text,
                "html": html,
            },
        )
        logger.info("Welcome email sent to %s", to_email)
    except Exception:
        logger.exception("Welcome email failed for recipient=%s (lead flow continues)", to_email)
