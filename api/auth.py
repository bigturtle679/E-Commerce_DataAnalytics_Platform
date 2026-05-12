"""API key authentication middleware.

Validates X-API-Key header against the configured API_KEY.
If API_KEY is empty (default), auth is disabled for local dev convenience.
"""

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from api.config import API_KEY

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Routes that never require authentication
PUBLIC_PATHS = frozenset(
    {
        "/",
        "/api/health/ping",
        "/metrics",
        "/docs",
        "/openapi.json",
        "/redoc",
    }
)


async def verify_api_key(
    request: Request,
    api_key: str | None = Security(_api_key_header),
) -> None:
    """FastAPI dependency that enforces API key auth on protected routes.

    - If API_KEY is empty → auth disabled (dev mode)
    - If path is in PUBLIC_PATHS → skip auth
    - Otherwise → require valid X-API-Key header
    """
    # Auth disabled when no key configured
    if not API_KEY:
        return

    # Public routes bypass auth
    if request.url.path in PUBLIC_PATHS:
        return

    if not api_key or api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
