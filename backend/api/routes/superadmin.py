from fastapi import APIRouter


router = APIRouter(tags=["superadmin"])


@router.get("/ping")
async def ping_superadmin() -> dict[str, str]:
    return {"status": "ok", "scope": "superadmin"}
