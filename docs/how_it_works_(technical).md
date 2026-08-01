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

`Farm` → `User` (roles: admin/manager/worker/viewer) → `Hog` → child records (`FeedRecord`, `HealthRecord`, `BreedingCycle`, `Vaccination`, `MortalityEvent`, `Alert`/`AlertRule`). Every table below `Farm` carries a `farm_id`, and every query is scoped by it — this is a multi-tenant system, with each farm's data fully isolated from every other farm's.

`Hog` also carries `dam_id`/`sire_id` (self-FKs to `hogs.id`). Hogs can now be created and edited from the dashboard, which is what makes lineage recordable at all — the dam picker offers only sows and gilts, the sire picker only boars, and neither offers the animal itself. New farms default to `Africa/Lagos` and `NGN` as of migration `m5_006` (current Alembic head).

## API conventions

- List endpoints return a `Page[T]` envelope (items + pagination metadata), never a bare array.
- Every query is scoped to the caller's `farm_id`.
- Accessing another farm's record returns **404, not 403** — see FAQ.
- CSV export streams the response rather than building it in memory; nine record types export, including vaccinations and mortality events.
- "Today" is computed in the farm's own timezone, not the server's.
- Lineage is validated in the endpoint, not the schema: a dam must be female, a sire male, no animal is its own parent or older than one, and `PATCH` distinguishes an omitted field from an explicit `null` so a parent recorded in error can be cleared.
- Manager-side account/farm management: `PATCH /users/{id}` changes a colleague's role (worker ⇄ viewer only — a manager cannot create or demote another manager), and `PATCH /farms/me` renames the farm (name only; currency and timezone stay fixed once set, since feed records store currency at write time for historical accuracy).
- The production-class distribution and feed-cost series both accept a `breed` filter. The breed distribution deliberately does not — it's the source of the filter's own options, so narrowing it to the current selection would leave the dropdown holding one option and no way back.

## Caching / cache invalidation

No Redis. Postgres statement-level triggers increment a per-farm `data_versions` counter whenever relevant tables change; API responses use that counter as an ETag, so a client's `If-None-Match` gets a 304 when nothing has actually changed for that farm.

## Auth model

JWT (via PyJWT) with Argon2 password hashing. The browser never holds a token directly — it's a thin **BFF (backend-for-frontend)** pattern: the browser only ever talks to Next.js routes (`src/app/api/auth/*`, `src/app/api/backend/[...path]`), which hold the session in an httpOnly cookie and proxy every request server-side to FastAPI. There is intentionally no public API base URL exposed to client-side code.

## Migrations

Alembic owns the schema; migrations **never run at application startup**. A one-shot `migrate` step (either `make migrate` or the compose `migrate` service) applies them before the API starts — this avoids multiple API workers racing to migrate concurrently on boot.

## Testing

93 backend tests (pytest, against a real Postgres database — they skip rather than fail if Postgres is unreachable) and 25 dashboard tests (Vitest + jsdom). `make check` runs lint, typecheck, and both suites — exactly what the project's quality gate runs.

## Technical FAQ

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

**Is the FCR (feed conversion ratio) calibration gap noted in STATUS.md still present, and is it a bug?**
Still present, and still not a bug. Against the current bulk seed, FCR lands at ~4.27 against the 2.5–3.2 band the seeding plan aimed for. This is a seed-data calibration issue — the KPI computes correctly on the data it's given — and is deliberately out of scope: seeding exists to make the UI demonstrable, and what has to be correct is the path real, user-entered data travels, which was verified separately against hand-entered records.

**Does the demo farm still have zero mortality events, per STATUS.md's seed-data gaps?**
Yes. The bulk seed produces only 2 mortality events across all five seeded farms, and neither lands on Bright Acres Farm (the demo farm), so its mortality tile reads 0.0%. The feature itself works — CRUD, the page, and the export all function — there's just no seeded data to show on that particular farm.

**Is hog lineage (`dam_id`/`sire_id`) still empty in bulk-seeded data?**
Yes, in the seeder output specifically — no bulk-seeded hog carries lineage. But the underlying gap this used to represent (lineage being unreachable, not merely unseeded) is closed: the dashboard now has a hog create/edit form with dam/sire pickers, the API enforces sex, self-reference, and birth-order rules, and lineage works end to end when entered by hand — verified via the UI, with Dam/Sire columns visible by default in the roster and resolved to ear tags on the detail page.

**Is the settings page still read-only?**
No — this gap is closed. A manager can now rename the farm (`PATCH /farms/me`), add staff, and change a colleague's role between worker and viewer (`PATCH /users/{id}`), all from the settings page. What remains fixed by design rather than by omission: a manager cannot create or demote another manager (no code path can promote anyone back to manager, so an unguarded demotion would leave a farm without an administrator), and the farm's currency and timezone are not editable once set, since feed records store currency at write time and changing timezone would silently reinterpret what "today" meant for existing records.
