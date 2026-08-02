# Start here

A from-zero setup guide for provisioning this repo on your own machine. For the full Makefile
target reference see the root [`README.md`](../README.md); for what the app actually does, see
[`how_it_works_(non-technical).md`](how_it_works_(non-technical).md) or
[`how_it_works_(technical).md`](how_it_works_(technical).md).

## 1. Before you start

Budget about 10-15 minutes, most of it spent waiting on Docker pulls. Have Docker running before
step 4 — everything from `make db-up` onward needs it.

## 2. Operating system setup

**Windows** — install WSL2 first, then run everything below inside it (not native PowerShell):
1. Open PowerShell **as Administrator** and run:
   ```
   wsl --install
   ```
   On a fresh machine this single command enables the WSL2 platform and installs the default
   Ubuntu distro together — no separate "enable WSL2" step. Restart when prompted.
2. Verify: `wsl -l -v` should list your distro with `VERSION` = `2`.
3. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/), then
   enable **WSL Integration** for your distro in Docker Desktop → Settings → Resources → WSL
   Integration.
4. Open your distro (e.g. "Ubuntu" from the Start menu) and continue with step 3 below, inside
   that shell.

**macOS** — install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/),
then continue with step 3.

**Linux** — nothing extra; continue with step 3.

## 3. Prerequisite software

