# How it works (technical)

## Overview / stack

| Layer | Stack | Source |
|---|---|---|
| Web dashboard | Next.js 16 (App Router) + TypeScript + Tailwind v4 + TanStack Query + Recharts | `web-dashboard/src` |
| API | Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic | `backend/app` |
| Database | PostgreSQL 15 via Docker Compose | `docker-compose.yml` |
| Mobile | React Native + Expo — planned, not started | — |

## Architecture layers

The original pre-tech-spec described five layers: presentation (web + mobile), API/backend, domain/business logic, data access, and persistence/infrastructure. The implementation matches that for every layer except one deliberate divergence: **Postgres-only, no SQLite abstraction** — the original spec allowed SQLite for early prototyping, but that path was removed entirely once Postgres- and SQLite-specific behavior started drifting (see FAQ below). Domain logic (KPI aggregation, chart shaping, alert rules) is written as plain, framework-independent functions and unit tested directly.

## Data model

`Farm` → `User` → `Hog` → child records (`FeedRecord`, `HealthRecord`, `BreedingCycle`, `Vaccination`, `MortalityEvent`, `Alert`). Every table below `Farm` carries a `farm_id`, and every query is scoped by it — this is a multi-tenant system, with each farm's data fully isolated from every other farm's.

## API conventions

- List endpoints return a `Page[T]` envelope (items + pagination metadata), never a bare array.
- Every query is scoped to the caller's `farm_id`.
- Accessing another farm's record returns **404, not 403** — see FAQ.
- CSV export streams the response rather than building it in memory.
- "Today" is computed in the farm's own timezone, not the server's.

## Caching / cache invalidation

No Redis. Postgres statement-level triggers increment a per-farm `data_versions` counter whenever relevant tables change; API responses use that counter as an ETag, so a client's `If-None-Match` gets a 304 when nothing has actually changed for that farm.

## Auth model

JWT (via PyJWT) with Argon2 password hashing. The browser never holds a token directly — it's a thin **BFF (backend-for-frontend)** pattern: the browser only ever talks to Next.js routes (`src/app/api/auth/*`, `src/app/api/backend/[...path]`), which hold the session in an httpOnly cookie and proxy every request server-side to FastAPI. There is intentionally no public API base URL exposed to client-side code.

## Migrations

Alembic owns the schema; migrations **never run at application startup**. A one-shot `migrate` step (either `make migrate` or the compose `migrate` service) applies them before the API starts — this avoids multiple API workers racing to migrate concurrently on boot.

## Testing

78 backend tests (pytest, against a real Postgres database — they skip rather than fail if Postgres is unreachable) and 25 dashboard tests (Vitest + jsdom). `make check` runs lint, typecheck, and both suites — exactly what the project's quality gate runs.

## FAQ

**Why Postgres-only, no SQLite, despite the original spec allowing it?**
The two databases had drifted apart in ways that mattered: partial vs. full unique indexes, different default values, missing `CHECK` constraints, and — critically — `DateTime(timezone=True)` is only honest on Postgres, since SQLite silently stores naive datetimes. Rather than maintain two subtly different data layers, SQLite was dropped entirely.

**Why does cross-farm access return 404 instead of 403?**
A 403 confirms the record exists but is forbidden — that's still information leakage across tenants. Returning 404 for both "doesn't exist" and "exists but isn't yours" leaks nothing about other farms' data.

**How does cache invalidation work without Redis?**
Postgres statement-level triggers increment a `data_versions` counter per farm on write. Responses use that counter as an ETag, checked via `If-None-Match`, so no separate cache layer or invalidation logic is needed.

**Why do migrations never run at application startup?**
Running Alembic inside the API process means every worker (there are multiple Uvicorn workers) would try to migrate concurrently at boot. A one-shot `migrate` step runs to completion first, and the API only starts once it succeeds.

**What's the thin-BFF pattern, and why proxy auth through Next.js instead of calling the API directly from the browser?**
Session tokens live in httpOnly cookies set by Next.js server routes, never in `localStorage` or client-side JavaScript. The browser holds no credential it could leak via XSS, and there's no client-side session state that can silently go stale.

**Why is FCR (feed conversion ratio) calibration off — around 3.96 vs. a 2.5–3.2 target?**
This is a known seed-data calibration gap, not a code bug — the generated feed/growth numbers haven't been tuned to land in the realistic range yet. It affects how convincing the demo numbers look, not any code path.

**Why does the demo farm have zero mortality events?**
Also a seed-data artifact: the bulk seed only produces 2 mortality events across all five farms, and none happened to land on Bright Acres Farm (the demo/first farm). The mortality feature itself works — CRUD and the page render correctly — there's just no data to show on that particular farm.

**Why is hog lineage (`dam_id`/`sire_id`) empty in bulk-seeded data?**
The seeding plan intended farrowing to populate parentage, but none of the 300 seeded hogs across the bulk run carry lineage. Known gap — the UI shows "Not recorded" rather than fabricating a relationship.

**Why is the settings page read-only?**
There's no `PATCH /farms` endpoint and no in-app user creation yet, so the settings page states plainly that nothing there is editable rather than presenting a form that would silently fail to save.
