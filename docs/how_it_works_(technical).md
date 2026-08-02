# How it works (technical)

## Overview / stack

| Layer | Stack | Source |
|---|---|---|
| Web dashboard | Next.js 16 (App Router) + TypeScript + Tailwind v4 + TanStack Query + Recharts | `web-dashboard/src` |
| Mobile app | React Native (Expo SDK 57) + TypeScript + expo-router + TanStack Query | `mobile/src` |
| API | Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic | `backend/app` |
| Database | PostgreSQL 15 via Docker Compose | `docker-compose.yml` |

## Architecture layers

The original pre-tech-spec described five layers: presentation (web + mobile), API/backend, domain/business logic, data access, and persistence/infrastructure. The implementation matches that for every layer except one deliberate divergence: **Postgres-only, no SQLite abstraction** — the original spec allowed SQLite for early prototyping, but that path was removed entirely once Postgres- and SQLite-specific behavior started drifting (see FAQ below). Domain logic (KPI aggregation, chart shaping, alert rules) is written as plain, framework-independent functions and unit tested directly.

Presentation now has both halves built and verified: the web dashboard (analytical board plus eleven operational pages) and the mobile app (capture flows, read screens, manager surfaces, settings) against the same PostgreSQL database. **The mobile app has been rendered and driven both on an Android emulator and on a physical phone** — a Samsung A54 5G (arm64-v8a), sideloaded over USB. Touch ergonomics, real device performance and arm64 behaviour are no longer open questions; the write path was watched end to end, from a device weigh-in to the web dashboard's growth chart repainting with no reload. The one thing still unconfirmed is Expo Go itself as a distribution mechanism — every device run so far, emulator and phone alike, used a locally built dev client or a release APK, never Expo Go, because Expo Go 57.0.2 segfaults on the x86_64 emulator; see the FAQ.

## Data model

`Farm` → `User` (roles: admin/manager/worker/viewer) → `Hog` → child records (`FeedRecord`, `HealthRecord`, `BreedingCycle`, `Vaccination`, `MortalityEvent`, `Alert`/`AlertRule`). Every table below `Farm` carries a `farm_id`, and every query is scoped by it — this is a multi-tenant system, with each farm's data fully isolated from every other farm's.

`Hog` also carries `dam_id`/`sire_id` (self-FKs to `hogs.id`). Hogs can be created and edited from the web dashboard, which is what makes lineage recordable at all — the dam picker offers only sows and gilts, the sire picker only boars, and neither offers the animal itself. The mobile app deliberately ships no hog-create screen (see FAQ). New farms default to `Africa/Lagos` and `NGN` as of migration `m5_006` (current Alembic head).

## API conventions

- List endpoints return a `Page[T]` envelope (items + pagination metadata), never a bare array.
- Every query is scoped to the caller's `farm_id`.
- Accessing another farm's record returns **404, not 403** — see FAQ.
- CSV export streams the response rather than building it in memory; nine record types export, including vaccinations and mortality events.
- "Today" is computed in the farm's own timezone, not the server's. The web dashboard caps date inputs against the server's `farm_today(timezone)`; the mobile app instead reads `date_to` straight off `GET /dashboard/kpis` rather than computing it on-device, since a shared barn phone's clock isn't trustworthy.
- Lineage is validated in the endpoint, not the schema: a dam must be female, a sire male, no animal is its own parent or older than one, and `PATCH` distinguishes an omitted field from an explicit `null` so a parent recorded in error can be cleared.
- Manager-side account/farm management: `PATCH /users/{id}` changes a colleague's role (worker ⇄ viewer only — a manager cannot create or demote another manager), and `PATCH /farms/me` renames the farm (name only; currency and timezone stay fixed once set, since feed records store currency at write time for historical accuracy).
- The production-class distribution and feed-cost series both accept a `breed` filter. The breed distribution deliberately does not — it's the source of the filter's own options, so narrowing it to the current selection would leave the dropdown holding one option and no way back.
- `GET` on mortality, breeding and alerts is open to every role; only the writes are gated by `require_not_viewer`/`require_manager`. This asymmetry is what lets the mobile app show a locked-but-still-readable screen instead of hiding the screen outright (see FAQ).

