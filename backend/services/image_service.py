"""Centralized image upload/delete service backed by Cloudinary."""

from __future__ import annotations

import logging
import os
import uuid

import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

_configured = False


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]):
        raise RuntimeError(
            "Missing Cloudinary configuration. "
            "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
        )

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )
    _configured = True


def upload_image(
    file_bytes: bytes,
    *,
    folder: str,
    content_type: str = "image/jpeg",
) -> str:
    """Upload image bytes to Cloudinary and return the public HTTPS URL.

    Args:
        file_bytes: Raw image bytes.
        folder: Logical folder path (e.g. ``smartmenu/my-restaurant``).
        content_type: MIME type hint for Cloudinary.

    Returns:
        The ``secure_url`` string from Cloudinary.
    """
    _ensure_configured()

    # public_id path is used in delivery URLs and owner delete scoping.
    # asset_folder places the asset in the Media Library tree (dynamic folder mode).
    public_id = f"{folder}/{uuid.uuid4()}"

    result = cloudinary.uploader.upload(
        file_bytes,
        public_id=public_id,
        asset_folder=folder,
        resource_type="image",
        overwrite=False,
    )

    url = result.get("secure_url")
    if not url:
        raise RuntimeError("Cloudinary upload succeeded but returned no secure_url.")

    logger.info("Image uploaded: %s", url)
    return str(url)


def delete_image(public_url: str) -> bool:
    """Delete an image from Cloudinary by its public URL.

    Extracts the ``public_id`` from the URL path and calls destroy.

    Returns:
        True if Cloudinary acknowledged the deletion, False otherwise.
    """
    _ensure_configured()

    public_id = _extract_public_id(public_url)
    if not public_id:
        logger.warning("Could not extract public_id from URL: %s", public_url)
        return False

    result = cloudinary.uploader.destroy(public_id, resource_type="image")
    ok = result.get("result") == "ok"
    if ok:
        logger.info("Image deleted: %s", public_id)
    else:
        logger.warning("Cloudinary destroy returned: %s for %s", result, public_id)
    return ok


def _extract_public_id(url: str) -> str | None:
    """Extract the Cloudinary public_id from a secure_url.

    Cloudinary URLs follow the pattern:
        https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}

    We need to strip the version prefix and file extension.
    """
    from urllib.parse import urlparse

    parsed = urlparse(url)
    path = parsed.path  # e.g. /image/upload/v1234567890/smartmenu/slug/abc.jpg

    upload_marker = "/image/upload/"
    idx = path.find(upload_marker)
    if idx == -1:
        return None

    after_upload = path[idx + len(upload_marker) :]

    # Strip version prefix (v1234567890/)
    if after_upload.startswith("v") and "/" in after_upload:
        first_slash = after_upload.index("/")
        version_candidate = after_upload[1:first_slash]
        if version_candidate.isdigit():
            after_upload = after_upload[first_slash + 1 :]

    # Strip file extension
    dot_idx = after_upload.rfind(".")
    if dot_idx != -1:
        after_upload = after_upload[:dot_idx]

    return after_upload or None
