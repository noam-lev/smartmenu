"""Superadmin HTTP routes (Secure MVP in-memory auth)."""

from __future__ import annotations

import logging
import os
import secrets
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["superadmin"])

# WARNING: Secure MVP In-memory store. Not for multi-worker scaling.
ACTIVE_TOKENS: dict[str, dict[str, Any]] = {}  # format: { token: {"exp": float, "ip": str} }
# WARNING: Secure MVP In-memory store. Not for multi-worker scaling.
FAILED_ATTEMPTS: dict[str, dict[str, Any]] = {}  # format: { ip: {"count": int, "lockout_until": float} }

_LOCKOUT_SECONDS = 15 * 60
_MAX_FAILURES = 5
_TOKEN_TTL_SECONDS = 12 * 3600


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_rate_limit(ip: str) -> None:
    rec = FAILED_ATTEMPTS.get(ip)
    if not rec:
        return
    lockout_until = float(rec.get("lockout_until") or 0.0)
    if lockout_until > time.time():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
        )
    # Lockout expired — reset so the IP can try again (Secure MVP).
    rec["count"] = 0
    rec["lockout_until"] = 0.0


def _record_login_failure(ip: str) -> None:
    rec = FAILED_ATTEMPTS.setdefault(ip, {"count": 0, "lockout_until": 0.0})
    rec["count"] = int(rec.get("count") or 0) + 1
    if rec["count"] >= _MAX_FAILURES:
        rec["lockout_until"] = time.time() + _LOCKOUT_SECONDS


def _clear_login_failures(ip: str) -> None:
    FAILED_ATTEMPTS.pop(ip, None)


class SuperadminLoginBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    password: str


async def verify_superadmin_token(
    request: Request,
    x_superadmin_token: str = Header(..., alias="X-Superadmin-Token"),
) -> dict[str, Any]:
    """Validate session token (lazy expiry + IP binding). Secure MVP."""
    if x_superadmin_token not in ACTIVE_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    data = ACTIVE_TOKENS[x_superadmin_token]
    if time.time() > float(data["exp"]):
        ACTIVE_TOKENS.pop(x_superadmin_token, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    token_ip = str(data.get("ip") or "")
    current_ip = _client_ip(request)
    if token_ip != current_ip:
        logger.critical(
            "Superadmin token theft attempt: token IP %r != request IP %r",
            token_ip,
            current_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    return data


@router.post("/login")
async def superadmin_login(request: Request, body: SuperadminLoginBody) -> dict[str, str]:
    ip = _client_ip(request)
    _enforce_rate_limit(ip)

    admin_pass = os.getenv("SUPERADMIN_PASSWORD")
    if not admin_pass:
        raise Exception("SUPERADMIN_PASSWORD env var is not set")

    if body.password != admin_pass:
        _record_login_failure(ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    _clear_login_failures(ip)
    token = secrets.token_hex(32)
    ACTIVE_TOKENS[token] = {"exp": time.time() + _TOKEN_TTL_SECONDS, "ip": ip}
    logger.info("Superadmin login successful from IP %s", ip)
    return {"token": token}


@router.post("/logout")
async def superadmin_logout(
    request: Request,
    x_superadmin_token: str = Header(..., alias="X-Superadmin-Token"),
) -> dict[str, bool]:
    ip = _client_ip(request)
    if x_superadmin_token in ACTIVE_TOKENS:
        ACTIVE_TOKENS.pop(x_superadmin_token, None)
        logger.info("Superadmin logout from IP %s", ip)
    else:
        logger.info("Superadmin logout (unknown token) from IP %s", ip)
    return {"ok": True}


@router.get("/ping")
async def ping_superadmin(_session: dict[str, Any] = Depends(verify_superadmin_token)) -> dict[str, str]:
    return {"status": "ok", "scope": "superadmin"}
