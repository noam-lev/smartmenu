# Frontend CR Notes (Self Review)

## Implementation Status (May 2026)

| Area | Status |
|------|--------|
| Live menu API (not mock) | ✅ `tenant-diner-page.tsx` → `useMenuData` → `fetchMenuBySlug` |
| Smart upsell (skip in-cart offers) | ✅ `activeUpsellRule` + `hasItemInCart(restaurantSlug, itemId)` |
| Cart totals precomputed | ✅ Per-restaurant buckets in `cartStore` |
| Body scroll lock hook | ✅ `useLockBodyScroll` on item + cart sheets |
| `100dvh` viewport | ✅ Root layout + diner page |
| Sheet `overscroll-contain` | ✅ Item + cart sheets |
| `image_url` nullable in types | ✅ `string \| null` + `hasRenderableImage()` |
| Menu load errors | ✅ `MenuFetchError` + `getMenuLoadErrorMessage` |
| Dialog a11y on admin modals/drawers | ✅ `Modal`, `EditItemDrawer`, `EditCategoryDrawer` |
| Diner bottom sheets a11y | ✅ **Sprint B** — `useSheetDialogA11y` on `ItemBottomSheet` + `CartSummarySheet` |
| `useMenuData` hook | ✅ **Sprint A** — `hooks/useMenuData.ts` |
| Shared image-error hook | ✅ **Sprint A** — `hooks/useImageLoadFailure.ts` (`MenuItemCard`, `ItemBottomSheet`) |
| Zustand shallow selector (diner cart) | ✅ **Sprint A** — `useShallow` in `tenant-diner-page.tsx` |
| `theme_color` in UI | ❌ Still hardcoded zinc palette |
| Split diner page into subcomponents | ❌ Still ~470 lines in `tenant-diner-page.tsx` |

**File rename:** Diner UI in `app/tenant-diner-page.tsx` (root `/` is marketing). Admin: `tenant-admin-page.tsx`.

**Cleanup sprints completed:** Sprint A (hygiene, no behavior change) + Sprint B (diner sheet a11y).

---

## Repetitive Code
- ~~Image-failure state duplicated~~ — **fixed** via `useImageLoadFailure()`.
- Bottom sheet overlay/panel/drag patterns still shared between `ItemBottomSheet` and `CartSummarySheet` (partially unified via `useDraggableSheet`, `useLockBodyScroll`, `useSheetDialogA11y`).

## Coupled Code / Change-Fragility
- `tenant-diner-page.tsx` still orchestrates scroll spy, i18n, cart, sheets, and language menu in one file.
- Theme: `restaurant.theme_color` in payload but styling uses fixed `zinc-*` / brand defaults.
- ~~Upsell assumes first rule only~~ — **fixed** (first *applicable* rule not already in cart).

## Future Feature Risk
- Per-restaurant feature flags (no upsell, custom sections) will add branching unless config-driven layout exists.
- ~~Static `mockMenu.json` in diner page~~ — **fixed** for runtime; mock remains for `backend/seed.py` only.

## React Performance / Zustand
- [Done] `totalItems` / `totalPrice` precomputed per `restaurantSlug` on mutations.
- [Done] Single `useShallow` selector for cart actions + bucket on diner page.
- [Pending] `cartItems` derived via `useMemo` from `itemsByItemId` — fine for MVP cart sizes; optional `useMemo` on `itemsByItemId` if exhaustive-deps warning matters.

## Accessibility (a11y)
- [Done] Admin: `Modal` / edit drawers — `role="dialog"`, `aria-modal`, Escape.
- [Done] **Diner sheets (Sprint B):** `ItemBottomSheet` / `CartSummarySheet` — panel `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape dismiss, Tab focus trap, focus restore (`hooks/useSheetDialogA11y.ts`).
- [Pending] Quantity +/- and remove in diner sheets lack dedicated `aria-label`s (visible text only).
- [Pending] Diner language popover — limited keyboard menu behavior (arrow keys / typeahead).

## Mobile Safari / Web Edge Cases
- [Done] `min-h-[100dvh]`; `useLockBodyScroll`; `overscroll-contain` on sheets.
- [Pending] Residual iOS rubber-band while sheets open (lock hook may need `position: fixed` body pattern).

## TypeScript / Data Safety
- [Done] `image_url: string | null` on `MenuItem`.
- [Done] Banner guarded with conditional render (`banner_url` truthy check).
- [Pending] No runtime schema validation of API JSON (trust contract; `MenuFetchError` on HTTP failures only).
- [Pending] Assumes `variants` / `upsell_rules` arrays always present from API.

## Backend Readiness / Separation of Concerns
- [Done] Menu fetch in `useMenuData(slug)` with optional `onMenuLoaded` callback (category bootstrap).
- [Pending] Split diner page (header, category nav, sections, cart CTA).
- [Pending] Screen-level UI copy maps to reduce inline `getUiMessage` repetition.

## Recommended Next Changes (priority)
1. CSS variables from `restaurant.theme_color` for primary actions / accents.
2. Split `tenant-diner-page.tsx` into smaller presentational units.
3. `aria-label`s on diner sheet quantity +/- and remove controls.
4. Diner language popover keyboard behavior (WAI-ARIA menu pattern).
5. Phase 2 product work: events API + client hooks (see `PROJECT_CONTEXT.md`).