| Tool | Why | Verify it's installed |
|---|---|---|
| git | clone the repo | `git --version` |
| Docker + Compose v2 | runs Postgres, and optionally the whole stack | `docker compose version` (must report v2 — this repo does not use the standalone `docker-compose` binary) |
| `make` | drives every workflow in this repo | `make --version` |
| `tmux` | the standard way `make dev` runs the stack | `tmux -V` (if truly unavailable, `make api` and `make web` in two separate shells is the fallback) |
| `uv` | manages the backend's Python 3.12 environment | `uv --version` — check at install time whether your platform needs Python 3.12 preinstalled or whether `uv` fetches it for you |
| Node.js via [nvm](https://github.com/nvm-sh/nvm) | runs the dashboard and mobile dev servers | `cd web-dashboard && nvm install` (picks up the pinned version from `.nvmrc`, currently `25.7`; `mobile/.nvmrc` pins the same `25.7`) |
| npm | comes bundled with Node | `npm --version` |
| `adb` (optional) | sideload/inspect the mobile app on a physical Android phone | comes with [Android Studio](https://developer.android.com/studio) or the standalone [platform-tools](https://developer.android.com/tools/releases/platform-tools) package; `adb devices -l` |

Not needed: a host `psql` client (`make psql` runs it inside the container) or a standalone Python
install.

## 4. Clone and configure

```bash
git clone <this-repo-url>
cd louis-hog-farm
cp .env.example .env
```

Generate a `JWT_SECRET` and paste it into `.env`:

```bash
openssl rand -hex 32
```

No `openssl`? Any random string of 32+ characters works. `DATABASE_URL` in `.env.example` already
points at the local Docker Postgres service — leave it as-is unless port 5432 is taken on your
machine.

If you plan to try the mobile app, also copy its env file — note it lives **inside `mobile/`**,
not the repo root, because that is where Expo reads `.env` from:

```bash
cp mobile/.env.example mobile/.env
```

It holds a single variable, `EXPO_PUBLIC_API_URL`. Left blank it's fine for the emulator/dev-client
workflow (the app falls back to whatever host served the Metro bundle); the release-APK sideload
workflow bakes in a server address at build time, changeable at runtime from the app itself. See
step 7 for both workflows.

## 5. Install, provision the database, migrate

```bash
make install                # uv sync --all-groups + npm ci (web-dashboard and mobile)
make db-up && make migrate  # Postgres in Docker, schema via Alembic
```

## 6. Seed data

Recommended — the bulk profile, for a dataset large enough to actually explore:

```bash
make seed-bulk               # 5 farms × 60 hogs × 90 days, ~27k feed rows, ~12s
```

Optional — a single lighter farm instead:

```bash
make seed                    # 1 farm, 20 hogs, 90 days
```

(`--profile demo` always seeds exactly 1 farm/20 hogs, regardless of any `--farms`/`--hogs` flags.)

## 7. Start the dev environment

```bash
make dev
```

Boots the database, waits for it, applies migrations, then opens a tmux session named `hogfarm`:
- **`stack` window** — API pane (`make api`, autoreload, `:8000`, bound to `0.0.0.0` so a phone on
  the LAN can reach it), dashboard pane (`make web`, `:3000`), and a pane following
  `docker compose logs -f db`.
- **`db` window** — a `psql` shell into the database.
- **`shell` window** — a spare empty prompt.

Running `make dev` again just attaches to the existing session instead of starting a second copy
on the same ports. `make dev-stop` kills the tmux session only — the database container keeps
running.

**Logins** (password is the same across every seeded manager — `Bright123!`):

| Farm | Email |
|---|---|
| Bright Acres Farm (demo, and farm 1 of bulk) | `manager@brightacres.com` |
| Green Valley Piggery (bulk) | `manager@greenvalleypiggery.com` |
| Riverbend Livestock (bulk) | `manager@riverbendlivestock.com` |
| Kano Highlands Farm (bulk) | `manager@kanohighlandsfarm.com` |
| Oak Ridge Swine Co. (bulk) | `manager@oakridgeswineco.com` |
| Sunrise Agro Farms (bulk) | `manager@sunriseagrofarms.com` |

Note: a `viewer@brightacres.com` / `Viewer123!` read-only account is mentioned elsewhere in this
project's history, but it is **not created by the seed command** — a fresh provision only gets
manager accounts unless you create a viewer user yourself.

**Local testing helpers** (both need the db container up — `make db-up` if it isn't already):

- `make farm-users ID=7` — looks up a farm's users and their emails/roles with a one-off query
  inside the db container, the same no-host-client pattern as `make psql`.
- `make delete-farm NAME="Acme Test Farm"` (or `ID=7`) — deletes a farm and everything that
  references it (alerts, alert rules, vaccinations, mortality events, breeding cycles, feed
  records, health records, hogs, users), since only `data_versions` cascades at the DB level from
  `farms`. It prints row counts per table and asks for confirmation before deleting; the Makefile
  target itself doesn't expose a `--yes` skip-confirmation flag. Handy for throwing away a farm
  you created while testing without a full `make db-reset`.

### Mobile app (optional)

The mobile app has been verified end-to-end both on an Android emulator and on a physical Android
phone (a Samsung A54 5G). Two workflows are supported; sideloading a release APK onto a real phone
is the one to reach for as a reviewer — it needs no Android Studio/emulator setup on your machine,
just a phone and a USB cable (or Wi-Fi for repeat use).

**Note:** plain **Expo Go** (the Play Store app) crashes on x86_64 Android emulators — a confirmed
emulator/Expo Go interaction, not an app bug — and was not tried on the physical phone either, so
it is not a recommended path here. Both workflows below go around it.

**1. Sideload a release APK onto a physical phone (recommended for reviewers)**

```bash
cd mobile/android && ./gradlew assembleRelease
```

This produces one universal APK covering all four Android ABIs (arm64-v8a, armeabi-v7a, x86,
x86_64), already signed with the debug keystore so it installs directly with no separate signing
step: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

Install it either over USB —

```bash
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
```

— or by copying the APK to the phone some other way (file share, email, cloud drive) and opening
it; the phone will need "install from unknown sources" allowed for whatever app opens it.

The phone must be on the same Wi-Fi/LAN as the machine running `make dev`. Cleartext `http://`
traffic to the backend is allowed even in this release build (`mobile/app.json` sets
`expo-build-properties` → `android.usesCleartextTraffic: true`). If the backend's LAN IP ever
doesn't match what was baked into the build, use the in-app "Change server address" screen
(Settings, or the "Change" link on the sign-in screen) to point it at a new address with no
rebuild needed.

**2. Emulator + dev client (day-to-day iteration)**

One-time per emulator AVD, with the emulator running:

```bash
cd mobile && npx expo run:android   # builds and installs a dev client; slow on first run (Gradle/NDK)
```

After that, day-to-day iteration is:

```bash
adb reverse tcp:8000 tcp:8000 && adb reverse tcp:8081 tcp:8081   # once per emulator boot
# with `make dev` already running:
cd mobile && npx expo start --dev-client
```

**Linux only — phone invisible to `adb`.** If `adb devices -l` shows nothing after plugging in a
phone with USB debugging enabled, but `lsusb` sees it, you're missing a udev rule. Add one to
`/etc/udev/rules.d/` (Samsung's vendor id is `04e8`):

```
SUBSYSTEM=="usb", ATTR{idVendor}=="04e8", MODE="0666", GROUP="plugdev"
```

Then `sudo udevadm control --reload-rules && sudo udevadm trigger` and unplug/replug the cable.

A fresh clone that runs `make typecheck` before ever starting Metro/a dev client once can show
errors from a missing generated `mobile/expo-env.d.ts` file — running `make mobile`, `npx expo
run:android`, or `npx expo start --dev-client` once generates it and the errors go away.

## 8. If something goes wrong

- **`tmux: command not found`** — run `make api` and `make web` in two separate terminals instead.
- **Docker image pulls hang or fail** — registry DNS can be flaky in some environments; retry
  before investigating further.
- **Port already in use (5432, 8000, or 3000)** — free the port, or override `POSTGRES_PORT` in
  `.env`.
- **`.env` errors from `make dev`/`make migrate`** — `make env-check` requires `JWT_SECRET` to be
  32+ characters and `DATABASE_URL` to start with `postgresql`; the error message names exactly
  which one failed.
- **Phone can't reach the API** — first check `http://<lan-ip>:8000/health` in the *phone's own
  browser*; if that fails nothing in the app can work either. Usual causes: a host firewall
  (`sudo ufw allow 8000` on Linux), the phone and computer being on different networks (mobile
  data instead of wifi, or a guest wifi network), or router AP-isolation between devices.
- **`make typecheck` fails in `mobile/` on a fresh clone** — run `make mobile` once to generate
  `mobile/expo-env.d.ts`, then retry.

## Where next

- [`README.md`](../README.md) — full list of Makefile targets (`make help`), test suite, stack
  overview.
- [`how_it_works_(non-technical).md`](how_it_works_(non-technical).md) — what the app does, in
  plain language.
- [`how_it_works_(technical).md`](how_it_works_(technical).md) — architecture and design
  decisions.
