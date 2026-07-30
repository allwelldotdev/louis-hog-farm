from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.migrate import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    yield


app = FastAPI(
    title="Hog Farm Monitoring API",
    version="1.0.0",
    description="M0 API skeleton — AI-Based Hog Farm Monitoring & Management System",
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
