SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose
BACKEND := backend
WEB     := web-dashboard
PG_USER := $(or $(POSTGRES_USER),hogfarm)
PG_DB   := $(or $(POSTGRES_DB),hogfarm)

# Host-side targets (api, migrate, seed) need DATABASE_URL and JWT_SECRET.
# Loading .env here means they are not re-exported on every command line.
# Compose reads .env on its own, so container services are unaffected.
ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: help env-check install db-up db-down db-wait psql db-reset migrate migrate-down \
        revision seed seed-bulk seed-reset api web up up-all down logs build ps lint fmt \
        typecheck test check types build-web clean

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

install: ## Install backend (uv) and dashboard (npm) dependencies
	cd $(BACKEND) && uv sync --all-groups
	cd $(WEB) && npm ci

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

## --------------------------------------------------------------- run ----

api: env-check ## Run the API with autoreload on :8000
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --port 8000

web: ## Run the web dashboard dev server
	cd $(WEB) && npm run dev

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

## ----------------------------------------------------------- quality ----

lint: ## Lint backend and dashboard
	cd $(BACKEND) && uv run ruff check .
	cd $(WEB) && npx eslint .

fmt: ## Format backend and dashboard
	cd $(BACKEND) && uv run ruff format . && uv run ruff check --fix .
	cd $(WEB) && npx prettier --write .

typecheck: ## Typecheck backend (mypy) and dashboard (tsc)
	cd $(BACKEND) && uv run mypy .
	cd $(WEB) && npx tsc --noEmit

test: ## Run the backend and dashboard test suites
	cd $(BACKEND) && uv run pytest -q
	cd $(WEB) && npx vitest run

check: lint typecheck test ## Run everything the Stop-hook quality gate runs

types: ## Regenerate dashboard API types from the running backend's OpenAPI document
	@curl -sf http://127.0.0.1:8000/openapi.json >/dev/null \
		|| { echo "ERROR: the API must be running. Start it with: make api"; exit 1; }
	cd $(WEB) && npm run types

build-web: ## Production build of the dashboard (run before `tsc` — it generates .next/types)
	cd $(WEB) && npm run build

clean: ## Remove caches and build artefacts
	rm -rf $(BACKEND)/.mypy_cache $(BACKEND)/.pytest_cache $(BACKEND)/.ruff_cache
	rm -rf $(WEB)/.next $(WEB)/*.tsbuildinfo
	find . -name '__pycache__' -type d -not -path './*/node_modules/*' -prune -exec rm -rf {} +
