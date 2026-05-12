"""Public marketing endpoints (landing-page lead capture)."""

from __future__ import annotations

import logging
import time
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field

from core.config import get_settings
from services.lead_notification import send_lead_notification

logger = logging.getLogger(__name__)

router = APIRouter(tags=["marketing"])

_LEAD_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
_LEAD_RATE_LIMIT_MAX_REQUESTS = 8
_LEAD_SUBMISSIONS: dict[str, list[float]] = {}


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_lead_rate_limit(ip: str) -> None:
    now = time.time()
    window_start = now - _LEAD_RATE_LIMIT_WINDOW_SECONDS
    attempts = [timestamp for timestamp in _LEAD_SUBMISSIONS.get(ip, []) if timestamp >= window_start]
    _LEAD_SUBMISSIONS[ip] = attempts

    if len(attempts) >= _LEAD_RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many submissions. Please try again later.",
        )


def _record_lead_submission(ip: str) -> None:
    _LEAD_SUBMISSIONS.setdefault(ip, []).append(time.time())


class LeadSubmissionBody(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    restaurant: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    locale: Literal["he", "en"] = "he"


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def submit_lead(request: Request, body: LeadSubmissionBody) -> dict[str, Any]:
    settings = get_settings()
    client_ip = _client_ip(request)
    _enforce_lead_rate_limit(client_ip)

    if not settings.resend_api_key:
        logger.error("Lead submission blocked: RESEND_API_KEY is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lead capture is temporarily unavailable.",
        )

    try:
        send_lead_notification(
            settings,
            name=body.name,
            restaurant=body.restaurant,
            phone=body.phone,
            locale=body.locale,
        )
    except RuntimeError as exc:
        logger.exception("Lead notification failed for IP %s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We could not send your request right now. Please try again.",
        ) from exc

    _record_lead_submission(client_ip)
    return {"ok": True}
