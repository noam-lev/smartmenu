# BACKEND Code Review Report

## Implementation Status (May 2026)

| # | Item | Status |
|---|------|--------|
| 1 | Cross-tenant upsell `offer_item` embed | ✅ **Done** — DAL drops rules when `offer_item.restaurant_id` ≠ current tenant (`supabase_dal.py` ~1185). |
| 3 | Owner/admin auth boundary | ✅ **Done (revised)** — Per-route `Depends(verify_restaurant_access)` + `get_current_user` (Supabase JWT + `restaurant_members` / superadmin `profiles.role`). **Not** `require_admin_context()` (still unused stub in `core/security.py`). |
| 6 | `image_url` nullability | ✅ **Mostly done** — `_as_optional_string` / nullable DTOs; rare empty-string fallback remains in upsell snapshot edge path. |
| 7 | Seed idempotency | ✅ **Done** — `python seed.py --reset` runs scoped cleanup before insert. |
| 5 | Error taxonomy | 🔶 **Partial** — `CustomHTTPException` + `MenuNotFoundError` + global handler; most Supabase failures still → generic 500. |
| 2 | DAL query/mapper split | ⏸️ **Deferred** (MVP/YAGNI). |
| 4 | Diner vs owner DTO namespaces | ⏸️ **Deferred** — owner write models grew (`owner.py` payloads) but no formal namespace split. |

**Since original review:** Full owner API (categories CRUD/reorder, items, upsells, banner, `menu-images` upload/delete), marketing leads (`/api/marketing/leads`), superadmin magic-parse/import, `subscriptions` + `core/features.py` plan gates, `dependencies.py` access context.

---

## CRITICAL

### 1) Potential Cross-Tenant Data Leak via `offer_item` Embed
- **Location:** `backend/db/supabase_dal.py` (upsell assembly)
- **Issue:** Nested `offer_item` embed is not constrained by `restaurant_id` in PostgREST query.
- **Risk:** Malformed `offer_item_id` could surface another tenant’s item in diner JSON (service-role bypasses RLS).
- **Mitigation (implemented):** Drop upsell rows where embedded `offer_item.restaurant_id` ≠ current restaurant.
- **Still recommended:** DB constraint ensuring `offer_item_id` shares `restaurant_id` with trigger item.

## ARCHITECTURAL WARNINGS

### 2) DAL Has Multiple Responsibilities (Query + Mapping + Fallback Policy)
- **Location:** `backend/db/supabase_dal.py`
- **Status:** ⏸️ Deferred.
- **Risk:** Harder unit tests as phase 2/3 adds pricing, localization, analytics.
- **Proposed:** Split query / mapper / policy helpers.

### 3) Admin/Auth Boundary Exists but Is Not Used
- **Original issue:** `require_admin_context()` unused.
- **Current state:** ✅ Owner mutations use `verify_restaurant_access` on each route; `GET /api/owner/ping` uses `get_current_user` only.
- **Follow-up:** Remove or repurpose dead `require_admin_context()`; consider `APIRouter(dependencies=[...])` to avoid per-route drift. Stale `# TODO: ADD AUTH` comments on owner routes should be deleted.

## BUSINESS/SCALABILITY BLOCKERS

### 4) Menu Endpoint DTO Is Coupled to Frontend-Specific Shape
- **Status:** ⏸️ Deferred — still one diner `MenuPayload` in `models/schemas.py` + DAL mapping.
- **Risk:** Breaking changes as owner/admin and events evolve.
- **Proposed:** `public_diner` vs `owner` vs internal domain models.

### 5) No Explicit Error Taxonomy for Upstream DB/API Failures
- **Status:** 🔶 Partial — `MenuNotFoundError`, `CustomHTTPException` handler in `main.py`; no structured mapping for PostgREST/constraint failures.
- **Proposed:** Stable error codes + structured logging for data-layer failures.

## NITPICKS

### 6) Minor Type/Nullability Inconsistency for `image_url`
- **Status:** ✅ Mostly fixed (nullable in schemas + `_as_optional_string`).
- **Residual:** Verify upsell snapshot path does not force `""` when null is intended.

### 7) Seed Script Is Non-Idempotent
- **Status:** ✅ Fixed — `--reset` + `_cleanup_seeded_data()`.
