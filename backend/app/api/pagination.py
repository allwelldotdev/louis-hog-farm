from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.schemas.pagination import Page

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@dataclass(frozen=True)
class Pagination:
    limit: int
    offset: int


def pagination_params(
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


PageParams = Annotated[Pagination, Depends(pagination_params)]


def paginate[T: BaseModel](
    db: Session, stmt: Select[Any], params: Pagination, schema: type[T]
) -> Page[T]:
    """Run `stmt` windowed, plus a matching COUNT for the envelope's total.

    `order_by(None)` on the count: ordering inside a COUNT subquery is dead work,
    and Postgres rejects an ORDER BY over columns absent from the select list.
    """
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    rows = db.scalars(stmt.limit(params.limit).offset(params.offset)).all()
    return Page[schema](  # type: ignore[valid-type]
        items=[schema.model_validate(row) for row in rows],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )
