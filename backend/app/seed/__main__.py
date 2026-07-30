"""Seed the database.

    python -m app.seed                                    # demo: 1 farm, 20 hogs, 90 days
    python -m app.seed --profile bulk --farms 5 --hogs 60 --days 90
    python -m app.seed --reset                            # wipe this farm's records first

Deterministic for a given --seed. Re-running with the same arguments reproduces
the same numbers, so figures quoted in the report keep matching the screenshots.
"""

import argparse
from datetime import date

from app.db.session import SessionLocal
from app.seed.profiles import (
    DEMO_EMAIL,
    DEMO_FARM_NAME,
    EXTRA_FARM_NAMES,
    SeedConflict,
    SeedResult,
    seed_farm,
)
from app.services import alert_rules


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="python -m app.seed", description=__doc__)
    p.add_argument("--profile", choices=["demo", "bulk"], default="demo")
    p.add_argument("--farms", type=int, default=1, help="bulk only: number of farms")
    p.add_argument("--hogs", type=int, default=20, help="hogs per farm")
    p.add_argument("--days", type=int, default=90, help="days of backdated history")
    p.add_argument("--seed", type=int, default=42, help="RNG seed; same seed, same data")
    p.add_argument(
        "--reset",
        action="store_true",
        help="delete each seeded farm's existing records first (keeps farm and users)",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    try:
        _run(args)
    except SeedConflict as exc:
        raise SystemExit(f"\nSeed aborted: {exc}\n") from None


def _run(args: argparse.Namespace) -> None:
    farms = 1 if args.profile == "demo" else max(1, args.farms)
    hogs = 20 if args.profile == "demo" else args.hogs

    results: list[SeedResult] = []
    with SessionLocal() as db:
        for i in range(farms):
            if i == 0:
                name, email, who = DEMO_FARM_NAME, DEMO_EMAIL, "Ava Thompson"
            else:
                name = EXTRA_FARM_NAMES[(i - 1) % len(EXTRA_FARM_NAMES)]
                slug = name.lower().replace(" ", "").replace(".", "").replace("'", "")
                email, who = f"manager@{slug}.com", f"Manager {i}"
            results.append(
                seed_farm(
                    db,
                    farm_name=name,
                    manager_email=email,
                    manager_name=who,
                    hog_count=hogs,
                    days=args.days,
                    # Offset per farm so farms differ, but reproducibly.
                    rng_seed=args.seed + i * 1000,
                    tag_prefix=f"H{i + 1}",
                    reset=args.reset,
                )
            )

        # Alerts come from the real rule evaluator run over the seeded data,
        # never fabricated — so the dashboard demonstrates the engine's output.
        today = date.today()
        alert_counts = {
            r.farm_id: alert_rules.materialise(db, alert_rules.evaluate_farm(db, r.farm_id, today))
            for r in results
        }

    print(f"\nSeeded {len(results)} farm(s), {args.days} days of history, rng seed {args.seed}\n")
    header = (
        f"{'farm':<24}{'hogs':>6}{'health':>9}{'feed':>9}"
        f"{'vacc':>7}{'breed':>7}{'died':>6}{'alerts':>8}"
    )
    print(header)
    print("-" * len(header))
    for r in results:
        print(
            f"{r.farm_name[:23]:<24}{r.hogs:>6}{r.health_records:>9}{r.feed_records:>9}"
            f"{r.vaccinations:>7}{r.breeding_cycles:>7}{r.mortality_events:>6}"
            f"{alert_counts.get(r.farm_id, 0):>8}"
        )
    print(f"\nLogin: {DEMO_EMAIL} / Bright123!\n")


if __name__ == "__main__":
    main()
