"""One-off verification: uploads land in the expected Cloudinary asset_folder."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Minimal 1x1 red PNG
_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
    "de0000000c4944415478da6364f8000000050001a5f6c4e80000000049454e44ae426082"
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

ENV_FILE = BACKEND_ROOT / ".env"


def load_dotenv() -> None:
    if not ENV_FILE.is_file():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def main() -> int:
    load_dotenv()
    for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
        if not os.getenv(key):
            print(f"SKIP: missing {key} in environment")
            return 0

    from services.image_service import delete_image, upload_image

    test_folder = "smartmenu/_asset_folder_test"
    url = upload_image(_TINY_PNG, folder=test_folder, content_type="image/png")
    print(f"uploaded: {url}")

    if f"/{test_folder}/" not in url:
        print(f"FAIL: public_id path missing '{test_folder}' in URL")
        delete_image(url)
        return 1

    import cloudinary.api

    from services.image_service import _extract_public_id

    public_id = _extract_public_id(url)
    if not public_id:
        print("FAIL: could not parse public_id from URL")
        return 1

    resource = cloudinary.api.resource(public_id, resource_type="image")
    asset_folder = resource.get("asset_folder") or ""
    print(f"public_id: {public_id}")
    print(f"asset_folder from API: {asset_folder!r}")

    if asset_folder != test_folder:
        print(f"FAIL: expected asset_folder {test_folder!r}, got {asset_folder!r}")
        delete_image(url)
        return 1

    deleted = delete_image(url)
    if not deleted:
        print("WARN: cleanup delete returned false")
    else:
        print("cleanup: deleted test asset")

    print("OK: asset_folder matches upload folder")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
