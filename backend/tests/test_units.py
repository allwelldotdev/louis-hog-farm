"""Pure tests. No database, so these always run."""

import random
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from app.core.time import as_utc, farm_today, utc_now
from app.models.hog import ProductionClass
from app.seed import generators as gen
from app.services.dashboard_metrics import HogWeightEndpoints, compute_adg_rows
from app.services.dashboard_series import compute_bucket_gains

# The widest real offsets in the IANA database: +14:00 and -11:00. Between them
# the calendar date always differs by at most one day, which is what the
# assertions below pin down without depending on when the suite runs.
EAST_OF_UTC = "Pacific/Kiritimati"
WEST_OF_UTC = "Pacific/Niue"


def _endpoints(first_kg: str, last_kg: str, span_days: int, hog_id: int = 1) -> HogWeightEndpoints:
    start = date(2026, 1, 1)
    return HogWeightEndpoints(
        hog_id=hog_id,
        tag_number=f"T-{hog_id}",
        breed="Large White",
        production_class=ProductionClass.grower,
        first_date=start,
        first_weight_kg=Decimal(first_kg),
        last_date=start + timedelta(days=span_days),
        last_weight_kg=Decimal(last_kg),
    )


class TestComputeAdg:
    def test_positive_gain(self) -> None:
        (row,) = compute_adg_rows([_endpoints("50.0", "80.0", 30)])
        assert row.weight_gain_kg == 30.0
        assert row.adg_kg_per_day == 1.0
        assert row.days == 30

    def test_weight_loss_yields_negative_adg(self) -> None:
        (row,) = compute_adg_rows([_endpoints("80.0", "50.0", 30)])
        assert row.adg_kg_per_day < 0

    def test_zero_day_span_is_skipped_not_divided_by_zero(self) -> None:
        # A hog weighed once, or several times on one day, has no measurable
        # rate. Returning 0 would be a fabricated value.
        assert compute_adg_rows([_endpoints("50.0", "55.0", 0)]) == []

    def test_empty_input(self) -> None:
        assert compute_adg_rows([]) == []

    def test_each_hog_produces_one_row(self) -> None:
        rows = compute_adg_rows([_endpoints("50.0", "80.0", 30, hog_id=i) for i in range(1, 6)])
        assert len(rows) == 5
        assert {r.hog_id for r in rows} == {1, 2, 3, 4, 5}


class TestTimeHelpers:
    def test_as_utc_attaches_tz_to_naive(self) -> None:
        naive = datetime(2026, 7, 30, 12, 0, 0)
        result = as_utc(naive)
        assert result is not None and result.tzinfo is not None

    def test_as_utc_none_passthrough(self) -> None:
        assert as_utc(None) is None

    def test_naive_value_becomes_comparable(self) -> None:
        """The exact failure behind audit d: this comparison used to raise."""
        normalised = as_utc(datetime(2026, 7, 30, 12, 0, 0))
        assert normalised is not None
        assert normalised > utc_now() - timedelta(days=3650)

    def test_aware_value_is_normalised_not_shifted(self) -> None:
        aware = datetime(2026, 7, 30, 12, 0, 0, tzinfo=UTC)
        assert as_utc(aware) == aware


class TestFarmToday:
    def test_zoneinfo_database_is_available(self) -> None:
        """Guards the `tzdata` dependency.

        python:3.12-slim ships no /usr/share/zoneinfo, so without the tzdata
        wheel this resolves on a developer machine and raises inside the
        container — a failure that only appears after deployment.
        """
        assert farm_today("Africa/Lagos") is not None

    def test_east_of_utc_is_never_behind_utc(self) -> None:
        """The rejection this replaced.

        A farm at a positive offset turns over to the next calendar day before
        UTC does. Comparing a same-day entry against the UTC date rejected it as
        "in the future" for those hours.
        """
        assert farm_today(EAST_OF_UTC) >= farm_today("UTC")

    def test_west_of_utc_is_never_ahead_of_utc(self) -> None:
        assert farm_today(WEST_OF_UTC) <= farm_today("UTC")

    def test_extreme_offsets_differ_by_at_most_one_day(self) -> None:
        assert (farm_today(EAST_OF_UTC) - farm_today(WEST_OF_UTC)).days <= 1

    def test_unknown_zone_falls_back_to_utc_rather_than_raising(self) -> None:
        # A bad IANA string is a data problem; making it a 500 on every record
        # write would be a worse failure than resolving "today" in UTC.
        assert farm_today("Mars/Olympus_Mons") == farm_today("UTC")


