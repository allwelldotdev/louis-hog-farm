"""ETag / 304 revalidation for dashboard reads.

The dashboard polls. Every poll that finds unchanged data would otherwise pay
for a full recompute — the KPI endpoint alone runs six queries — and ship the
whole payload back over the wire. This turns that into a ~200-byte 304.

The validator is the farm's `data_versions` counter, not a hash of the response
body: the counter is a single primary-key lookup that the database maintains
through triggers, so a 304 costs one indexed read rather than the very work it
is meant to avoid. Any write to any table the dashboard reads bumps the counter,
which makes the ETag conservative — it can produce a needless 200, never a stale
304.

`Cache-Control: private, no-cache` is deliberate and is not "do not cache": it
tells the browser to store the response but revalidate before reuse, which is
exactly the intent. `private` keeps farm data out of shared caches.
"""

from hashlib import sha1
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.data_version import DataVersion

CACHE_CONTROL = "private, no-cache"


class NotModified(Exception):
    """Signals a matched `If-None-Match`. Control flow, not an error.

    Raised from a dependency, where returning a response is not an option, and
    converted into a bodyless 304 by the handler registered in `app.main`.
    """

    def __init__(self, etag: str) -> None:
        super().__init__(etag)
        self.etag = etag


def current_data_version(db: Session, farm_id: int) -> int:
    """The farm's change counter, or 0 for a farm with no row yet."""
    version = db.scalar(select(DataVersion.version).where(DataVersion.farm_id == farm_id))
    return int(version or 0)


def build_etag(version: int, request: Request) -> str:
    # Path as well as query string: without the path, two endpoints called with
    # the same parameters would share a validator.
    target = f"{request.url.path}?{request.url.query}"
    fingerprint = sha1(target.encode(), usedforsecurity=False).hexdigest()[:12]
    return f'W/"{version}-{fingerprint}"'


def dashboard_cache(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
) -> None:
    """Attach validators to the response, or short-circuit with a 304."""
    etag = build_etag(current_data_version(db, user.farm_id), request)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = CACHE_CONTROL
    if request.headers.get("if-none-match") == etag:
        raise NotModified(etag)


DashboardCache = Annotated[None, Depends(dashboard_cache)]
