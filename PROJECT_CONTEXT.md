***

# 🧠 SmartMenu AI - Master Project Context (V2.0)

**To the AI Assistant:** Read this document carefully. It contains the complete business, architectural, and technical context of the "SmartMenu AI" project. We have already made definitive architectural decisions. Do not suggest altering the core stack, the database schema, or the strategic decisions listed below. Your goal is to help me continue developing from the "Current Status" point.

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
* **Client Side (UI):** Next.js (App Router), TypeScript, Tailwind CSS, Zustand (for local cart state).
* **Server Side (API):** Python, FastAPI, Pydantic (managed via `uv` and `pyproject.toml`).
* **Database & Security:** PostgreSQL managed via Supabase.

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
* `restaurants`: id, owner_id, name, slug (lowercase unique index), settings (JSONB), is_active, created_at, updated_at.
* `menus`: id, restaurant_id, name, is_active, created_at, updated_at.
* `categories`: id, menu_id, name, sort_order, is_visible, created_at.
* `menu_items`: id, restaurant_id, menu_id, category_id, name, description, base_price (NOT NULL, for display), is_available, is_visible, sort_order, image_url, raw_ocr_data (JSONB), metadata (JSONB), translations (JSONB), created_at.
* `item_variants`: id, menu_item_id, name (default 'Regular'), price, created_at. (UNIQUE constraint on menu_item_id + name).
* `upsell_rules`: id, restaurant_id, trigger_item_id, offer_item_id, custom_message, discount_price, created_at. (CHECK constraint preventing trigger == offer).
* `events`: id, restaurant_id, event_type, item_id, created_at. (Composite index for performance queries).

## 6. The API Contract (Mock JSON Payload)
The data is fetched as a single nested JSON. This is the structure (currently located in `frontend/data/mockMenu.json`):

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
We are now in a **frontend + backend integration phase**.
* **Definition of Done (MVP):** A restaurant owner can set up a menu. A diner can scan a QR code and view the menu smoothly. A diner can add an item to a local cart. Upsell prompts trigger only for **applicable** rules (offered item not already in cart; see **Recent engineering changes** under section 7). Everything is served directly from Supabase.
* **Frontend Progress (Apr 2026):** Core diner flow is implemented (Wolt-style UI, sticky categories, item/upsell bottom sheet, floating cart, bilingual support). The UI now fetches live menu data from backend (`/api/diner/menus/{slug}`) instead of reading `mockMenu.json` directly.
* **Backend Progress (Apr 2026):** FastAPI skeleton is in place (`core/`, `api/`, `db/`, `models/`) with Supabase service-role client, repository pattern, and a public fat endpoint for diner menu retrieval. Seed script (`backend/seed.py`) imports frontend mock JSON into Supabase and is idempotent for repeated local runs.
* **Security Hardening Completed:** DAL now includes defense-in-depth tenant validation for embedded upsell offer items; owner/admin routers are protected by default dependency boundaries.
* **Immediate Next Task:** Add Phase-2-ready backend write endpoints (starting with soft-order/event POST flows) and align lightweight analytics/event ingestion with current menu read contract.

### Owner dashboard & menu item lifecycle (current build)
* **Admin UI (`/admin`):** Owner-facing menu editor: browse categories, toggle item availability (optimistic PATCH), **create** items (POST + optimistic temp row), **edit** items in a side drawer (`EditItemDrawer`) with tabs (General live; Translations/Upsells placeholders), **delete** items (see below). Edit payloads merge **per-locale** `translations` and respect `restaurant.default_locale` for base `name`/`description` so English and Hebrew do not overwrite each other incorrectly.
* **Full UI translation:** Diner and admin chrome use a shared **`useUiStore` locale** plus `getUiMessage` / `getUiTemplate` (`frontend/utils/i18n.ts`) for English and Hebrew strings (menus, drawer, errors, aria labels). Menu/category/item **content** still comes from API `translations` JSONB + base fields resolved with `getLocalizedText`.
* **Menu item deletion (hard delete):** Owner `DELETE /api/owner/items/{item_id}` **physically removes** the row from `menu_items` (and dependent DB rules, e.g. FK cascades, apply as configured in Supabase). The admin UI uses **`DialogProvider` / `useDialogs()`** (`frontend/context/DialogProvider.tsx`): **`confirm()`** for destructive prompts and **`alert()`** for errors — localized via `getUiMessage`, styled modals (`frontend/components/ui/Modal.tsx`, `ConfirmModal.tsx`, `AlertModal.tsx`), **optimistic removal** with **revert + alert** on API failure. **Product note:** Hard delete is acceptable for MVP / no payments. Once we attach **real orders and payments**, we should move to **soft delete** (e.g. `deleted_at` or `is_active` on items) so historical checks, receipts, and refunds can still reference sold items.

### Recent engineering changes (May 2026)

These updates are in the repo so future work can assume this behavior without rediscovering it.

**Next.js 16 / local dev (`frontend/`)**

- **`next.config.ts`:** `turbopack.root` is set to the absolute directory that contains `next.config.ts` (the real app root). That stops Turbopack from occasionally treating `frontend/app` as the workspace root, which broke resolution (`next/package.json` not found from the wrong cwd).
- **`package.json` scripts:** Default dev is **`next dev --webpack`** so day-to-day dev avoids Turbopack Rust panics seen on Next 16.2.x when compiling heavy routes. **`yarn dev:turbo`** runs plain **`next dev`** if you want Turbopack again after the explicit root fix.
- **Operational note:** Only one `next dev` per `frontend` folder should bind a port; a second instance exits with “Another next dev server is already running.” Mixed **yarn** + **npm** lockfiles under `frontend` can confuse tooling; prefer one package manager there.

**Diner cart and smart upsell (`frontend/store/cartStore.ts`, `frontend/app/page.tsx`)**

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

**Operational updates**

- **Backend log timestamps:** Uvicorn log format now includes timestamps for error/access logs in app startup config and in `backend/uvicorn_log_config.json` for CLI launches (`uvicorn ... --log-config ...`).

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