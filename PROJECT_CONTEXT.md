***

# 🧠 SmartMenu AI — Master Project Context (V2.1)

**To the AI Assistant:** Read this document carefully. It contains the complete business, architectural, and technical context of the project. We have already made definitive architectural decisions. Do not suggest altering the core stack, the database schema, or the strategic decisions listed below. Your goal is to help me continue developing from the **Current Status** point.

**Branding:** The public product is **Tafrito** ([tafrito.com](https://tafrito.com)) — Hebrew/English marketing, OG metadata, and lead emails use that name. The repo and internal docs still use the codename **SmartMenu AI**.

## 1. Product Vision & Roadmap
**Goal:** Transform static restaurant menus into an active, profitability-focused sales tool for small restaurants, with minimal friction for the restaurant owner.

**Roadmap:**
* **Phase 1: The Core Product (MVP) - *Currently Building***
    * OCR-based menu creation for rapid onboarding.
    * Ultra-fast, mobile-first Web menu for diners.
    * Manual Upsell Engine (rule-based pop-ups).
    * Built-in translation mechanism (server-side).
* **Phase 2: Make it Sell**
    * Soft Ordering (local cart displayed to the waiter).
    * Basic Analytics (views vs. adds to cart).
* **Phase 3: AI Optimization**
    * Auto-generated appetizing dish descriptions.
    * Data-driven smart Upsell suggestions.
    * Inventory and price management via WhatsApp.

### 🚫 Non-Goals (MVP Constraints)
* No POS integration.
* No clearing or payments.
* No user accounts for diners.
* No real-time sync between diner devices.
* No complex AI at this stage (OCR will be basic or mocked for now).

## 2. Tech Stack & Infrastructure
* **Architecture Pattern:** Monorepo (managed via Cursor + Git).
    * `frontend/` — Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Zustand (`cartStore`, `uiStore`).
    * `backend/` — Python, FastAPI, Pydantic (`uv`, `pyproject.toml`).
* **Database & Auth:** PostgreSQL + Supabase Auth (Google OAuth for owners). Backend uses **service-role** client; owner writes validate JWT + `restaurant_members` (or `profiles.role = superadmin`).
* **Storage:** Supabase bucket `menu-images` for item/banner uploads (owner API).
* **Email (marketing):** Resend via `backend/services/lead_notification.py` (`RESEND_API_KEY`, etc. in `backend/core/config.py`).
* **Deploy signals:** Vercel Analytics + Speed Insights on root layout; `metadata.robots` still `noindex` (see §7).

## 3. Security, Data & Performance Rules
* **Security (RLS):** Row Level Security (RLS) must be enforced on all tables in Supabase. All queries must be strictly scoped by `restaurant_id`. No cross-tenant data access is allowed.
* **Data Ownership Rules:**
    * `variants.price` is the **single source of truth** for pricing and billing.
    * `base_price` in the items table is a derived field (lowest variant price) used strictly for UI display purposes.
    * `menu.last_updated` must be updated on any change made to items, variants, categories, or upsell rules (to manage Cache invalidation).
* **Performance Requirements:**
    * The menu must load in under 1 second on a 3G network.
    * A single API request fetches the entire menu (Fat Endpoint). No client-side Joins or additional network requests are allowed for rendering the menu.
* **UX Principle:** Minimize friction. A diner should be able to view a dish -> select it -> and add it to the cart in under 3 taps.

## 4. Strategic Architectural Decisions
1.  **"Trojan Horse" Variants:** The DB includes an `item_variants` table for future scalability. However, for the MVP, the UI assumes there is exactly one variant per item (named "Regular"). The UI completely ignores the variant selection process, but the server maintains data integrity behind the scenes.
2.  **Upsell Trigger:** Upsell rules are triggered at the **Item** level (not the Variant level in the MVP). The rule includes an `offer_item_snapshot` to prevent additional client-side network lookups when the pop-up triggers.
3.  **Cart Management (Soft Ordering):** The cart is managed 100% client-side using `Zustand` (Local Storage). The server is entirely unaware of the cart until the order submission phase.
4.  **Translations:** Managed strictly server-side. The DB stores a `translations` (JSONB) column in the items table, and the server injects the correct strings based on the client's locale to minimize payload weight.

## 5. Database Schema (Deployed in Supabase)

**Core menu (unchanged intent):**
* `restaurants`: id (UUID), owner_id, name, slug (unique, lowercase), `settings` JSONB (`theme_color`, `currency`, `banner_image_url`, `default_locale`, …), is_active, timestamps.
* `menus`: id, restaurant_id, name, is_active, timestamps. API exposes `menus.updated_at` as `menu.last_updated`.
* `categories`: id, menu_id, name, sort_order, is_visible, `translations` JSONB, created_at.
* `menu_items`: id, restaurant_id, menu_id, category_id, name, description, base_price, is_available, is_visible, sort_order, image_url, raw_ocr_data, metadata, translations (JSONB), created_at.
* `item_variants`: id, menu_item_id, name (default `Regular`), price. UNIQUE (menu_item_id, name).
* `upsell_rules`: id, restaurant_id, trigger_item_id, offer_item_id, custom_message, `translations` JSONB (per-locale messages), discount_price, created_at. CHECK trigger ≠ offer.
* `events`: id, restaurant_id, event_type, item_id, created_at — **schema exists; no write API yet** (Phase 2).

**Auth, tenancy & SaaS (in use):**
* `profiles`: id (= auth user id), `role` (`superadmin` bypasses membership checks).
* `restaurant_members`: restaurant_id, user_id, role — required for owner API access.
* `subscriptions`: restaurant_id, plan_tier, status — drives `backend/core/features.py` gates (`free` / `starter` / `pro` / `enterprise`).

## 6. API Surface & Menu JSON Contract

**HTTP routers** (`backend/main.py`):
| Prefix | Purpose |
|--------|---------|
| `GET /api/diner/menus/{slug}` | Public fat menu (no auth) |
| `GET /api/owner/ping` | Auth smoke test (Bearer JWT) |
| `POST/PATCH/DELETE /api/owner/{slug}/…` | Owner menu CRUD, images, upsells, reorder |
| `POST /api/marketing/leads` | Landing lead capture (+ IP rate limit) |
| `POST /api/superadmin/login`, `magic-parse`, `restaurants/import`, … | In-memory superadmin session (`X-Superadmin-Token`) |
| `GET /health` | Health check |

**Reference payload:** `frontend/data/mockMenu.json` — still used by `backend/seed.py` for local seeding; **runtime diner UI reads live API**, not this file.

Nested menu shape (abbreviated):

```json
{
  "restaurant": {
    "name": "Yossi's Hummus",
    "slug": "yossis-hummus",
    "theme_color": "#FF5733",
    "currency": "ILS"
  },
  "menu": {
    "id": "uuid-menu-123",
    "name": "Lunch Menu",
    "last_updated": "2026-04-16T12:00:00Z",
    "categories": [
      {
        "id": "uuid-cat-1",
        "name": "Starters",
        "sort_order": 1,
        "items": [
          {
            "id": "uuid-item-1",
            "name": "Classic Chickpea Hummus",
            "description": "House hummus with warm chickpeas, parsley, and premium olive oil",
            "base_price": 32.00,
            "is_available": true,
            "image_url": "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&q=80&w=200",
            "tags": ["VEGAN", "GLUTEN_FREE"],
            "variants": [
              {
                "id": "uuid-var-1",
                "name": "Regular",
                "price": 32.00
              }
            ],
            "upsell_rules": [
              {
                "offer_item_snapshot": {
                  "id": "uuid-item-2",
                  "name": "Small Fries",
                  "image_url": "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&q=80&w=200",
                  "price": 15.00
                },
                "custom_message": "Fancy adding small fries on the side for 12₪?",
                "discount_price": 12.00
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## 7. Current Status & Immediate Next Task

**Phase:** MVP diner + owner flows are largely built; **Phase 2** (events, soft-order server awareness, analytics) is not started.

**MVP checklist (done unless noted):**
* Diner: `/{slug}` → `tenant-diner-page.tsx` — live menu, Wolt-style UI, cart (Zustand + localStorage), smart upsell, bilingual UI + API translations, optional restaurant banner.
* Owner: `/{slug}/admin` → `tenant-admin-page.tsx` — categories/items CRUD, drag-and-drop reorder (`@dnd-kit`), availability toggles, image upload, banner, upsell rules in drawer, hard delete with confirm modals.
* Platform: `/` marketing landing (`TafritoLandingPage`), lead form → `POST /api/marketing/leads`.
* Superadmin: `/superadmin` login + `/superadmin/onboarding` (magic parse + import). `/superadmin/restaurants` is a **placeholder**.
* Seed: `backend/seed.py` idempotent import from `mockMenu.json`.

**Auth (May 2026):**
* **Owners:** Google OAuth via Supabase (`LoginButton`, `/login`, `/auth/callback`). `middleware.ts` redirects unauthenticated users away from `/{slug}/admin`. Owner API calls send `Authorization: Bearer <access_token>` (`menuApi.getOwnerAuthHeaders`). Backend `verify_restaurant_access` checks `restaurant_members` or superadmin `profiles.role`. Stale `# TODO: ADD AUTH` comments remain on some owner routes but **deps are wired**.
* **Superadmin:** Separate in-memory token auth (`X-Superadmin-Token`), not Supabase.

**Not done (explicit gaps):**
* `events` ingestion / analytics APIs.
* Server-side awareness of diner cart (“soft order” submit).
* RLS enforcement audit in app code (service-role bypasses RLS — tenant scoping is application-layer).
* Superadmin restaurant list/management UI.
* Search indexing (`robots` still noindex — ask user before enabling).

**Immediate next task:** Phase-2 `POST` flows for events (and optional soft-order payload), aligned with existing fat menu read contract.

### Routes (frontend)
| Path | Component / role |
|------|------------------|
| `/` | `TafritoLandingPage` + `LeadCaptureDialog` / `HeroMagicDemo` |
| `/login` | Google admin login (`next` redirect) |
| `/{slug}` | Diner menu |
| `/{slug}/admin` | Owner editor (auth required) |
| `/superadmin`, `/superadmin/onboarding`, `/superadmin/restaurants` | Superadmin tools |

Shared modules: `frontend/lib/menuApi.ts`, `frontend/lib/marketingApi.ts`, `frontend/lib/superadminApi.ts`, `frontend/utils/supabase/{client,server}.ts`.

### Owner dashboard (current build)
* **Admin UI (`/{restaurant_slug}/admin`):** Full menu editor — categories (create/rename/delete, reorder), items (create/edit/delete, reorder within category, availability PATCH), restaurant banner, item images via owner upload endpoints.
* **`EditItemDrawer`:** Tabs **General**, **Translations**, **Upsells** (`UpsellTab.tsx` — create/edit/delete rules, bilingual messages). Merges per-locale `translations`; respects `restaurant.default_locale` for base `name`/`description`.
* **`EditCategoryDrawer`:** Category name + translations.
* **UI i18n:** `useUiStore` + `getUiMessage` / `getUiTemplate` (`frontend/utils/i18n.ts`). Content i18n via API `translations` + `getLocalizedText`. Locale flags: `frontend/public/flags/{il,us}.svg`.
* **Hard delete:** `DELETE /api/owner/{slug}/items/{item_id}` removes row + dependent variants/upsells per DB rules. `DialogProvider` confirm/alert modals. **Future:** soft delete when orders/payments exist.

### Recent engineering changes (May 2026)

These updates are in the repo so future work can assume this behavior without rediscovering it.

**Next.js 16 / local dev (`frontend/`)**

- **`next.config.ts`:** `turbopack.root` is set to the absolute directory that contains `next.config.ts` (the real app root). That stops Turbopack from occasionally treating `frontend/app` as the workspace root, which broke resolution (`next/package.json` not found from the wrong cwd).
- **`package.json` scripts:** Default dev is **`next dev --webpack`** so day-to-day dev avoids Turbopack Rust panics seen on Next 16.2.x when compiling heavy routes. **`yarn dev:turbo`** runs plain **`next dev`** if you want Turbopack again after the explicit root fix.
- **Operational note:** Only one `next dev` per `frontend` folder should bind a port; a second instance exits with “Another next dev server is already running.” Mixed **yarn** + **npm** lockfiles under `frontend` can confuse tooling; prefer one package manager there.

**Diner cart and smart upsell (`frontend/store/cartStore.ts`, `frontend/app/tenant-diner-page.tsx`)**

- **`hasItemInCart(itemId)`** on the cart store: returns whether that menu item id is present in the persisted cart with quantity **greater than zero** (same ids as `addSelection` / `CartItem.itemId`).
- **Upsell interception:** After the diner confirms “Add to order”, the main item is added first. Then the client scans **`upsell_rules` in array order** and picks the **first** rule whose offered item id (`offer_item_snapshot.id`, i.e. the payload’s offer item) is **not** already in the cart. If one exists, the bottom sheet moves to the upsell step and shows **that** rule (`activeUpsellRule` state—not always `upsell_rules[0]`). If every rule’s offer is already in the cart (or there are no rules), the sheet **closes immediately** with no upsell frame, so there is no “flash then skip” UX.
- **Accept path:** Upsell “Add” still uses `addSelection` with the snapshot name, translations, and `discount_price ?? snapshot.price` for the offered line item.

**Superadmin + Magic Onboarding (May 2026)**

- **Secure MVP auth (`backend/api/routes/superadmin.py`):** in-memory session tokens with expiry + IP binding (`X-Superadmin-Token`), login lockout on repeated failures (per-IP), logout endpoint, and protected superadmin routes.
- **AI parse pipeline (no direct diner impact):** `POST /api/superadmin/magic-parse` accepts image upload, encodes to data URL, calls OpenAI (`gpt-4o`) with structured output into strict schemas (`ParsedMenu`, `ParsedCategory`, `ParsedItem`), then returns editable preview data.
- **Import pipeline:** `POST /api/superadmin/restaurants/import` receives edited bilingual payload (`RestaurantImportPayload`) and creates tenant + menu + categories + items with Hebrew base fields and English `translations` mapping.
- **Important DB reality check:** `restaurants.id` is **UUID**, `restaurants.slug` is text. Slug is used for routing; backend resolves slug -> UUID for owner writes and FK-safe inserts.
- **Onboarding UI (`/superadmin/onboarding`):** upload, loading, editable bilingual preview, restaurant name+slug inputs, slug auto-follow-until-manual-edit behavior, save button, success/error feedback.

**Multi-tenant routing + owner API (May 2026)**

- **Frontend route model:** tenant-aware pages under `app/[restaurant_slug]` and `app/[restaurant_slug]/admin`; `app/superadmin` remains global. Root `app/page.tsx` is now a platform landing page (no auto redirect).
- **Owner API paths:** owner routes now include `/{restaurant_slug}/...` and no longer use hardcoded `\"yossis-hummus\"`.
- **Client API signatures:** owner-side frontend API helpers now require `restaurantSlug` and interpolate slug in all owner fetch URLs.
- **Cart isolation across tenants:** cart store now keeps `restaurantSlug`; adding an item from a different tenant auto-clears old cart then adds the new item (Secure MVP behavior to avoid cross-restaurant cart leakage/confusion).
- **Next.js 16 dynamic params:** slug wrapper routes were updated to await async `params` to avoid runtime warnings/errors.

**Marketing site (May 2026)**

- **`TafritoLandingPage`:** Hebrew/English copy in `landingDictionary.ts`, FAQ (`LandingFaq`), animated hero phone demo, feature orbit, lead capture.
- **Leads:** `POST /api/marketing/leads` — validates body, per-IP rate limit (8/hr), emails via Resend (team notification + optional welcome). Frontend: `marketingApi.ts` + `LeadCaptureForm`.

**Operational updates**

- **Backend log timestamps:** Uvicorn log format includes timestamps (`main.py` embedded config + `backend/uvicorn_log_config.json`).
- **Search indexing:** `app/layout.tsx` — `metadataBase` `https://tafrito.com`, OG/Twitter images, `robots: noindex`. **Ask the user** before enabling indexing.
- **Env (typical):** `frontend/.env.local` — `NEXT_PUBLIC_API_BASE_URL`, Supabase URL/anon key. `backend/.env` — Supabase service key, OpenAI (superadmin parse), Resend, `SUPERADMIN_*` credentials.

## 8. Visual & UX Architecture (The "Wolt-Style" Experience)
To ensure all frontend components align with the overall user experience, here is the mental model for the diner's UI:

* **The Header & Hero:**
  * Top: Restaurant logo, name, and a short subtitle (e.g., "Lunch Menu").
  * **Sticky Category Bar:** Immediately below the header, a horizontally scrollable list of categories ("Starters | Mains | Drinks"). As the user scrolls down the menu feed, this bar sticks to the top of the screen for quick navigation jumps.
* **The Menu Feed:**
  * Categorized sections with clear typography headers (e.g., **"Starters"**).
  * The `MenuItemCard` components are stacked in a flat list. No heavy shadows or floating boxes; just clean rows separated by subtle 1px borders to keep the scrolling smooth and highly readable.
* **The Interaction & Upsell Flow (Bottom Sheet):**
  * Tapping a `MenuItemCard` does NOT immediately add it to the cart. Instead, it slides up a **Bottom Sheet** (modal).
  * Inside the Bottom Sheet: A larger image, item details, a quantity selector (+/-), and a prominent primary button: "Add to order - 32 ₪".
  * *The Upsell Transition:* If the item has **`upsell_rules`** and at least one rule’s offered item is **not** already in the cart, clicking "Add to order" does not close the sheet; it transitions to the **first applicable** upsell offer. If the offered item is **already** in the cart for a rule, that rule is skipped; if no rules remain, the sheet closes right away. The user can click "Add" or "No thanks" on the upsell step, which finally closes the sheet.
* **The Floating Cart (Sticky Footer):**
  * Invisible when the cart is empty.
  * Once an item is added, a floating button appears anchored to the bottom of the screen.
  * Displays a summary: "View Order (2 items) - 44 ₪". Tapping it opens the final cart summary to show the waiter (Soft Ordering).

**End of Context Document.**