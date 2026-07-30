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
  ``utc_today`` below.
"""

from datetime import UTC, date, datetime


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


def utc_today() -> date:
    """Today's date in UTC.

    Deliberately a single choke point: "today" should be evaluated in the farm's
    local timezone, and a farm east or west of UTC will otherwise reject or
    mis-window same-day entries near midnight. The farm-local replacement
    arrives with the ``farms.timezone`` column; until then every caller shares
    this one definition rather than four copies.
    """
    return datetime.now(UTC).date()