## Caching / cache invalidation

No Redis. Postgres statement-level triggers increment a per-farm `data_versions` counter whenever relevant tables change; API responses use that counter as an ETag, so a client's `If-None-Match` gets a 304 when nothing has actually changed for that farm. ETags apply only to `/dashboard/*` reads — the mobile app hits one of these routes but does no ETag handling of its own, since React Native's `fetch` has no shared HTTP cache to hold a validator.

## Auth model

JWT (via PyJWT) with Argon2 password hashing.

**Web:** the browser never holds a token directly — it's a thin **BFF (backend-for-frontend)** pattern: the browser only ever talks to Next.js routes (`src/app/api/auth/*`, `src/app/api/backend/[...path]`), which hold the session in an httpOnly cookie and proxy every request server-side to FastAPI. There is intentionally no public API base URL exposed to client-side code.

**Mobile:** there is no BFF, because a phone has no server to run one on. The token attach and the single-flight 401-refresh-and-replay both live in the client (`mobile/src/lib/api/client.ts`), with tokens held in SecureStore (Android Keystore-backed) rather than a cookie. Four concurrent 401s collapse into exactly one `/auth/refresh` call, and each request replays once; a second 401 is terminal. A network failure during refresh does not clear the stored tokens — being offline is not treated as an invalid session. The app also proactively refreshes on `AppState → active` when the token is within five minutes of expiry, so the first action after the phone wakes doesn't spend a visible failed round trip — verified after a real 36-minute sleep, with four simultaneous 401s collapsing to exactly one refresh.

## Migrations

Alembic owns the schema; migrations **never run at application startup**. A one-shot `migrate` step (either `make migrate` or the compose `migrate` service) applies them before the API starts — this avoids multiple API workers racing to migrate concurrently on boot.

## Testing strategy

93 backend tests (pytest, against a real Postgres database — they skip rather than fail if Postgres is unreachable), 25 dashboard tests (Vitest + jsdom), and 92 mobile tests (Vitest, node environment, over `mobile/src/`) — **210 in total**. Any mobile module with a `.test.ts` beside it must import neither `react-native` nor `expo-*`; platform access is injected through `mobile/src/api-runtime.ts` so the tests run without a renderer. `make check` runs lint, typecheck, and all three suites — exactly what the project's quality gate runs.

Unit tests are one leg, not the whole story, for mobile: they were originally the only evidence the app worked at all, but that gap is now closed by actual on-device runs (see Architecture layers and FAQ). Two tracks cover on-device verification going forward: an Android emulator plus a locally built dev client for day-to-day iteration, and a universal `assembleRelease` APK — one build covering all four ABIs — sideloaded onto a physical phone for periodic checks. Neither track uses Expo Go.

## Technical FAQ

**Why Postgres-only, no SQLite, despite the original spec allowing it?**
The two databases had drifted apart in ways that mattered: partial vs. full unique indexes, different default values, missing `CHECK` constraints, and — critically — `DateTime(timezone=True)` is only honest on Postgres, since SQLite silently stores naive datetimes. Rather than maintain two subtly different data layers, SQLite was dropped entirely.

**Why does cross-farm access return 404 instead of 403?**
A 403 confirms the record exists but is forbidden — that's still information leakage across tenants. Returning 404 for both "doesn't exist" and "exists but isn't yours" leaks nothing about other farms' data.

**How does cache invalidation work without Redis?**
Postgres statement-level triggers increment a `data_versions` counter per farm on write. Responses use that counter as an ETag, checked via `If-None-Match`, so no separate cache layer or invalidation logic is needed.

