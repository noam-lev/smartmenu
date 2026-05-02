# BACKEND Code Review Report

## Implementation Status (Apr 2026)

- ✅ **Implemented:** #1 Potential Cross-Tenant Data Leak via `offer_item` Embed (DAL now drops upsell rule when `offer_item.restaurant_id` mismatches current restaurant).
- ✅ **Implemented:** #3 Admin/Auth Boundary Exists but Is Not Used (owner/admin routers now enforce `Depends(require_admin_context)` at router level).
- ✅ **Implemented:** #7 Seed Script Is Non-Idempotent (seed now performs scoped cleanup for the seeded restaurant before inserts).
- ✅ **Implemented (optional):** #6 Minor Type/Nullability Inconsistency for `image_url` (DAL now maps nullable image values more consistently).
- ⏸️ **Deferred (intentionally):** #2, #4, #5 per MVP/YAGNI decision.

## CRITICAL

### 1) Potential Cross-Tenant Data Leak via `offer_item` Embed
- **Location:** `backend/db/supabase_dal.py` (query at `36-87`, embed at `72-75`)
- **Issue:** The query scopes `restaurants` by `slug` and embeds `upsell_rules` via trigger item FK, but the nested `offer_item` embed (`menu_items!upsell_rules_offer_item_id_fkey`) is not explicitly constrained by `restaurant_id` in the query.
- **Business/Technical Risk:** With service-role access, a malformed or compromised `upsell_rules.offer_item_id` could expose menu item data from a different tenant inside diner responses.
- **Proposed Solution:** Enforce tenant integrity at DB level and query level:
  - Add DB constraint/validation path ensuring `offer_item_id` belongs to the same `restaurant_id` as `trigger_item_id`.
  - In DAL mapping, drop/ignore upsell rows where embedded `offer_item.restaurant_id != current restaurant id` (defense in depth).

## ARCHITECTURAL WARNINGS

### 2) DAL Has Multiple Responsibilities (Query + Mapping + Fallback Policy)
- **Location:** `backend/db/supabase_dal.py` (`19-245`)
- **Issue:** `SupabaseDAL` and module helpers currently mix:
  - PostgREST query composition
  - DTO construction
  - fallback business rules (`_build_upsell_rule`)
  - normalization defaults (`_to_float`, empty strings, etc.)
- **Business/Technical Risk:** Harder unit testing and higher change-risk when phase-2/3 behavior evolves (pricing logic, localization policy, analytics enrichments).
- **Proposed Solution:** Split into:
  - `query` layer (raw DB fetch)
  - `mapper/assembler` layer (raw -> API DTO)
  - explicit policy helpers (fallbacks/normalization)

### 3) Admin/Auth Boundary Exists but Is Not Used
- **Location:** `backend/core/security.py` (`1-9`), `backend/api/routes/owner.py` (`1-9`), `backend/api/routes/superadmin.py` (`1-9`)
- **Issue:** `require_admin_context()` exists but is not wired into owner/admin routes.
- **Business/Technical Risk:** Future endpoints under owner/admin prefixes can be added without auth by mistake, creating privilege drift.
- **Proposed Solution:** Introduce route-level dependencies now (`dependencies=[Depends(require_admin_context)]`) so secure-by-default behavior is enforced before real mutations are introduced.

## BUSINESS/SCALABILITY BLOCKERS

### 4) Menu Endpoint DTO Is Coupled to Frontend-Specific Shape
- **Location:** `backend/models/schemas.py` (`6-70`) and mapping in `backend/db/supabase_dal.py` (`93-213`)
- **Issue:** API DTO includes frontend convenience fields (`tags`, flattened restaurant theme/currency, duplicated `settings`) mixed with DB-native fields.
- **Business/Technical Risk:** As phase 2/3 adds owner/admin APIs, events, and AI-generated fields, a single mixed DTO strategy will increase breaking-change risk and slow iteration.
- **Proposed Solution:** Introduce explicit schema namespaces:
  - `public_diner` response models
  - internal/domain models
  - future owner/admin write/read models

### 5) No Explicit Error Taxonomy for Upstream DB/API Failures
- **Location:** `backend/main.py` (`34-42`), `backend/db/supabase_dal.py` (`36-87`)
- **Issue:** Unexpected Supabase/PostgREST failures collapse to generic 500 with no domain-level mapping.
- **Business/Technical Risk:** Slower incident triage and weak observability once write endpoints and integrations are added.
- **Proposed Solution:** Add explicit handling for known data-layer exceptions (e.g., connectivity/query-shape/constraint errors) mapped to stable API errors + structured logging.

## NITPICKS

### 6) Minor Type/Nullability Inconsistency for `image_url`
- **Location:** `backend/models/schemas.py` (`44`), `backend/db/supabase_dal.py` (`151`, `206`)
- **Issue:** DTO allows nullable `image_url`, but mapper coerces null to empty string.
- **Business/Technical Risk:** Small contract ambiguity for clients and tests.
- **Proposed Solution:** Keep true nulls (`None`) in mapper when DB value is null, and let frontend treat null/empty uniformly.

### 7) Seed Script Is Non-Idempotent
- **Location:** `backend/seed.py` (`13-214`)
- **Issue:** Re-running inserts duplicates rows; no upsert/cleanup mode.
- **Business/Technical Risk:** Dev/staging drift and noisy data while iterating.
- **Proposed Solution:** Add `--reset` or upsert-by-unique-key strategy for deterministic seeding.
