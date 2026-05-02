from functools import lru_cache

from supabase import Client, create_client

from core.config import get_settings
from db.repository import MenuRepository
from db.supabase_dal import SupabaseDAL


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()

    if not settings.is_supabase_configured:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
        )

    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_db() -> MenuRepository:
    return SupabaseDAL(client=get_supabase_client())
