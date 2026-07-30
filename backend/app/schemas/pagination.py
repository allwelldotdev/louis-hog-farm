from pydantic import BaseModel


class Page[T](BaseModel):
    """Envelope for every list endpoint.

    Offset-based rather than keyset: the dashboard renders numbered pages, and
    the row count is bounded by herd size rather than by an event firehose.
    Keyset would be the right call past a few hundred thousand rows — noting it
    here so the choice reads as deliberate rather than accidental.
    """

    items: list[T]
    total: int
    limit: int
    offset: int
