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
* **Definition of Done (MVP):** A restaurant owner can set up a menu. A diner can scan a QR code and view the menu smoothly. A diner can add an item to a local cart. The Upsell pop-up triggers correctly. Everything is served directly from Supabase.
* **Frontend Progress (Apr 2026):** Core diner flow is implemented (Wolt-style UI, sticky categories, item/upsell bottom sheet, floating cart, bilingual support). The UI now fetches live menu data from backend (`/api/diner/menus/{slug}`) instead of reading `mockMenu.json` directly.
* **Backend Progress (Apr 2026):** FastAPI skeleton is in place (`core/`, `api/`, `db/`, `models/`) with Supabase service-role client, repository pattern, and a public fat endpoint for diner menu retrieval. Seed script (`backend/seed.py`) imports frontend mock JSON into Supabase and is idempotent for repeated local runs.
* **Security Hardening Completed:** DAL now includes defense-in-depth tenant validation for embedded upsell offer items; owner/admin routers are protected by default dependency boundaries.
* **Immediate Next Task:** Add Phase-2-ready backend write endpoints (starting with soft-order/event POST flows) and align lightweight analytics/event ingestion with current menu read contract.

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
  * *The Upsell Transition:* If the item has an associated `upsell_rule`, clicking "Add to order" does not close the sheet. Instead, the sheet content smoothly transitions to the upsell offer ("Add a side of fries for 12 ₪?"). The user can click "Add" or "No thanks", which finally closes the sheet.
* **The Floating Cart (Sticky Footer):**
  * Invisible when the cart is empty.
  * Once an item is added, a floating button appears anchored to the bottom of the screen.
  * Displays a summary: "View Order (2 items) - 44 ₪". Tapping it opens the final cart summary to show the waiter (Soft Ordering).

**End of Context Document.**