# syntax=docker/dockerfile:1

# --- builder -----------------------------------------------------------------
# Dependencies are installed from uv.lock, so the image and the local .venv
# resolve to identical versions. This replaces `pip install -r requirements.txt`,
# which made requirements.txt a second, silently-drifting source of truth.
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /src

# Its own layer: rebuilt only when the dependency manifest changes, not on
# every source edit.
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# --- runtime -----------------------------------------------------------------
# python:3.12-slim, matching requires-python = "==3.12.*". The previous 3.11 base
# meant the container ran a different interpreter than every local check.
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    TZ=UTC

# libpq5 is deliberately absent: psycopg2-binary bundles its own libpq.
RUN useradd --create-home --uid 10001 hogfarm

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=hogfarm:hogfarm backend/ /app/

USER hogfarm

EXPOSE 8000

# Migrations are not run here — a one-shot `migrate` service owns that, so
# multiple workers cannot race at boot.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