**Why do migrations never run at application startup?**
Running Alembic inside the API process means every worker (there are multiple Uvicorn workers) would try to migrate concurrently at boot. A one-shot `migrate` step runs to completion first, and the API only starts once it succeeds.

**What's the thin-BFF pattern, and why proxy auth through Next.js instead of the browser calling the API directly?**
Session tokens live in httpOnly cookies set by Next.js server routes, never in `localStorage` or client-side JavaScript. The browser holds no credential it could leak via XSS, and there's no client-side session state that can silently go stale. This pattern is specific to the web dashboard, though — a phone has no server of its own to host a BFF on, so the mobile app instead keeps tokens in SecureStore and does the token-attach and refresh logic client-side (see Auth model above).

**Has the mobile app actually been run and verified on a device?**
Yes, on two: an Android emulator (Pixel 7 profile, API 34) and a physical Samsung A54 5G. The emulator pass exercised eight of nine planned manual verification steps, including the one that matters most — a weigh-in recorded on the device repainting the web dashboard's growth chart with no reload, via the same Postgres trigger the dashboard itself watches. The phone pass then confirmed the same write path over USB sideload and validated the second, arm64-specific concern: real touch ergonomics and device performance, which an x86_64 emulator can't speak to. Both passes used a locally built dev client or a release APK rather than Expo Go. **The one thing still unconfirmed is Expo Go itself on real hardware** — it was never tried on the phone, only on the emulator, where it's known to crash (`SIGSEGV` in `libworklets.so` over `libhermesvm.so`, reproducible with a bare `<View><Text>` root, so it's an environment fault rather than an app bug). Two things surfaced only once real screens were watched paint, not by the test suite: a broken staff roster (it treated a paginated envelope as a bare array) and a genuine cold-open cache bug, where a failed background refetch masks last-known data instead of showing it — both recorded rather than assumed away.

**Is the FCR (feed conversion ratio) calibration gap noted in STATUS.md still present, and is it a bug?**
Still present, and still not a bug. Against the current bulk seed, FCR lands at ~4.27 against the 2.5–3.2 band the seeding plan aimed for. This is a seed-data calibration issue — the KPI computes correctly on the data it's given — and is deliberately out of scope: seeding exists to make the UI demonstrable, and what has to be correct is the path real, user-entered data travels, which was verified separately against hand-entered records.

**Does the demo farm still have zero mortality events, per STATUS.md's seed-data gaps?**
Yes. The bulk seed produces only 2 mortality events across all five seeded farms, and neither lands on Bright Acres Farm (the demo farm), so its mortality tile reads 0.0%. The feature itself works — CRUD, the page, and the export all function on both web and mobile — there's just no seeded data to show on that particular farm.

**Is hog lineage (`dam_id`/`sire_id`) still empty in bulk-seeded data?**
Yes, in the seeder output specifically — no bulk-seeded hog carries lineage. But the underlying gap this used to represent (lineage being unreachable, not merely unseeded) is closed: the web dashboard has a hog create/edit form with dam/sire pickers, the API enforces sex, self-reference, and birth-order rules, and lineage works end to end when entered by hand — verified via the UI, with Dam/Sire columns visible by default in the roster and resolved to ear tags on the detail page. The mobile app deliberately ships no hog-create screen at all: a new litter needs breed, sex, production class and optional dam/sire, which the dashboard already does well as a desk task, so mobile doesn't duplicate it.

**Is the settings page still read-only?**
No — this gap is closed, on both clients. A manager can rename the farm (`PATCH /farms/me`), add staff, and change a colleague's role between worker and viewer (`PATCH /users/{id}`) from the web dashboard's settings page, and the mobile app's manager surfaces (staff management, farm rename) mirror the same endpoints. What remains fixed by design rather than by omission: a manager cannot create or demote another manager (no code path can promote anyone back to manager, so an unguarded demotion would leave a farm without an administrator), and the farm's currency and timezone are not editable once set, since feed records store currency at write time and changing timezone would silently reinterpret what "today" meant for existing records.
