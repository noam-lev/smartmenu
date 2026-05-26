"""Superadmin HTTP routes (JWT Bearer auth via verify_superadmin)."""

from __future__ import annotations

import base64
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from api.dependencies import get_db, verify_superadmin
from db.repository import MenuRepository
from models.schemas import ParsedMenu, RestaurantImportPayload
from services.ai_service import parse_menu_image

logger = logging.getLogger(__name__)

router = APIRouter(tags=["superadmin"])


@router.get("/ping")
async def ping_superadmin(
    _user_id: str = Depends(verify_superadmin),
) -> dict[str, str]:
    return {"status": "ok", "scope": "superadmin"}


@router.post("/magic-parse", response_model=ParsedMenu)
async def superadmin_magic_parse(
    _user_id: str = Depends(verify_superadmin),
    file: UploadFile = File(...),
) -> ParsedMenu:
    content_type = file.content_type or "application/octet-stream"
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    base64_str = base64.b64encode(file_bytes).decode("utf-8")
    image_data_url = f"data:{content_type};base64,{base64_str}"
    return await parse_menu_image(image_data_url)


@router.post("/restaurants/import")
async def superadmin_import_restaurant(
    payload: RestaurantImportPayload,
    _user_id: str = Depends(verify_superadmin),
    db: MenuRepository = Depends(get_db),
) -> dict[str, Any]:
    try:
        result = await db.import_full_restaurant(payload.model_dump())
        return {
            "success": True,
            "message": "Restaurant imported successfully.",
            **result,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
