#!/bin/sh
set -eu

# Wait for the database and apply migrations before the API starts. Compose
# already gates on the Postgres healthcheck, but this retry loop also covers
# plain `docker run` and rolling deployments.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  attempt=1
  max_attempts="${MIGRATION_MAX_ATTEMPTS:-30}"
  until alembic upgrade head; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "alembic upgrade failed after ${attempt} attempts" >&2
      exit 1
    fi
    echo "database not ready for migrations (attempt ${attempt}/${max_attempts}); retrying in 2s" >&2
    attempt=$((attempt + 1))
    sleep 2
  done
fi

exec "$@"
