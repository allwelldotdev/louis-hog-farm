from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.farm import Farm
from app.models.hog import Hog, HogStatus
from app.schemas.meta import FarmSummary

router = APIRouter(prefix="/farms", tags=["farms"])


@router.get("/me", response_model=FarmSummary)
def read_my_farm(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
) -> FarmSummary:
    """The signed-in user's farm.

    `currency_code` and `timezone` are here because the dashboard formats every
    money figure and every date against them; without this endpoint the client
    would have to hardcode both, which is how the currency ended up hardcoded
    in the first place.
    """
    farm = db.get(Farm, user.farm_id)
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    hog_count = (
        db.scalar(
            select(func.count(Hog.id)).where(Hog.farm_id == farm.id, Hog.status == HogStatus.active)
        )
        or 0
    )
    return FarmSummary(
        id=farm.id,
        name=farm.name,
        timezone=farm.timezone,
        currency_code=farm.currency_code,
        hog_count=int(hog_count),
        created_at=farm.created_at,
    )
