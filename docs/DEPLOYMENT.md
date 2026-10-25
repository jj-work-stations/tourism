# Deployment guide

## Prerequisites

- Docker 24+ with Compose v2
- 2 CPU / 2 GB RAM minimum for the full stack
- A domain and TLS terminator (nginx, Caddy, Traefik or a cloud load balancer)

## Quick start

```bash
cp .env.example .env
# edit .env: set a strong JWT_SECRET_KEY and database password
docker compose up --build -d
docker compose ps
```

| URL | Service |
| --- | --- |
| <http://localhost:3000> | Next.js web app |
| <http://localhost:8000/docs> | OpenAPI documentation |
| <http://localhost:8000/health> | API health |
| <http://localhost:8080> | Optional nginx edge (`--profile gateway`) |

On first boot the backend waits for PostgreSQL, runs `alembic upgrade head`,
starts the API and seeds idempotent demo data. Demo accounts are listed in
`backend/README.md`; change or remove them before exposing the deployment.

Local development with hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# or run services directly:
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

## Configuration

All variables are documented in `.env.example`. The most important ones:

| Variable | Purpose | Production guidance |
| --- | --- | --- |
| `ENVIRONMENT` | `development`/`staging`/`production` | Set `production` |
| `JWT_SECRET_KEY` | Token signing key | 48+ random bytes, unique per environment |
| `POSTGRES_PASSWORD` | Database password | Strong, stored in a secret manager |
| `DATABASE_URL` | Backend connection string | Set by compose; use TLS/managed DB if external |
| `REDIS_URL` | Cache and rate-limit backend | Use a managed Redis with persistence |
| `AUTO_CREATE_SCHEMA` | `create_all` at startup | Must be `false` |
| `SEED_ON_STARTUP` | Demo data | `false` after the initial demo setup |
| `OTP_DEBUG` | Return OTP in API responses | `false` |
| `CORS_ORIGINS` | Direct API callers | Only your real web origins |
| `ALLOWED_HOSTS` | Trusted Host middleware | Your API hostnames |
| `NEXT_PUBLIC_SITE_URL` | Canonical/sitemap URLs | `https://your-domain` |
| `NEXT_PUBLIC_API_URL` | Browser API base | `/api/v1` (same origin) |
| `INTERNAL_API_URL` | Build-time Next rewrite target | `http://backend:8000/api/v1` |
| `AI_PROVIDER` | `openai`/`openai_compatible`/`anthropic`/`gemini`/`none` | `none` unless configured |
| `AI_API_KEY` | Provider key | Secret manager |
| `WEB_CONCURRENCY` | Uvicorn workers | 2–4 for a small VM; keep `1` during seeding |

Because `NEXT_PUBLIC_*` values are embedded in the client bundle at build time,
rebuild the frontend when they change:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

`INTERNAL_API_URL` is also consumed while generating Next's rewrite manifest,
so pass it as a build arg (compose already does).

## Database operations

```bash
# Apply migrations (also runs automatically on container start)
docker compose exec backend alembic upgrade head

# Create a migration after changing models
docker compose exec backend alembic revision --autogenerate -m "describe change"

# Roll back one revision
docker compose exec backend alembic downgrade -1

# Re-seed demo data (idempotent)
docker compose exec backend python -m app.db.seed

# Reset the demo database completely (DESTRUCTIVE)
docker compose down -v
docker compose up -d
```

Backups:

```bash
docker compose exec -T db pg_dump -U seir seir | gzip > seir-$(date +%F).sql.gz
gunzip -c seir-2026-01-01.sql.gz | docker compose exec -T db psql -U seir -d seir
```

Schedule backups off-host, encrypt them, and test restores regularly.

## Production checklist

1. Set `ENVIRONMENT=production`, a unique `JWT_SECRET_KEY`, and strong database
   and Redis credentials.
2. Disable `AUTO_CREATE_SCHEMA`, `SEED_ON_STARTUP` and `OTP_DEBUG`.
3. Put TLS in front of the app. The optional nginx profile is an HTTP edge; add
   certificates or terminate TLS at your cloud load balancer.
4. Set `ALLOWED_HOSTS` and `CORS_ORIGINS` to real domains.
5. Configure `AI_PROVIDER`, `AI_API_KEY` and `AI_MODEL` if AI narratives are
   required. Leave `none` for a fully local deployment.
6. Keep PostgreSQL and Redis on private networks; do not publish their ports.
   Remove the `ports` mappings for `db` and `redis` in compose, or bind them to
   `127.0.0.1`.
7. Add external monitoring for `/health/ready`, container restarts, disk usage
   and database connections.
8. Run the CI pipeline (`ruff`, `pytest`, `tsc`, `next build`, image builds)
   before every release.
9. Review the demo accounts and remove/rotate them for a real launch.
10. Configure log aggregation. Request logs include request IDs; forward them to
    your platform (Loki, CloudWatch, Datadog, etc.).

## Reverse proxy and TLS

The nginx edge can be enabled with:

```bash
docker compose --profile gateway up -d
```

It proxies `/api/`, `/docs` and `/redoc` to the backend and everything else to
Next.js, with gzip, request limits and basic security headers. For TLS, either
add certificates to this nginx service or place another proxy in front of it.

When serving from a real domain, build the frontend with:

```bash
NEXT_PUBLIC_SITE_URL=https://seir.example \
NEXT_PUBLIC_API_URL=/api/v1 \
docker compose build frontend
```

## Scaling notes

- The API is stateless; scale `backend` replicas behind the proxy. Keep
  `WEB_CONCURRENCY` moderate and size the database pool per replica.
- Run the booking-expiry loop in one worker/replica, or move it to a scheduled
  job if you scale out. With multiple workers it is safe (idempotent updates)
  but redundant.
- Redis is required for shared rate limits and cache coherence across replicas.
- Serve static Next assets from a CDN by fronting `/_next/static` at the edge.
- Use a managed PostgreSQL with connection pooling (PgBouncer) at scale.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Backend restarts immediately | `docker compose logs backend`; verify `JWT_SECRET_KEY` when `ENVIRONMENT=production` |
| Migration retry loop | Database credentials, `pg_isready`, network alias `db` |
| Frontend shows API errors | `INTERNAL_API_URL` build arg, backend health, Next rewrite target |
| `429` responses | `RATE_LIMIT_*` settings and whether the client is behind a proxy without `X-Forwarded-For` |
| AI falls back to local plan | `AI_PROVIDER`, key, model name and provider reachability in logs |
| Empty catalog | `SEED_ON_STARTUP=true` or run `python -m app.db.seed` |
