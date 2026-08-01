SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose
BACKEND := backend
WEB     := web-dashboard
MOBILE  := mobile
PG_USER := $(or $(POSTGRES_USER),hogfarm)
PG_DB   := $(or $(POSTGRES_DB),hogfarm)

# Host-side targets (api, migrate, seed) need DATABASE_URL and JWT_SECRET.
# Loading .env here means they are not re-exported on every command line.
# Compose reads .env on its own, so container services are unaffected.
ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: help env-check install db-up db-down db-wait psql farm-users db-reset migrate migrate-down \
        revision seed seed-bulk seed-reset delete-farm api web mobile up up-all down logs build ps \
        lint fmt typecheck test check types build-web dev dev-stop clean

TMUX_SESSION := hogfarm

## ---------------------------------------------------------------- help ----

help: ## List available targets
	@echo "Hog Farm — make targets"
	@echo
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo

env-check: ## Verify .env exists and carries the required values
	@test -f .env || { echo "ERROR: .env is missing. Run: cp .env.example .env"; exit 1; }
	@grep -qE '^JWT_SECRET=.{32,}' .env \
		|| { echo "ERROR: JWT_SECRET in .env must be >= 32 chars (openssl rand -hex 32)"; exit 1; }
	@grep -qE '^DATABASE_URL=postgresql' .env \
		|| { echo "ERROR: DATABASE_URL in .env must be a postgresql:// URL"; exit 1; }
	@echo ".env OK"

## ------------------------------------------------------------- setup ----

install: ## Install backend (uv), dashboard and mobile (npm) dependencies
	cd $(BACKEND) && uv sync --all-groups
	cd $(WEB) && npm ci
	cd $(MOBILE) && npm ci

## ---------------------------------------------------------- database ----

db-up: ## Start PostgreSQL in the background
	$(COMPOSE) up -d db

db-down: ## Stop PostgreSQL (data is preserved)
	$(COMPOSE) stop db

db-wait: ## Block until PostgreSQL accepts connections
	@echo "waiting for postgres..."
	@until $(COMPOSE) exec -T db pg_isready -U $(PG_USER) -d $(PG_DB) >/dev/null 2>&1; do \
		sleep 0.5; \
	done
	@echo "postgres ready"

psql: ## Open a psql shell (runs inside the db container; no host client needed)
	$(COMPOSE) exec db psql -U $(PG_USER) -d $(PG_DB)

farm-users: ## List a farm's users and emails: make farm-users ID=7
	@test -n "$(ID)" || { echo 'ERROR: pass a farm id, e.g. make farm-users ID=7'; exit 1; }
	$(COMPOSE) exec db psql -U $(PG_USER) -d $(PG_DB) -c \
		"SELECT u.email, u.full_name, u.role FROM users u JOIN farms f ON f.id = u.farm_id WHERE f.id = $(ID);"

db-reset: ## DESTRUCTIVE — drop the volume, recreate, migrate and seed
	$(COMPOSE) down -v
	$(MAKE) db-up db-wait migrate seed

## --------------------------------------------------------- migrations ----

migrate: env-check ## Apply all pending migrations
	cd $(BACKEND) && uv run alembic upgrade head

migrate-down: env-check ## Roll back one migration
	cd $(BACKEND) && uv run alembic downgrade -1

revision: env-check ## Autogenerate a migration:  make revision m="add widget table"
	@test -n "$(m)" || { echo 'ERROR: pass a message, e.g. make revision m="add widget"'; exit 1; }
	cd $(BACKEND) && uv run alembic revision --autogenerate -m "$(m)"

seed: env-check ## Load the demo herd (1 farm, 20 hogs, 90 days)
	cd $(BACKEND) && uv run python -m app.seed --profile demo --days $(or $(DAYS),90)

seed-bulk: env-check ## Load a large backdated dataset: make seed-bulk FARMS=5 HOGS=60 DAYS=90
	cd $(BACKEND) && uv run python -m app.seed --profile bulk \
		--farms $(or $(FARMS),5) --hogs $(or $(HOGS),60) --days $(or $(DAYS),90)

seed-reset: env-check ## Re-seed, wiping each seeded farm's existing records first
	cd $(BACKEND) && uv run python -m app.seed --profile demo --reset

delete-farm: env-check ## Delete a farm and all its data: make delete-farm NAME="Acme Test Farm" (or ID=7)
	cd $(BACKEND) && uv run python -m app.admin_tools.delete_farm \
		$(if $(ID),--id $(ID),--name "$(NAME)")

## --------------------------------------------------------------- run ----

# `--host 0.0.0.0`, not uvicorn's default 127.0.0.1: the mobile app runs on a
# phone, which reaches this machine over the LAN. Bound to loopback the phone
# gets connection-refused, and React Native surfaces that as a bare "Network
# request failed" with no status code to diagnose from. Dev target only —
# the container path in docker-compose.yml is unaffected.
api: env-check ## Run the API with autoreload on :8000, reachable from the LAN
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web: ## Run the web dashboard dev server
	cd $(WEB) && npm run dev

# Deliberately not a `make dev` pane. Metro owns the terminal (it wants the `r`
# / `j` keypresses), the phone workflow is its own loop, and `make dev`'s port
# guard covers 8000/3000 only — adding 8081 there would make `make dev` refuse
# to start whenever a perfectly healthy Metro is already running elsewhere.
mobile: ## Run the Expo dev server (Metro on :8081) for Expo Go
	cd $(MOBILE) && npx expo start

up: ## Build and start the full stack in containers (db + migrate + api)
	$(COMPOSE) up -d --build

