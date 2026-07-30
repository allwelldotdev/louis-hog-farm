from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db import readiness
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Migrations deliberately do NOT run here. With more than one worker every
    # worker races to migrate at boot; a one-shot `migrate` service in compose
    # (and `make migrate` locally) owns that instead.
    #
    # This connection check is allowed to raise. A worker that cannot reach its
    # database should exit and be restarted, not start up and serve 500s behind
    # a green health check.
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    yield
    engine.dispose()


app = FastAPI(
    title="Hog Farm Monitoring API",
    version="1.0.0",
    description="Hog Farm Monitoring & Management System — REST API",
    lifespan=lifespan,
)

# Wildcard origins combined with allow_credentials is rejected by browsers per
# the CORS spec, so the previous config was silently ineffective (audit m). The
# dashboard proxies server-side and never calls this API cross-origin; the list
# exists for direct /docs access.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Liveness. Claims only that the process is up, so it cannot lie about the DB."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def health_ready(response: Response) -> dict[str, str | None]:
    """Readiness. 503 unless the database answers and is at the expected migration."""
    result = readiness.check()
    if not result.ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if result.ready else "not_ready",
        "detail": result.detail,
        "current_revision": result.current_revision,
        "expected_revision": result.expected_revision,
    }
