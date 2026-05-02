from fastapi import HTTPException, status


def require_admin_context() -> None:
    """Placeholder for future owner/admin auth checks."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Authentication is not implemented yet.",
    )
