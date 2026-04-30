from fastapi import APIRouter, Depends

from core.security import require_admin_context


router = APIRouter(tags=["owner"], dependencies=[Depends(require_admin_context)])


@router.get("/ping")
async def ping_owner() -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}
