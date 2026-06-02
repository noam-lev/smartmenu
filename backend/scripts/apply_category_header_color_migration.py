"""Apply category header_color migration when SUPABASE_DB_URL is set.

Usage (Supabase → Project Settings → Database → Connection string, URI mode):

  set SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
  uv run python scripts/apply_category_header_color_migration.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

MIGRATION = Path(__file__).resolve().parents[2] / "supabase/migrations/20260602120000_category_header_color.sql"


def main() -> int:
    db_url = os.getenv("SUPABASE_DB_URL", "").strip()
    if not db_url:
        print(
            "Set SUPABASE_DB_URL to your Supabase Postgres connection string, or run this SQL "
            "in the Supabase SQL editor:\n"
        )
        print(MIGRATION.read_text(encoding="utf-8"))
        return 1

    try:
        import psycopg
    except ImportError:
        print("Install psycopg: uv add psycopg[binary]", file=sys.stderr)
        return 1

    sql = MIGRATION.read_text(encoding="utf-8")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print("Applied migration:", MIGRATION.name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
