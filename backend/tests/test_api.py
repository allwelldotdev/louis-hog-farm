"""Database-backed API tests, one regression per audit finding that was fixed."""

from typing import Any

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

API = "/api/v1"


class TestAuth:
    def test_register_then_login(self, client: TestClient) -> None:
        r = client.post(
            f"{API}/auth/register",
            json={
                "email": "a@example.com",
                "password": "Password123",
                "full_name": "A",
                "farm_name": "Farm A",
            },
        )
        assert r.status_code == 201
        r = client.post(
            f"{API}/auth/login", data={"username": "a@example.com", "password": "Password123"}
        )
        assert r.status_code == 200
        assert {"access_token", "refresh_token"} <= r.json().keys()

    def test_lockout_returns_403_not_500(self, client: TestClient) -> None:
        """Regression for audit d.

        Five bad passwords locked the account, after which *every* request —
        including one with the correct password — raised TypeError comparing a
        naive `locked_until` against an aware now(), returning 500 forever.
        """
        client.post(
            f"{API}/auth/register",
            json={
                "email": "lock@example.com",
                "password": "Password123",
                "full_name": "L",
                "farm_name": "Farm L",
            },
        )
        for _ in range(5):
            client.post(
                f"{API}/auth/login", data={"username": "lock@example.com", "password": "wrong"}
            )
        r = client.post(
            f"{API}/auth/login", data={"username": "lock@example.com", "password": "Password123"}
        )
        assert r.status_code == 403
        assert "locked" in r.json()["detail"].lower()

    def test_unauthenticated_request_is_401(self, client: TestClient) -> None:
        assert client.get(f"{API}/hogs").status_code == 401


def _make_hog(client: TestClient, auth: dict[str, Any], **over: Any) -> dict[str, Any]:
    body = {"tag_number": "H-1", "birth_date": "2025-01-01", "breed": "Duroc"}
    body.update(over)
    created: dict[str, Any] = client.post(f"{API}/hogs", json=body, headers=auth["headers"]).json()
    return created


