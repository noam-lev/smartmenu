# SmartMenu / Tafrito — Backend API

FastAPI service for diner menus, owner admin, marketing leads, and superadmin onboarding.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) installed
- Python **3.13+** (see `requires-python` in `pyproject.toml`)

## Setup

From the `backend/` directory:

```bash
uv sync
```

Create a `.env` file in `backend/` (not committed). Minimum for most routes:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Optional: `ENVIRONMENT`, `CORS_ORIGINS` (comma-separated), `RESEND_API_KEY`, superadmin vars, etc. See `core/config.py`.

## Run the dev server

**Recommended** — run from `backend/` with reload and **timestamped logs** via `uvicorn_log_config.json`:

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-config uvicorn_log_config.json
```

Log lines look like:

```text
2026-05-17 14:32:01 | INFO     | uvicorn.error | Application startup complete.
2026-05-17 14:32:05 | INFO     | 127.0.0.1:52104 - "GET /health HTTP/1.1" 200
```

### Without auto-reload

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --log-config uvicorn_log_config.json
```

### Alternative (`main.py` entrypoint)

Also starts on port **8000** with timestamps (embedded log config in `main.py`, not the JSON file):

```bash
uv run python main.py
```

Prefer the `uvicorn` command above if you want logs to match `uvicorn_log_config.json` exactly.

## Verify

- API: [http://localhost:8000/health](http://localhost:8000/health)
- OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Point the frontend at this host, e.g. in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Seed local data (optional)

```bash
uv run python seed.py --reset
```

Imports `frontend/data/mockMenu.json` into Supabase for the seeded restaurant slug.
