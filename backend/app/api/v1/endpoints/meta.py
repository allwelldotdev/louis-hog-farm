from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.data_version import DataVersion
from app.schemas.meta import DataVersionResponse

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/data-version", response_model=DataVersionResponse)
def get_data_version(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
) -> DataVersionResponse:
    """The farm's change counter — one primary-key lookup, polled every ~20s.

    A row is created for every farm by the m4_005 trigger, so the miss below is
    a guard for a farm inserted while that trigger was disabled, not an expected
    path. Reporting version 0 is right in that case: the client then treats any
    later number as a change.
    """
    row = db.get(DataVersion, user.farm_id)
    if row is None:
        return DataVersionResponse(farm_id=user.farm_id, version=0, updated_at=None)
    return DataVersionResponse(farm_id=row.farm_id, version=row.version, updated_at=row.updated_at)
