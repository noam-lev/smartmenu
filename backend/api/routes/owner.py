from fastapi import APIRouter


router = APIRouter(tags=["owner"])


@router.get("/ping")
async def ping_owner() -> dict[str, str]:
    return {"status": "ok", "scope": "owner"}
