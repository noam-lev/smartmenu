# Frontend CR Notes (Self Review)

## Implementation Status (May 2026)

| Area | Status |
|------|--------|
| Live menu API (not mock) | ✅ `tenant-diner-page.tsx` → `fetchMenuBySlug` (`lib/menuApi.ts`) |
| Smart upsell (skip in-cart offers) | ✅ `activeUpsellRule` + `hasItemInCart(restaurantSlug, itemId)` |
| Cart totals precomputed | ✅ Per-restaurant buckets in `cartStore` |
| Body scroll lock hook | ✅ `useLockBodyScroll` on item + cart sheets |
| `100dvh` viewport | ✅ Root layout + diner page |
| Sheet `overscroll-contain` | ✅ Item + cart sheets |
| `image_url` nullable in types | ✅ `string \| null` + `hasRenderableImage()` |
| Menu load errors | ✅ `MenuFetchError` + `getMenuLoadErrorMessage` |
| Dialog a11y on admin modals/drawers | ✅ `Modal`, `EditItemDrawer`, `EditCategoryDrawer` (`role="dialog"`, Escape on modals) |
| Diner bottom sheets a11y | ❌ Still open — see below |
| `useMenuData` hook / split diner page | ❌ Still open |
| `theme_color` in UI | ❌ Still hardcoded zinc palette |
| Shared image-error state | ❌ Duplicated in `MenuItemCard` + `ItemBottomSheet` |
| Zustand shallow selector | ❌ Multiple subscriptions in diner page |

**File rename:** Diner UI moved from `app/page.tsx` → `app/tenant-diner-page.tsx` (root `/` is marketing). Admin: `tenant-admin-page.tsx`.

---

## Repetitive Code
- Image-failure state still duplicated in `MenuItemCard` and `ItemBottomSheet` (`failedImageUrls`, `onError`).
- Bottom sheet overlay/panel/drag patterns shared between `ItemBottomSheet` and `CartSummarySheet` (partially unified via `useDraggableSheet` + `useLockBodyScroll`).

## Coupled Code / Change-Fragility
- `tenant-diner-page.tsx` still orchestrates menu fetch, scroll spy, i18n, cart, sheets, and language menu in one file (~500 lines).
- Theme: `restaurant.theme_color` in payload but styling uses fixed `zinc-*` / brand defaults.
- ~~Upsell assumes first rule only~~ — **fixed** (first *applicable* rule not already in cart).

## Future Feature Risk
- Per-restaurant feature flags (no upsell, custom sections) will add branching unless config-driven layout exists.
- ~~Static `mockMenu.json` in diner page~~ — **fixed** for runtime; mock remains for `backend/seed.py` only.

## React Performance / Zustand
- [Done] `totalItems` / `totalPrice` precomputed per `restaurantSlug` on mutations.
- [Pending] Multiple `useCartStore` selectors in diner page; consider one shallow selector object.
- [Pending] `cartItems` derived via `useMemo` from `itemsByItemId` — fine for MVP cart sizes.

## Accessibility (a11y)
- [Done] Admin: `Modal` / edit drawers — `role="dialog"`, `aria-modal`, Escape (modals).
- [Pending] **Diner** `ItemBottomSheet` / `CartSummarySheet`: no `role="dialog"` / `aria-modal` on panel; no focus trap; no Escape; no focus return to trigger.
- [Pending] Quantity +/- and remove in sheets lack dedicated `aria-label`s (labels passed for some copy only).
- [Pending] Diner language popover — limited keyboard menu behavior.

## Mobile Safari / Web Edge Cases
- [Done] `min-h-[100dvh]`; `useLockBodyScroll`; `overscroll-contain` on sheets.
- [Pending] Residual iOS rubber-band while sheets open (lock hook may need `position: fixed` body pattern).

## TypeScript / Data Safety
- [Done] `image_url: string | null` on `MenuItem`.
- [Done] Banner guarded with conditional render (`banner_url` truthy check).
- [Pending] No runtime schema validation of API JSON (trust contract; `MenuFetchError` on HTTP failures only).
- [Pending] Assumes `variants` / `upsell_rules` arrays always present from API.

## Backend Readiness / Separation of Concerns
- [Partial] Data access in `fetchMenuBySlug` + inline `useEffect` load — not a dedicated `useMenuData` hook.
- [Pending] Split diner page (header, category nav, sections, cart CTA).
- [Pending] Screen-level UI copy maps to reduce inline `getUiMessage` repetition.

## Recommended Next Changes (priority)
1. Diner sheet a11y: `role="dialog"`, `aria-modal`, Escape, focus trap + return focus.
2. Extract `useMenuData(slug)` (loading/error/payload) from `tenant-diner-page.tsx`.
3. Shared `useImageLoadFailure()` for card + sheet images.
4. CSS variables from `restaurant.theme_color` for primary actions.
5. Single shallow Zustand selector for cart slice on diner page.