class TestBucketGains:
    W1 = date(2026, 6, 1)
    W2 = date(2026, 6, 8)
    W3 = date(2026, 6, 15)

    def test_gain_is_summed_per_hog_across_consecutive_buckets(self) -> None:
        rows = [(self.W1, 1, 50.0), (self.W2, 1, 60.0), (self.W1, 2, 40.0), (self.W2, 2, 45.0)]
        assert compute_bucket_gains(rows) == {self.W2: 15.0}

    def test_first_bucket_has_no_gain_because_it_has_no_predecessor(self) -> None:
        assert self.W1 not in compute_bucket_gains([(self.W1, 1, 50.0), (self.W2, 1, 60.0)])

    def test_a_hog_that_arrives_mid_series_does_not_register_as_gain(self) -> None:
        """The reason this is not a difference of herd totals.

        Hog 2 appears in the second bucket only. Summing herd weight and taking
        the difference would credit its entire 80 kg as gain the herd never put
        on; only hog 1's real 10 kg counts.
        """
        rows = [(self.W1, 1, 50.0), (self.W2, 1, 60.0), (self.W2, 2, 80.0)]
        assert compute_bucket_gains(rows) == {self.W2: 10.0}

    def test_a_hog_that_leaves_does_not_register_as_loss(self) -> None:
        rows = [(self.W1, 1, 50.0), (self.W1, 2, 80.0), (self.W2, 1, 60.0)]
        assert compute_bucket_gains(rows) == {self.W2: 10.0}

    def test_weight_loss_is_reported_as_negative(self) -> None:
        rows = [(self.W1, 1, 60.0), (self.W2, 1, 55.0)]
        assert compute_bucket_gains(rows) == {self.W2: -5.0}

    def test_empty_input(self) -> None:
        assert compute_bucket_gains([]) == {}


class TestGrowthGenerator:
    """Permanent guard against audit g — seeded weight running backwards."""

    def test_weight_never_decreases_for_healthy_archetype(self) -> None:
        rng = random.Random(1)
        plan = gen.HogPlan(
            tag_number="T-1",
            breed="Duroc",
            sex=gen.HogSex.female,
            production_class=ProductionClass.grower,
            birth_date=date(2026, 1, 1),
            archetype=gen.Archetype.healthy,
            start_weight_kg=40.0,
            vigour=1.0,
        )
        series = gen.build_series(plan, date(2026, 4, 1), 90, rng)
        weights = [p.weight_kg for p in series.points]
        assert weights[-1] > weights[0]

    def test_whole_demo_herd_gains_weight_overall(self) -> None:
        rng = random.Random(42)
        plans = gen.plan_herd(rng, 20, 90, "H1")
        losers = 0
        for plan in plans:
            series = gen.build_series(plan, date(2026, 4, 1), 90, rng)
            if series.points[-1].weight_kg < series.points[0].weight_kg:
                losers += 1
        # Decline and mortality archetypes are *meant* to lose condition, but
        # they must never be the majority.
        assert losers <= len(plans) // 4

    def test_demo_herd_matches_the_project_description(self) -> None:
        rng = random.Random(42)
        plans = gen.plan_herd(rng, 20, 90, "H1")
        counts: dict[ProductionClass, int] = {}
        for p in plans:
            counts[p.production_class] = counts.get(p.production_class, 0) + 1
        assert counts[ProductionClass.boar] == 1
        assert counts[ProductionClass.sow] == 2
        assert counts[ProductionClass.grower] == 3
        assert counts[ProductionClass.piglet] == 14

    def test_dead_animals_stop_producing_records(self) -> None:
        rng = random.Random(7)
        plan = gen.HogPlan(
            tag_number="T-2",
            breed="Duroc",
            sex=gen.HogSex.male,
            production_class=ProductionClass.piglet,
            birth_date=date(2026, 1, 1),
            archetype=gen.Archetype.mortality,
            start_weight_kg=6.0,
            vigour=1.0,
            death_day=40,
        )
        series = gen.build_series(plan, date(2026, 4, 1), 90, rng)
        assert max(p.day_index for p in series.points) <= 40

    def test_same_seed_reproduces_identical_data(self) -> None:
        """Chapter 4 figures must survive a re-seed."""
        a = gen.plan_herd(random.Random(42), 20, 90, "H1")
        b = gen.plan_herd(random.Random(42), 20, 90, "H1")
        assert [(p.tag_number, p.breed, p.archetype) for p in a] == [
            (p.tag_number, p.breed, p.archetype) for p in b
        ]

    def test_archetype_mix_shares_sum_to_one(self) -> None:
        assert abs(sum(gen.ARCHETYPE_MIX.values()) - 1.0) < 1e-9
