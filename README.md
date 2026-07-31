# Hog Farm Monitoring & Management System

A local-first pig-farm management system: individual-animal tracking (weight, breed, birth date,
tag number), production events (feed, health, breeding, alerts), and a KPI/growth dashboard.
Runs end to end on a single developer machine with no cloud services required.

| Layer | Stack |
|---|---|
| Web dashboard | Next.js 16 (App Router) + TypeScript + Tailwind v4 + TanStack Query + Recharts |
| API | Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 15 via Docker Compose |
| Mobile | React Native + Expo — planned, not started |

## Quick start

Everything is driven through the `Makefile`; `make help` lists every target.

```bash
cp .env.example .env        # then set JWT_SECRET (openssl rand -hex 32)
make install                # uv sync --all-groups + npm ci
make db-up && make migrate  # Postgres in Docker, schema via Alembic
make seed                   # demo farm: 1 boar, 2 sows, 3 growers, 14 piglets
make dev                    # tmux: API on :8000, dashboard on :3000, database logs, psql
```

Demo login: `manager@brightacres.com` / `Bright123!`

`make dev` is the everyday loop. It brings the database up, applies migrations, then opens a tmux
session with the API, the dashboard, `docker compose logs -f db`, a `psql` shell and a spare
prompt. Running it again attaches to the existing session rather than starting a second copy of
everything; `make dev-stop` tears it down and leaves the database container running. Without tmux,
`make api` and `make web` are the same two processes in two shells.

`DATABASE_URL` and `JWT_SECRET` are required and have no defaults — the API refuses to start
without them, rather than booting misconfigured and reporting healthy.

Other useful targets:

| Target | Does |
|---|---|
| `make dev` / `make dev-stop` | Start or stop the whole tmux dev session |
| `make psql` | Opens `psql` inside the container — no host client needed |
| `make seed-bulk` | 5 farms × 60 hogs × 90 days, ~27k feed rows, in about 12 seconds |
| `make db-reset` | Destructive: drops the volume, re-migrates, re-seeds |
| `make check` | Runs exactly what the quality gate runs — lint, typecheck, both test suites |
| `make types` | Regenerates the dashboard's API types from the running backend's OpenAPI document |

## Tests

`make test` runs both suites: **pytest** for the backend (78 tests, against a `hogfarm_test`
database on the same Postgres container) and **Vitest + jsdom** for the dashboard (25 tests).
Backend tests skip rather than fail when Postgres is unreachable, so a stopped container does not
look like a broken build.

## Documentation

All project documentation is under `.claude/docs/`:

| File | Contents |
|---|---|
| `SPEC.md` | Architecture and technical specification |
| `STATUS.md` | Current state and known issues |
| `TREE.md` | Repository layout |
| `plans/` | Numbered implementation plans |
| `misc/` | Numbered reference documents (audits, findings) |

Repository conventions and agent workflow rules are in `CLAUDE.md` and `.claude/policies/`.
