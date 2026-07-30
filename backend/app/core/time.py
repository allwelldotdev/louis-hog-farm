"""Time helpers.

The codebase carries three distinct kinds of temporal data and they do not
share a rule:

* **System instants** (``created_at``, ``updated_at``, ``locked_until``) are
  timezone-aware UTC. Postgres ``timestamptz`` round-trips these correctly.
* **Business dates** (``record_date``, ``birth_date``, ``alert_date``) are naive
  ``date`` values. A weigh-in on a given day is a calendar fact with no instant
  and no offset; promoting it to a timestamp invents precision that was never
  recorded and creates off-by-one-day errors at range boundaries.
* **"Today"** is resolved in the farm's local timezone, not UTC — see
  ``farm_today`` below.
"""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def farm_today(timezone: str) -> date:
    """Today's date in a farm's local timezone.

    Takes the IANA string rather than the ``Farm`` model so that ``app.core``
    keeps no dependency on ``app.models``; every caller already has the farm in
    hand and passes ``farm.timezone``.

    This is the fix for a real rejection: for a farm at UTC+1, between 23:00 and
    midnight local the "record_date cannot be in the future" check compared a
    correct same-day entry against a UTC date that had not turned over yet, and
    refused it.

    An unrecognised zone falls back to UTC rather than raising. The column is
    ``NOT NULL DEFAULT 'UTC'`` and only a manual edit can put a bad value there;
    turning that into a 500 on every record write is a worse failure than
    resolving "today" an hour early.
    """
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("UTC")
    return datetime.now(zone).date()


def utc_now() -> datetime:
    """Current instant, timezone-aware, in UTC."""
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    """Normalise a datetime to aware UTC, assuming naive input is already UTC.

    Comparing a naive datetime against an aware one raises TypeError. That is
    what made a locked-out account return 500 on every authenticated request
    instead of 403, permanently, because the lockout expiry could never be
    evaluated (audit d). Postgres always hands back aware values, so this is now
    a guard rather than a workaround — but fixtures and direct SQL inserts can
    still produce naive values, and the cost of being certain is three lines.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
