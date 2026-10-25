# Seir API

FastAPI backend for the Seir travel super-app. The service exposes a versioned
REST API under `/api/v1`, uses SQLAlchemy 2 async sessions, Alembic migrations,
Redis-backed caching and rate limiting, and a multi-provider AI layer with a
deterministic planner fallback.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example .env          # adjust DATABASE_URL/REDIS_URL if needed
alembic upgrade head
uvicorn app.main:app --reload
```

The default configuration uses SQLite and works without Redis. API docs are
served at <http://localhost:8000/docs>.

## Quality gates

```bash
ruff check app tests
pytest -q
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Traveler | `traveler@seir.ir` | `Traveler123` |
| Admin | `admin@seir.ir` | `Admin12345` |
| Provider | `provider@seir.ir` | `Provider123` |
| Support | `support@seir.ir` | `Support123` |

See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for details.