class TestHogs:
    def test_list_uses_the_page_envelope(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _make_hog(client, registered)
        body = client.get(f"{API}/hogs", headers=registered["headers"]).json()
        assert set(body) == {"items", "total", "limit", "offset"}
        assert body["total"] == 1

    def test_pagination_windows_results(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        for i in range(5):
            _make_hog(client, registered, tag_number=f"H-{i}")
        body = client.get(f"{API}/hogs?limit=2&offset=2", headers=registered["headers"]).json()
        assert body["total"] == 5
        assert len(body["items"]) == 2

    def test_limit_above_max_is_rejected(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        assert (
            client.get(f"{API}/hogs?limit=9999", headers=registered["headers"]).status_code == 422
        )

    def test_tag_can_be_reissued_after_archiving(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """Regression for audit h — the partial unique index.

        Archiving frees the tag. Under the old SQLite DDL this was a full unique
        index and re-issuing raised IntegrityError.
        """
        hog = _make_hog(client, registered, tag_number="H-REUSE")
        patched = client.patch(
            f"{API}/hogs/{hog['id']}", json={"status": "archived"}, headers=registered["headers"]
        )
        assert patched.status_code == 200
        again = client.post(
            f"{API}/hogs",
            json={"tag_number": "H-REUSE", "birth_date": "2025-02-01", "breed": "Landrace"},
            headers=registered["headers"],
        )
        assert again.status_code == 201

    def test_duplicate_active_tag_is_rejected(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _make_hog(client, registered, tag_number="H-DUP")
        r = client.post(
            f"{API}/hogs",
            json={"tag_number": "H-DUP", "birth_date": "2025-02-01", "breed": "Duroc"},
            headers=registered["headers"],
        )
        assert r.status_code == 409

    def test_domain_fields_round_trip(self, client: TestClient, registered: dict[str, Any]) -> None:
        created = _make_hog(
            client, registered, tag_number="DOM-1", sex="male", production_class="boar"
        )
        assert created["sex"] == "male"
        assert created["production_class"] == "boar"
        fetched = client.get(f"{API}/hogs/{created['id']}", headers=registered["headers"]).json()
        assert fetched["production_class"] == "boar"

    def test_production_class_can_be_advanced(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """piglet -> weaner is herd management, not a correction."""
        hog = _make_hog(client, registered, tag_number="DOM-2")
        r = client.patch(
            f"{API}/hogs/{hog['id']}",
            json={"production_class": "weaner"},
            headers=registered["headers"],
        )
        assert r.status_code == 200
        assert r.json()["production_class"] == "weaner"

    def test_list_can_be_filtered_by_production_class(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _make_hog(client, registered, tag_number="DOM-3", production_class="sow")
        _make_hog(client, registered, tag_number="DOM-4")
        body = client.get(f"{API}/hogs?production_class=sow", headers=registered["headers"]).json()
        assert body["total"] == 1
        assert body["items"][0]["tag_number"] == "DOM-3"

    def test_a_dam_from_another_farm_is_rejected(self, client: TestClient) -> None:
        """Lineage ids arrive from the client, so they are checked, not trusted."""
        auths = []
        for tag in ("m", "n"):
            client.post(
                f"{API}/auth/register",
                json={
                    "email": f"{tag}@example.com",
                    "password": "Password123",
                    "full_name": tag,
                    "farm_name": f"Farm {tag}",
                },
            )
            tok = client.post(
                f"{API}/auth/login",
                data={"username": f"{tag}@example.com", "password": "Password123"},
            ).json()["access_token"]
            auths.append({"headers": {"Authorization": f"Bearer {tok}"}})
        foreign_dam = _make_hog(client, auths[0], tag_number="FOREIGN-DAM")
        r = client.post(
            f"{API}/hogs",
            json={
                "tag_number": "PIGLET-1",
                "birth_date": "2026-05-01",
                "breed": "Duroc",
                "dam_id": foreign_dam["id"],
            },
            headers=auths[1]["headers"],
        )
        assert r.status_code == 404

    def test_lineage_can_be_cleared(self, client: TestClient, registered: dict[str, Any]) -> None:
        """An explicit null clears; an absent key leaves the value alone.

        `if body.dam_id is not None` could not tell the two apart, so a dam
        recorded against the wrong animal was permanent.
        """
        dam = _make_hog(
            client, registered, tag_number="LIN-DAM", birth_date="2024-01-01", sex="female"
        )
        piglet = _make_hog(
            client, registered, tag_number="LIN-1", birth_date="2025-06-01", dam_id=dam["id"]
        )
        assert piglet["dam_id"] == dam["id"]

        untouched = client.patch(
            f"{API}/hogs/{piglet['id']}",
            json={"breed": "Landrace"},
            headers=registered["headers"],
        ).json()
        assert untouched["dam_id"] == dam["id"]

        cleared = client.patch(
            f"{API}/hogs/{piglet['id']}",
            json={"dam_id": None},
            headers=registered["headers"],
        )
        assert cleared.status_code == 200
        assert cleared.json()["dam_id"] is None

    def test_a_dam_must_be_female(self, client: TestClient, registered: dict[str, Any]) -> None:
        boar = _make_hog(
            client,
            registered,
            tag_number="LIN-BOAR",
            birth_date="2024-01-01",
            sex="male",
            production_class="boar",
        )
        r = client.post(
            f"{API}/hogs",
            json={
                "tag_number": "LIN-2",
                "birth_date": "2025-06-01",
                "breed": "Duroc",
                "dam_id": boar["id"],
            },
            headers=registered["headers"],
        )
        assert r.status_code == 400
        assert "female" in r.json()["detail"]

    def test_a_hog_cannot_be_its_own_sire(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="LIN-3", sex="male")
        r = client.patch(
            f"{API}/hogs/{hog['id']}",
            json={"sire_id": hog["id"]},
            headers=registered["headers"],
        )
        assert r.status_code == 400

    def test_a_parent_must_be_born_first(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        younger = _make_hog(
            client, registered, tag_number="LIN-YOUNG", birth_date="2026-01-01", sex="female"
        )
        r = client.post(
            f"{API}/hogs",
            json={
                "tag_number": "LIN-4",
                "birth_date": "2025-06-01",
                "breed": "Duroc",
                "dam_id": younger["id"],
            },
            headers=registered["headers"],
        )
        assert r.status_code == 400

    def test_another_farms_hog_is_not_visible(self, client: TestClient) -> None:
        """404 rather than 403 — a 403 would confirm the row exists."""
        farms = []
        for tag in ("x", "y"):
            client.post(
                f"{API}/auth/register",
                json={
                    "email": f"{tag}@example.com",
                    "password": "Password123",
                    "full_name": tag,
                    "farm_name": f"Farm {tag}",
                },
            )
            tok = client.post(
                f"{API}/auth/login",
                data={"username": f"{tag}@example.com", "password": "Password123"},
            ).json()["access_token"]
            farms.append({"headers": {"Authorization": f"Bearer {tok}"}})
        hog = _make_hog(client, farms[0], tag_number="SECRET")
        assert client.get(f"{API}/hogs/{hog['id']}", headers=farms[1]["headers"]).status_code == 404


class TestBreedingCycles:
    def _sow(self, client: TestClient, auth: dict[str, Any], db: Session) -> int:
        hog = _make_hog(client, auth, tag_number="SOW-1")
        db.execute(text("UPDATE hogs SET production_class='sow' WHERE id=:i"), {"i": hog["id"]})
        return int(hog["id"])

    def test_closing_a_cycle_without_end_date_is_400_not_500(
        self, client: TestClient, registered: dict[str, Any], db: Session
    ) -> None:
        """Regression for audit c.

        `_validate_cycle_dates` took a parameter named `status`, shadowing
        fastapi.status, so both raise paths threw AttributeError -> 500.
        """
        hog_id = self._sow(client, registered, db)
        cycle = client.post(
            f"{API}/breeding-cycles",
            json={"hog_id": hog_id, "start_date": "2026-01-01"},
            headers=registered["headers"],
        ).json()
        r = client.patch(
            f"{API}/breeding-cycles/{cycle['id']}",
            json={"status": "completed"},
            headers=registered["headers"],
        )
        assert r.status_code == 400
        assert "end_date" in r.json()["detail"]

    def test_closing_a_cycle_with_end_date_succeeds(
        self, client: TestClient, registered: dict[str, Any], db: Session
    ) -> None:
        hog_id = self._sow(client, registered, db)
        cycle = client.post(
            f"{API}/breeding-cycles",
            json={"hog_id": hog_id, "start_date": "2026-01-01"},
            headers=registered["headers"],
        ).json()
        r = client.patch(
            f"{API}/breeding-cycles/{cycle['id']}",
            json={"status": "completed", "end_date": "2026-05-01"},
            headers=registered["headers"],
        )
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

    def test_cycle_on_a_piglet_is_rejected(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="PIG-1")  # defaults to piglet
        r = client.post(
            f"{API}/breeding-cycles",
            json={"hog_id": hog["id"], "start_date": "2026-01-01"},
            headers=registered["headers"],
        )
        assert r.status_code == 400
        assert "sows and gilts" in r.json()["detail"]


class TestFeedRecords:
    def test_currency_comes_from_the_farm_not_the_client(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """Regression for audit i — mixed currency blanked every cost KPI."""
        hog = _make_hog(client, registered, tag_number="FEED-1")
        r = client.post(
            f"{API}/feed-records",
            json={
                "hog_id": hog["id"],
                "feed_amount": "2.5",
                "feed_cost": "2500",
                "currency_code": "GBP",  # ignored on purpose
                "record_date": "2026-07-01",
            },
            headers=registered["headers"],
        )
        assert r.status_code == 201
        assert r.json()["currency_code"] == "NGN"


class TestDataVersion:
    def test_writes_bump_the_farms_version(
        self, client: TestClient, registered: dict[str, Any], db: Session
    ) -> None:
        """The mechanism the dashboard's cache invalidation depends on."""
        farm_id = db.execute(text("SELECT id FROM farms WHERE name='Test Farm'")).scalar_one()
        before = db.execute(
            text("SELECT version FROM data_versions WHERE farm_id=:f"), {"f": farm_id}
        ).scalar_one()
        _make_hog(client, registered, tag_number="VER-1")
        after = db.execute(
            text("SELECT version FROM data_versions WHERE farm_id=:f"), {"f": farm_id}
        ).scalar_one()
        assert after > before

    def test_bulk_insert_bumps_once_per_statement(
        self, client: TestClient, registered: dict[str, Any], db: Session
    ) -> None:
        """Statement-level triggers: 100 rows in one statement is one bump."""
        farm_id = db.execute(text("SELECT id FROM farms WHERE name='Test Farm'")).scalar_one()
        hog = _make_hog(client, registered, tag_number="BULK-1")
        before = db.execute(
            text("SELECT version FROM data_versions WHERE farm_id=:f"), {"f": farm_id}
        ).scalar_one()
        db.execute(
            text(
                "INSERT INTO health_records (hog_id, farm_id, weight, record_date) "
                "SELECT :h, :f, 50 + g, CURRENT_DATE - g FROM generate_series(1,100) g"
            ),
            {"h": hog["id"], "f": farm_id},
        )
        after = db.execute(
            text("SELECT version FROM data_versions WHERE farm_id=:f"), {"f": farm_id}
        ).scalar_one()
        assert after - before == 1


class TestMetaAndFarm:
    def test_data_version_endpoint_tracks_the_counter(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        before = client.get(f"{API}/meta/data-version", headers=registered["headers"]).json()
        _make_hog(client, registered, tag_number="META-1")
        after = client.get(f"{API}/meta/data-version", headers=registered["headers"]).json()
        assert after["farm_id"] == before["farm_id"]
        assert after["version"] > before["version"]

    def test_farms_me_reports_currency_timezone_and_herd_size(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _make_hog(client, registered, tag_number="FARM-1")
        body = client.get(f"{API}/farms/me", headers=registered["headers"]).json()
        assert body["name"] == "Test Farm"
        assert body["currency_code"] == "NGN"
        # Nigeria-first: registration now agrees with the seeder instead of UTC.
        assert body["timezone"] == "Africa/Lagos"
        assert body["hog_count"] == 1


def _hog_with_growth(
    client: TestClient, auth: dict[str, Any], tag: str, first_kg: str, last_kg: str, feed_kg: str
) -> dict[str, Any]:
    """A hog with two weigh-ins 30 days apart and one feed record."""
    hog = _make_hog(client, auth, tag_number=tag)
    for day, kg in (("2026-06-01", first_kg), ("2026-07-01", last_kg)):
        client.post(
            f"{API}/health-records",
            json={"hog_id": hog["id"], "weight": kg, "record_date": day},
            headers=auth["headers"],
        )
    client.post(
        f"{API}/feed-records",
        json={
            "hog_id": hog["id"],
            "feed_amount": feed_kg,
            "feed_cost": "1000",
            "record_date": "2026-06-15",
        },
        headers=auth["headers"],
    )
    return hog


class TestDashboardKpis:
    def test_cost_kpis_are_reported_not_nulled(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """Regression for audit i.

        The old response carried `feed_cost_by_currency` and blanked every cost
        figure whenever more than one currency appeared. Currency now comes from
        the farm, so there is one currency and one set of numbers.
        """
        _hog_with_growth(client, registered, "KPI-1", "50.0", "80.0", "60.0")
        body = client.get(
            f"{API}/dashboard/kpis?date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert "feed_cost_by_currency" not in body
        assert body["currency_code"] == "NGN"
        assert body["total_feed_cost"] == 1000.0
        assert body["total_feed_kg"] == 60.0
        assert body["feed_cost_per_kg_gain"] is not None

    def test_fcr_is_feed_kg_over_gain_kg(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "KPI-2", "50.0", "80.0", "60.0")
        body = client.get(
            f"{API}/dashboard/kpis?date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert body["total_weight_gain_kg"] == 30.0
        assert body["fcr"] == 2.0

    def test_fcr_is_null_rather_than_zero_when_nothing_grew(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        body = client.get(f"{API}/dashboard/kpis", headers=registered["headers"]).json()
        assert body["fcr"] is None
        assert body["avg_daily_gain_kg"] is None
        assert body["mortality_rate_pct"] is None

    def test_mortality_and_alert_counts_are_present(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "KPI-3", "50.0", "80.0", "60.0")
        body = client.get(f"{API}/dashboard/kpis", headers=registered["headers"]).json()
        assert body["mortality_count"] == 0
        assert body["mortality_rate_pct"] == 0.0
        assert body["open_alerts_count"] == 0

    def test_underperformers_no_longer_inline(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        body = client.get(f"{API}/dashboard/kpis", headers=registered["headers"]).json()
        assert "underperformers" not in body


class TestLeaderboard:
    def test_top_by_adg_ranks_the_faster_grower_first(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "LB-slow", "50.0", "60.0", "40.0")
        _hog_with_growth(client, registered, "LB-fast", "50.0", "90.0", "40.0")
        body = client.get(
            f"{API}/dashboard/leaderboard?metric=adg&direction=top"
            "&date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert [r["tag_number"] for r in body["rows"]] == ["LB-fast", "LB-slow"]

    def test_bottom_reverses_the_order(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "LB-slow", "50.0", "60.0", "40.0")
        _hog_with_growth(client, registered, "LB-fast", "50.0", "90.0", "40.0")
        body = client.get(
            f"{API}/dashboard/leaderboard?metric=adg&direction=bottom"
            "&date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert body["rows"][0]["tag_number"] == "LB-slow"
        assert body["rows"][0]["is_underperformer"] is True

    def test_fcr_ranking_excludes_hogs_without_a_ratio(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """A hog that was never fed has no ratio, not an unbeatable one."""
        _hog_with_growth(client, registered, "LB-fed", "50.0", "80.0", "60.0")
        unfed = _make_hog(client, registered, tag_number="LB-unfed")
        for day, kg in (("2026-06-01", "50.0"), ("2026-07-01", "80.0")):
            client.post(
                f"{API}/health-records",
                json={"hog_id": unfed["id"], "weight": kg, "record_date": day},
                headers=registered["headers"],
            )
        body = client.get(
            f"{API}/dashboard/leaderboard?metric=fcr&date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert [r["tag_number"] for r in body["rows"]] == ["LB-fed"]

    def test_limit_caps_the_rows(self, client: TestClient, registered: dict[str, Any]) -> None:
        for i in range(3):
            _hog_with_growth(client, registered, f"LB-{i}", "50.0", f"{60 + i}.0", "40.0")
        body = client.get(
            f"{API}/dashboard/leaderboard?limit=2&date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert len(body["rows"]) == 2


class TestDashboardCharts:
    RANGE = "date_from=2026-06-01&date_to=2026-07-31"

    def test_herd_growth_reports_a_percentile_band(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "HG-1", "50.0", "80.0", "40.0")
        _hog_with_growth(client, registered, "HG-2", "60.0", "95.0", "40.0")
        body = client.get(
            f"{API}/dashboard/herd-growth?interval=week&{self.RANGE}",
            headers=registered["headers"],
        ).json()
        assert body["interval"] == "week"
        assert len(body["points"]) == 2
        first = body["points"][0]
        assert first["hog_count"] == 2
        assert first["p10_weight_kg"] <= first["median_weight_kg"] <= first["p90_weight_kg"]

    def test_herd_growth_rejects_an_unknown_interval(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """The Literal closes the set before `date_trunc` ever sees the value."""
        r = client.get(
            f"{API}/dashboard/herd-growth?interval=fortnight", headers=registered["headers"]
        )
        assert r.status_code == 422

    def test_breed_distribution_counts_and_averages_by_breed(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "BD-1", "50.0", "80.0", "40.0")
        _make_hog(client, registered, tag_number="BD-2", breed="Landrace")
        body = client.get(
            f"{API}/dashboard/breed-distribution?{self.RANGE}", headers=registered["headers"]
        ).json()
        assert body["group_by"] == "breed"
        assert body["total_hogs"] == 2
        by_key = {r["key"]: r for r in body["rows"]}
        assert by_key["Duroc"]["avg_adg_kg_per_day"] is not None
        # Never weighed, so there is no average to report — not a zero.
        assert by_key["Landrace"]["avg_weight_kg"] is None

    def test_production_class_distribution_renders_the_herd(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _make_hog(client, registered, tag_number="PC-1")
        body = client.get(
            f"{API}/dashboard/production-class-distribution", headers=registered["headers"]
        ).json()
        assert body["group_by"] == "production_class"
        assert body["rows"][0]["key"] == "piglet"

    def test_weight_distribution_bins_the_latest_weights(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "WD-1", "50.0", "82.0", "40.0")
        body = client.get(
            f"{API}/dashboard/weight-distribution?bucket_kg=10&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert body["total_hogs"] == 1
        assert body["buckets"][0]["lower_kg"] == 80.0
        assert body["buckets"][0]["upper_kg"] == 90.0

    def test_feed_cost_series_reports_spend_per_bucket(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        _hog_with_growth(client, registered, "FC-1", "50.0", "80.0", "60.0")
        body = client.get(
            f"{API}/dashboard/feed-cost-series?interval=week&{self.RANGE}",
            headers=registered["headers"],
        ).json()
        assert body["currency_code"] == "NGN"
        assert sum(p["feed_cost"] for p in body["points"]) == 1000.0

    def test_alert_summary_counts_by_status_and_type(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="AL-1")
        client.post(
            f"{API}/alerts",
            json={
                "hog_id": hog["id"],
                "alert_type": "growth_anomaly",
                "alert_date": "2026-07-01",
                "message": "lost condition",
            },
            headers=registered["headers"],
        )
        body = client.get(f"{API}/dashboard/alert-summary", headers=registered["headers"]).json()
        assert body["by_status"]["open"] == 1
        assert body["by_status"]["resolved"] == 0
        assert body["by_type"]["growth_anomaly"] == 1
        assert body["by_type"]["vaccination_due"] == 0
        assert len(body["recent"]) == 1


class TestDashboardCaching:
    def test_repeat_request_with_matching_etag_is_304(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        first = client.get(f"{API}/dashboard/kpis", headers=registered["headers"])
        assert first.status_code == 200
        etag = first.headers["etag"]
        assert first.headers["cache-control"] == "private, no-cache"

        second = client.get(
            f"{API}/dashboard/kpis",
            headers={**registered["headers"], "If-None-Match": etag},
        )
        assert second.status_code == 304
        assert second.content == b""

    def test_a_write_invalidates_the_etag(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """The whole point of validating against `data_versions`.

        A 304 must not survive a write, or the dashboard shows numbers that the
        database has already moved past.
        """
        etag = client.get(f"{API}/dashboard/kpis", headers=registered["headers"]).headers["etag"]
        _make_hog(client, registered, tag_number="ETAG-1")
        after = client.get(
            f"{API}/dashboard/kpis",
            headers={**registered["headers"], "If-None-Match": etag},
        )
        assert after.status_code == 200
        assert after.headers["etag"] != etag

    def test_different_parameters_get_different_etags(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        a = client.get(f"{API}/dashboard/kpis?breed=Duroc", headers=registered["headers"])
        b = client.get(f"{API}/dashboard/kpis?breed=Landrace", headers=registered["headers"])
        assert a.headers["etag"] != b.headers["etag"]


class TestUsers:
    def test_roster_is_scoped_to_the_managers_farm(self, client: TestClient) -> None:
        managers = []
        for tag in ("p", "q"):
            client.post(
                f"{API}/auth/register",
                json={
                    "email": f"{tag}@example.com",
                    "password": "Password123",
                    "full_name": tag,
                    "farm_name": f"Farm {tag}",
                },
            )
            tok = client.post(
                f"{API}/auth/login",
                data={"username": f"{tag}@example.com", "password": "Password123"},
            ).json()["access_token"]
            managers.append({"Authorization": f"Bearer {tok}"})
        body = client.get(f"{API}/users", headers=managers[0]).json()
        assert body["total"] == 1
        assert body["items"][0]["email"] == "p@example.com"

    def test_a_worker_cannot_enumerate_the_roster(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        client.post(
            f"{API}/users",
            json={
                "email": "worker@example.com",
                "password": "Password123",
                "full_name": "W",
                "role": "worker",
            },
            headers=registered["headers"],
        )
        tok = client.post(
            f"{API}/auth/login",
            data={"username": "worker@example.com", "password": "Password123"},
        ).json()["access_token"]
        r = client.get(f"{API}/users", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403

    def test_a_managers_own_role_cannot_be_changed(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """Nothing in the app can promote to manager, so self-demotion is a
        one-way door out of the settings page."""
        me = client.get(f"{API}/users/me", headers=registered["headers"]).json()
        r = client.patch(
            f"{API}/users/{me['id']}",
            json={"role": "viewer"},
            headers=registered["headers"],
        )
        assert r.status_code == 400

    def test_a_staff_role_can_be_changed(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        created = client.post(
            f"{API}/users",
            json={
                "email": "staff@example.com",
                "password": "Password123",
                "full_name": "S",
                "role": "viewer",
            },
            headers=registered["headers"],
        ).json()
        r = client.patch(
            f"{API}/users/{created['id']}",
            json={"role": "worker"},
            headers=registered["headers"],
        )
        assert r.status_code == 200
        assert r.json()["role"] == "worker"

    def test_a_role_cannot_be_raised_to_manager(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        created = client.post(
            f"{API}/users",
            json={
                "email": "staff2@example.com",
                "password": "Password123",
                "full_name": "S",
                "role": "viewer",
            },
            headers=registered["headers"],
        ).json()
        r = client.patch(
            f"{API}/users/{created['id']}",
            json={"role": "manager"},
            headers=registered["headers"],
        )
        assert r.status_code == 422

    def test_a_user_on_another_farm_is_not_reachable(self, client: TestClient) -> None:
        auths = []
        for tag in ("r", "s"):
            client.post(
                f"{API}/auth/register",
                json={
                    "email": f"{tag}@example.com",
                    "password": "Password123",
                    "full_name": tag,
                    "farm_name": f"Farm {tag}",
                },
            )
            tok = client.post(
                f"{API}/auth/login",
                data={"username": f"{tag}@example.com", "password": "Password123"},
            ).json()["access_token"]
            auths.append({"Authorization": f"Bearer {tok}"})
        foreign = client.post(
            f"{API}/users",
            json={
                "email": "foreign-staff@example.com",
                "password": "Password123",
                "full_name": "F",
                "role": "viewer",
            },
            headers=auths[0],
        ).json()
        r = client.patch(f"{API}/users/{foreign['id']}", json={"role": "worker"}, headers=auths[1])
        assert r.status_code == 404


class TestFarms:
    def test_a_manager_can_rename_the_farm(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        r = client.patch(
            f"{API}/farms/me", json={"name": "Renamed Farm"}, headers=registered["headers"]
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Renamed Farm"
        assert client.get(f"{API}/farms/me", headers=registered["headers"]).json()["name"] == (
            "Renamed Farm"
        )

    def test_a_worker_cannot_rename_the_farm(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        client.post(
            f"{API}/users",
            json={
                "email": "farmworker@example.com",
                "password": "Password123",
                "full_name": "W",
                "role": "worker",
            },
            headers=registered["headers"],
        )
        tok = client.post(
            f"{API}/auth/login",
            data={"username": "farmworker@example.com", "password": "Password123"},
        ).json()["access_token"]
        r = client.patch(
            f"{API}/farms/me",
            json={"name": "Nope"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 403


class TestVaccinations:
    def test_create_and_list(self, client: TestClient, registered: dict[str, Any]) -> None:
        hog = _make_hog(client, registered, tag_number="VAC-1")
        r = client.post(
            f"{API}/vaccinations",
            json={
                "hog_id": hog["id"],
                "vaccine_name": "Erysipelas",
                "dose_date": "2026-07-01",
                "next_due_date": "2026-10-01",
            },
            headers=registered["headers"],
        )
        assert r.status_code == 201
        assert r.json()["next_due_date"] == "2026-10-01"
        listed = client.get(f"{API}/vaccinations", headers=registered["headers"]).json()
        assert listed["total"] == 1

    def test_due_before_filters_to_upcoming_doses(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="VAC-2")
        for due in ("2026-08-01", "2026-12-01"):
            client.post(
                f"{API}/vaccinations",
                json={
                    "hog_id": hog["id"],
                    "vaccine_name": "Mycoplasma",
                    "dose_date": "2026-07-01",
                    "next_due_date": due,
                },
                headers=registered["headers"],
            )
        body = client.get(
            f"{API}/vaccinations?due_before=2026-09-01", headers=registered["headers"]
        ).json()
        assert body["total"] == 1

    def test_next_due_before_dose_date_is_rejected(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="VAC-3")
        r = client.post(
            f"{API}/vaccinations",
            json={
                "hog_id": hog["id"],
                "vaccine_name": "PCV2",
                "dose_date": "2026-07-01",
                "next_due_date": "2026-06-01",
            },
            headers=registered["headers"],
        )
        assert r.status_code == 400


class TestMortalityEvents:
    def _record_death(
        self, client: TestClient, auth: dict[str, Any], hog_id: int
    ) -> httpx.Response:
        return client.post(
            f"{API}/mortality-events",
            json={"hog_id": hog_id, "event_date": "2026-07-01", "cause": "scour"},
            headers=auth["headers"],
        )

    def test_recording_a_death_moves_the_hog_to_deceased(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """The two are one fact.

        Leaving the status change to a separate PATCH would let a farm hold
        deaths whose animals still count as live herd, which is exactly how the
        mortality rate goes wrong.
        """
        hog = _make_hog(client, registered, tag_number="MORT-1")
        assert self._record_death(client, registered, hog["id"]).status_code == 201
        after = client.get(f"{API}/hogs/{hog['id']}", headers=registered["headers"]).json()
        assert after["status"] == "deceased"

    def test_a_second_death_for_the_same_hog_is_409(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="MORT-2")
        self._record_death(client, registered, hog["id"])
        assert self._record_death(client, registered, hog["id"]).status_code == 409

    def test_deaths_show_up_in_the_kpi_mortality_figures(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="MORT-3")
        _make_hog(client, registered, tag_number="MORT-alive")
        self._record_death(client, registered, hog["id"])
        body = client.get(
            f"{API}/dashboard/kpis?date_from=2026-06-01&date_to=2026-07-31",
            headers=registered["headers"],
        ).json()
        assert body["mortality_count"] == 1
        # One dead, one alive: the denominator counts the population at risk.
        assert body["mortality_rate_pct"] == 50.0


class TestExports:
    def test_csv_has_a_header_and_one_row_per_record(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        hog = _make_hog(client, registered, tag_number="EXP-1")
        for day in ("2026-07-01", "2026-07-02"):
            client.post(
                f"{API}/health-records",
                json={"hog_id": hog["id"], "weight": "50.0", "record_date": day},
                headers=registered["headers"],
            )
        r = client.get(f"{API}/exports/health_records", headers=registered["headers"])
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        lines = [ln for ln in r.text.splitlines() if ln.strip()]
        assert lines[0].startswith("id,hog_id,weight")
        assert len(lines) == 3

    def test_unknown_export_key_is_422(
        self, client: TestClient, registered: dict[str, Any]
    ) -> None:
        """The Literal type rejects it before the handler runs (audit r)."""
        assert (
            client.get(f"{API}/exports/nonsense", headers=registered["headers"]).status_code == 422
        )


class TestHealth:
    def test_liveness_is_always_ok(self, client: TestClient) -> None:
        assert client.get("/health").json()["status"] == "ok"

    def test_readiness_reports_the_migration_revision(self, client: TestClient) -> None:
        body = client.get("/health/ready").json()
        assert body["status"] == "ready"
        assert body["current_revision"] == body["expected_revision"]
