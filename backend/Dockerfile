# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Build wheels once, then install them into the slim runtime image.
# ---------------------------------------------------------------------------
FROM base AS builder

COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install --upgrade pip \
    && pip wheel --wheel-dir /wheels .

# ---------------------------------------------------------------------------
# Development target: editable install with test/lint tooling.
# Source is bind-mounted by docker-compose.dev.yml.
# ---------------------------------------------------------------------------
FROM base AS development

COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install --upgrade pip \
    && pip install -e ".[dev]"

COPY alembic.ini ./
COPY alembic ./alembic
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------------------------------------------------------------------------
# Production runtime.
# ---------------------------------------------------------------------------
FROM base AS runtime

RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --create-home app

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*.whl && rm -rf /wheels

COPY alembic.ini ./
COPY alembic ./alembic
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --workers ${WEB_CONCURRENCY:-2}"]
