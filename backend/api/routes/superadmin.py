"""Superadmin HTTP routes (JWT Bearer auth via verify_superadmin)."""

from __future__ import annotations

import base64
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from api.dependencies import get_db, verify_superadmin
from db.repository import MenuRepository
from models.schemas import ParsedMenu, RestaurantImportPayload
from services.ai_service import parse_menu_image, parse_menu_images
from services.pdf_service import PdfConversionError, pdf_to_jpeg_pages

MAX_BATCH_PARSE_IMAGES = 7


def _is_pdf_upload(upload: UploadFile) -> bool:
    content_type = (upload.content_type or "").lower()
    if content_type == "application/pdf":
        return True
    filename = (upload.filename or "").lower()
    return filename.endswith(".pdf")

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


@router.post("/magic-parse-batch", response_model=ParsedMenu)
async def superadmin_magic_parse_batch(
    _user_id: str = Depends(verify_superadmin),
    files: list[UploadFile] = File(...),
) -> ParsedMenu:
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload one PDF or at least one image.",
        )

    pdf_uploads = [f for f in files if _is_pdf_upload(f)]
    image_uploads = [f for f in files if not _is_pdf_upload(f)]

    if pdf_uploads and image_uploads:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload either one PDF or up to 7 images, not both.",
        )
    if len(pdf_uploads) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only one PDF can be uploaded at a time.",
        )

    image_data_urls: list[str] = []

    if pdf_uploads:
        pdf_bytes = await pdf_uploads[0].read()
        try:
            jpeg_pages = pdf_to_jpeg_pages(
                pdf_bytes,
                max_pages=MAX_BATCH_PARSE_IMAGES,
            )
        except PdfConversionError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        for jpeg_bytes in jpeg_pages:
            base64_str = base64.b64encode(jpeg_bytes).decode("utf-8")
            image_data_urls.append(f"data:image/jpeg;base64,{base64_str}")
    else:
        if len(image_uploads) > MAX_BATCH_PARSE_IMAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {MAX_BATCH_PARSE_IMAGES} images allowed per batch.",
            )
        for upload in image_uploads:
            content_type = (upload.content_type or "").lower()
            if not content_type.startswith("image/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All uploaded files must be images or a single PDF.",
                )
            file_bytes = await upload.read()
            if not file_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One of the uploaded files is empty.",
                )
            base64_str = base64.b64encode(file_bytes).decode("utf-8")
            image_data_urls.append(f"data:{content_type};base64,{base64_str}")

    return await parse_menu_images(image_data_urls)


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
