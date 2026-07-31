# Start here

A from-zero setup guide for provisioning this repo on your own machine. Takes about 10-15 minutes, most of it spent waiting on Docker. For the full Makefile target reference see the root [`README.md`](../README.md); for what the app actually does, see [`how_it_works_(non-technical).md`](how_it_works_(non-technical).md) or [`how_it_works_(technical).md`](how_it_works_(technical).md).

## 1. Operating system setup

**Windows** — install WSL2 first, then run everything below inside it (not native PowerShell):
1. Open PowerShell **as Administrator** and run:
   ```
   wsl --install
   ```
   This installs WSL2 and Ubuntu together on Windows 10 (build 19041+) or Windows 11 — no separate "enable WSL2" step needed on a fresh install. Restart when prompted.
2. Verify: `wsl -l -v` should list your distro with `VERSION` = `2`.
3. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/), then enable **WSL Integration** for your distro in Docker Desktop → Settings → Resources → WSL Integration.
4. Open your distro (e.g. "Ubuntu" from the Start menu) and continue with step 2 below, inside that shell.

**macOS** — install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/), then continue with step 2.

**Linux** — nothing extra; continue with step 2.

## 2. Prerequisite software

| Tool | Why | Verify it's installed |
|---|---|---|
| git | clone the repo | `git --version` |
| Docker + Compose v2 | runs Postgres, and optionally the whole stack | `docker compose version` (must report v2 — this repo does not use the standalone `docker-compose` binary) |
| `make` | drives every workflow in this repo | `make --version` |
| `tmux` | the standard way `make dev` runs the stack | `tmux -V` (if truly unavailable, `make api` and `make web` in two separate shells is the fallback) |
| `uv` | manages the backend's Python 3.12 environment | `uv --version` — check at install time whether your platform needs Python 3.12 preinstalled or whether `uv` fetches it for you |
| Node.js via [nvm](https://github.com/nvm-sh/nvm) | runs the dashboard dev server | `cd web-dashboard && nvm install` (picks up the pinned version from `.nvmrc`, currently `25.7`) |
| npm | comes bundled with Node | `npm --version` |

Not needed: a host `psql` client (`make psql` runs it inside the container) or a standalone Python install.

## 3. Clone and configure

```bash
git clone <this-repo-url>
cd louis-hog-farm
cp .env.example .env
```

Generate a `JWT_SECRET` and paste it into `.env`:

```bash
openssl rand -hex 32
```

No `openssl`? Any random string of 32+ characters works. `DATABASE_URL` in `.env.example` already points at the local Docker Postgres service — leave it as-is unless port 5432 is taken on your machine.

## 4. Install, provision the database, migrate

```bash
make install                # uv sync --all-groups + npm ci
make db-up && make migrate  # Postgres in Docker, schema via Alembic
```

## 5. Seed data

Recommended — the bulk profile, for a dataset large enough to actually explore:

```bash
make seed-bulk               # 5 farms × 60 hogs × 90 days, ~27k feed rows, ~12s
```

Optional — a single lighter farm instead:

```bash
make seed                    # 1 farm, 20 hogs (1 boar, 2 sows, 3 growers, 14 piglets), 90 days
```

(`--profile demo` always seeds exactly 1 farm/20 hogs, regardless of any `--farms`/`--hogs` flags.)

## 6. Start the dev environment

```bash
make dev
```

Opens a tmux session named `hogfarm`:
- **`stack` window** — API pane (`make api`, autoreload, `:8000`), dashboard pane (`make web`, `:3000`), and a pane following `docker compose logs -f db`.
- **`db` window** — a `psql` shell into the database.
- **`shell` window** — a spare empty prompt.

Running `make dev` again just attaches to the existing session instead of starting a second copy. `make dev-stop` kills the tmux session only — the database container keeps running.

**Logins** (password is the same across every seeded manager — `Bright123!`):

| Farm | Email |
|---|---|
| Bright Acres Farm (demo, and farm 1 of bulk) | `manager@brightacres.com` |
| Green Valley Piggery (bulk) | `manager@greenvalleypiggery.com` |
| Riverbend Livestock (bulk) | `manager@riverbendlivestock.com` |
| Kano Highlands Farm (bulk) | `manager@kanohighlandsfarm.com` |
| Oak Ridge Swine Co. (bulk) | `manager@oakridgeswineco.com` |
| Sunrise Agro Farms (bulk) | `manager@sunriseagrofarms.com` |

Note: a `viewer@brightacres.com` / `Viewer123!` read-only account is mentioned elsewhere in this project's history, but it is **not created by the seed command** — a fresh provision only gets manager accounts unless you create a viewer user yourself.

**Local testing helpers** (both need the db container up — `make db-up` if it isn't already):

- `make farm-users ID=7` — looks up a farm's users and their emails/roles with a one-off query inside the db container, the same no-host-client pattern as `make psql`.
- `make delete-farm NAME="Acme Test Farm"` (or `ID=7`) — deletes a farm and everything that references it (alerts, alert rules, vaccinations, mortality events, breeding cycles, feed records, health records, hogs, users), since only `data_versions` cascades at the DB level from `farms`. It prints row counts per table and asks for confirmation before deleting; the Makefile target itself doesn't expose a `--yes` skip-confirmation flag. Handy for throwing away a farm you created while testing without a full `make db-reset`.

## 7. If something goes wrong

- **`tmux: command not found`** — run `make api` and `make web` in two separate terminals instead.
- **Docker image pulls hang or fail** — registry DNS can be flaky in some environments; retry before investigating further.
- **Port already in use (5432, 8000, or 3000)** — free the port, or override `POSTGRES_PORT` in `.env`.
- **`.env` errors from `make dev`/`make migrate`** — `make env-check` requires `JWT_SECRET` to be 32+ characters and `DATABASE_URL` to start with `postgresql`; the error message names exactly which one failed.

## Where next

- [`README.md`](../README.md) — full list of Makefile targets (`make help`), test suite, stack overview.
- [`how_it_works_(non-technical).md`](how_it_works_(non-technical).md) — what the app does, in plain language.
- [`how_it_works_(technical).md`](how_it_works_(technical).md) — architecture and design decisions.
