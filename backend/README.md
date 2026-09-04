# Rumia FastAPI Backend

Vertical slice feature-based modular monolith backend for Rumia.

## Architecture

- **`app/core/`**: Shared infrastructure concerns (configuration, database pooling, security, logging, error handling).
- **`app/features/`**: Independent domain feature slices (`health`, `listings`, `campuses`, `reviews`, `agents`, `managers`, `admin`, etc.). Each feature slice contains its own router, schemas, models, and service logic.
- **`app/api.py`**: Aggregates feature routers into `/api/v1`.
- **`app/main.py`**: FastAPI application entrypoint.

## Development

Managed with [`uv`](https://github.com/astral-sh/uv).

```bash
# Sync environment dependencies
uv sync

# Run backend development server
uv run uvicorn app.main:app --reload --port 8000

# Run backend tests
uv run pytest
```
