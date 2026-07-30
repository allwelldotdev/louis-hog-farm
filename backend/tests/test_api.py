"""Database-backed API tests, one regression per audit finding that was fixed."""

from typing import Any

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
        assert body["timezone"] == "UTC"
        assert body["hog_count"] == 1


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
