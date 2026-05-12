# Frontend CR Notes (Self Review)

## Repetitive Code
- Image-failure state handling is duplicated in `MenuItemCard` and `ItemBottomSheet` (`failedImageUrls`, `onError` patterns).
- Bottom sheet container/overlay styling and animation logic are duplicated between `ItemBottomSheet` and `CartSummarySheet` (even after drag hook extraction).
- Label wiring in `page.tsx` repeats many `getUiMessage(...)` calls inline; easy to miss keys when adding new UI sections.

## Coupled Code / Change-Fragility
- `page.tsx` is strongly coupled to menu shape + interaction orchestration + i18n + cart mutations + scroll observer + language menu UI in one file.
- Theme behavior is hardcoded (`zinc-*`, fixed button colors); `restaurant.theme_color` is not used in component styling, making per-restaurant theming harder later.
- Upsell logic currently assumes first rule (`selectedItem?.upsell_rules?.[0]`), coupling behavior to a single-rule model.

## Future Feature Risk
- If restaurants need optional features (e.g., no upsell, no hero, custom section order), current page-level branching will grow quickly and become hard to maintain.
- Static mock import in `page.tsx` (`mockMenu.json`) means data-source swap later affects core UI file rather than isolated data layer.

## React Performance / Zustand Anti-patterns
- [Done] `totalItems` and `totalPrice` were moved to literal store state and are now recomputed on cart mutations (`addSelection`, `setItemQuantity`, `removeItem`) with persist migration support.
- [Pending] Multiple independent store subscriptions in `page.tsx` can still increase re-render churn; one selector object + shallow equality would be cleaner.
- [Pending] `cartItems` is still derived from `itemsByItemId` in `page.tsx`; acceptable now, but may become expensive with larger carts and additional derived views.

## Accessibility (a11y)
- `ItemBottomSheet` and `CartSummarySheet` are missing proper dialog semantics (`role="dialog"` + `aria-modal="true"` on the sheet panel).
- No focus trap in dialogs; keyboard users can tab to background content while sheet is open.
- No keyboard close support (`Escape`), and no focus return to trigger after closing.
- Quantity/remove controls rely on symbols/text only (`+`, `-`, remove) without explicit `aria-label`s for robust SR behavior.
- Language popover uses menu roles but lacks expected keyboard menu interactions (arrow keys/home/end/escape).

## Mobile Safari / Web Edge Cases
- [Done] Root viewport sizing was updated to `min-h-[100dvh]` in both `layout.tsx` and `page.tsx` to reduce iOS dynamic address bar jumps.
- Body scroll locking with `document.body.style.overflow = "hidden"` can still allow rubber-band/overscroll artifacts on iOS.
- [Done] Sheet panel containers now include `overscroll-contain`, and the cart sheet scrollable list also includes `overscroll-contain` to reduce scroll-chain/rubber-band edge behavior.

## TypeScript Strictness / Data Safety
- `mockMenuRaw as MenuPayload` bypasses runtime validation; malformed backend payload later would fail at runtime.
- `banner_image_url` is optional in type but used directly as `<img src=...>` without fallback guard.
- `image_url` typed as required `string`, but real data already allows empty strings; type should better reflect nullable/optional reality.
- Multiple fields are assumed present (`variants`, `upsell_rules`) based on mock contract rather than defensive parsing.

## Backend Readiness / Separation of Concerns
- High-value refactor candidate: extract data access + normalization into a `useMenuData` hook/service.
- High-value refactor candidate: split `page.tsx` into smaller units (header/language, category nav, menu sections, cart CTA controller).
- High-value refactor candidate: centralize UI copy mapping per screen to reduce repeated key lookups in render tree.

## Recommended First Changes (High Value, Low Risk)
1. Add proper dialog a11y primitives (role/aria-modal/focus trap/escape/focus return).
2. Introduce a menu data layer (`useMenuData`) so swapping mock JSON to API is trivial.
3. Add theme token strategy based on `restaurant.theme_color` for future multi-restaurant branding.
4. Improve Zustand selectors (single shallow selector + memoized/derived selector strategy). (Precomputed totals already completed.)
