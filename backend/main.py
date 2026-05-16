from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import diner, marketing, owner, superadmin
from core.config import get_settings
from core.exceptions import CustomHTTPException


settings = get_settings()

UVICORN_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "fmt": "%(asctime)s | %(levelprefix)s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
            "use_colors": None,
        },
        "access": {
            "fmt": "%(asctime)s | %(levelprefix)s | %(client_addr)s - \"%(request_line)s\" %(status_code)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
            "use_colors": None,
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
    },
}

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(CustomHTTPException)
async def custom_http_exception_handler(
    _request: Request,
    exc: CustomHTTPException,
) -> JSONResponse:
    content: dict[str, str] = {"detail": exc.message}
    code = getattr(exc, "code", None)
    if isinstance(code, str) and code:
        content["code"] = code
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request,
    _exc: Exception,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


app.include_router(diner.router, prefix="/api/diner")
app.include_router(marketing.router, prefix="/api/marketing")
app.include_router(owner.router, prefix="/api/owner")
app.include_router(superadmin.router, prefix="/api/superadmin")


def main() -> None:
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=UVICORN_LOG_CONFIG,
    )


if __name__ == "__main__":
    main()
