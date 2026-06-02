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

## Database migrations (Supabase)

SQL migrations live in [`../supabase/migrations/`](../supabase/migrations/). Apply via the Supabase SQL editor or CLI before using modifier-aware menu reads.

Phase 1 modifiers: `20260528120000_modifier_tables.sql` creates `modifier_groups`, `modifier_options`, and `menu_item_modifier_groups`, plus triggers that bump `menus.updated_at` when modifier data changes.

Phase 2 owner API: `20260531120000_modifier_group_atomic_create.sql` adds `create_modifier_group_atomic` (group + options + attach in one transaction). Owner routes under `/api/owner/{slug}/modifier-groups` and item attach/detach under `/api/owner/{slug}/items/{item_id}/modifier-groups/{group_id}`.

Category header colors: `20260602120000_category_header_color.sql` adds `categories.header_color`. Apply in the Supabase SQL editor (or `uv run python scripts/apply_category_header_color_migration.py` with `SUPABASE_DB_URL` set). The migration file includes `NOTIFY pgrst, 'reload schema';` at the end.

After applying modifier migrations, run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL editor if PostgREST has not reloaded yet. Without a schema reload, menu API calls may return `PGRST200` until PostgREST picks up the new foreign keys.

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