up-all: ## As `up`, plus Adminer on :8080
	$(COMPOSE) --profile tools up -d --build

down: ## Stop all containers (data is preserved)
	$(COMPOSE) down

build: ## Rebuild container images
	$(COMPOSE) build

logs: ## Follow container logs
	$(COMPOSE) logs -f

ps: ## Show container status
	$(COMPOSE) ps

## ---------------------------------------------------------- dev loop ----

dev: env-check ## Boot the whole stack in tmux: db, migrations, API, dashboard, psql
	@command -v tmux >/dev/null \
		|| { echo "ERROR: tmux is not installed. Use 'make api' and 'make web' in two shells."; exit 1; }
	@# Idempotent: a second `make dev` attaches to the running session rather
	@# than stacking a second copy of every process on the same ports.
	@if tmux has-session -t $(TMUX_SESSION) 2>/dev/null; then \
		echo "session '$(TMUX_SESSION)' already running — attaching"; \
		exec tmux attach -t $(TMUX_SESSION); \
	fi
	@# The tmux-session check above only catches a second `make dev`. It says
	@# nothing about a process started outside tmux — a stray `make api`,
	@# `make web`, or a manual uvicorn — still holding 8000 or 3000. Left
	@# running, that leaves the API or web pane dying on "Address already in
	@# use" while this recipe still echoes success below. Fail fast here with
	@# a diagnosis instead of a silently dead pane.
	@for p in 8000 3000; do \
		if (exec 3<>/dev/tcp/127.0.0.1/$$p) 2>/dev/null; then \
			exec 3<&- 3>&-; \
			echo "ERROR: port $$p is already in use by something outside this session."; \
			echo "  Find it:  lsof -i :$$p   (or: ss -ltnp | grep :$$p)"; \
			echo "  Stop that process, then retry make dev."; \
			exit 1; \
		fi; \
	done
	@# Database and schema first, in this shell. A pane that dies because the
	@# migration had not finished scrolls away unread.
	$(MAKE) db-up db-wait migrate
	@tmux new-session  -d -s $(TMUX_SESSION) -n stack -c $(CURDIR)
	@tmux send-keys    -t $(TMUX_SESSION):stack 'make api' C-m
	@# `-l 40%`, not the older `-p 40`: tmux 3.x rejects `-p` here with a bare
	@# "size missing" that points nowhere near the flag that caused it.
	@tmux split-window -h -t $(TMUX_SESSION):stack -c $(CURDIR) -l 40%
	@tmux send-keys    -t $(TMUX_SESSION):stack 'make web' C-m
	@tmux split-window -v -t $(TMUX_SESSION):stack -c $(CURDIR)
	@tmux send-keys    -t $(TMUX_SESSION):stack '$(COMPOSE) logs -f db' C-m
	@tmux new-window   -t $(TMUX_SESSION) -n db -c $(CURDIR)
	@tmux send-keys    -t $(TMUX_SESSION):db 'make psql' C-m
	@tmux new-window   -t $(TMUX_SESSION) -n shell -c $(CURDIR)
	@tmux select-window -t $(TMUX_SESSION):stack
	@tmux select-pane  -t $(TMUX_SESSION):stack.0
	@echo "API on :8000, dashboard on :3000 — 'make dev-stop' to tear down"
	@exec tmux attach -t $(TMUX_SESSION)

dev-stop: ## Kill the tmux session (the database container keeps running)
	@tmux kill-session -t $(TMUX_SESSION) 2>/dev/null \
		&& echo "session '$(TMUX_SESSION)' stopped" \
		|| echo "no session '$(TMUX_SESSION)' running"

## ----------------------------------------------------------- quality ----

lint: ## Lint backend, dashboard and mobile
	cd $(BACKEND) && uv run ruff check .
	cd $(WEB) && npx eslint .
	cd $(MOBILE) && npx eslint .

fmt: ## Format backend, dashboard and mobile
	cd $(BACKEND) && uv run ruff format . && uv run ruff check --fix .
	cd $(WEB) && npx prettier --write .
	cd $(MOBILE) && npx prettier --write .

typecheck: ## Typecheck backend (mypy), dashboard and mobile (tsc)
	cd $(BACKEND) && uv run mypy .
	cd $(WEB) && npx tsc --noEmit
	cd $(MOBILE) && npx tsc --noEmit

test: ## Run the backend, dashboard and mobile test suites
	cd $(BACKEND) && uv run pytest -q
	cd $(WEB) && npx vitest run
	cd $(MOBILE) && npx vitest run

check: lint typecheck test ## Run everything the Stop-hook quality gate runs

types: ## Regenerate dashboard and mobile API types from the running backend's OpenAPI document
	@curl -sf http://127.0.0.1:8000/openapi.json >/dev/null \
		|| { echo "ERROR: the API must be running. Start it with: make api"; exit 1; }
	cd $(WEB) && npm run types
	cd $(MOBILE) && npm run types

build-web: ## Production build of the dashboard (run before `tsc` — it generates .next/types)
	cd $(WEB) && npm run build

clean: ## Remove caches and build artefacts
	rm -rf $(BACKEND)/.mypy_cache $(BACKEND)/.pytest_cache $(BACKEND)/.ruff_cache
	rm -rf $(WEB)/.next $(WEB)/*.tsbuildinfo
	rm -rf $(MOBILE)/.expo $(MOBILE)/*.tsbuildinfo
	find . -name '__pycache__' -type d -not -path './*/node_modules/*' -prune -exec rm -rf {} +
