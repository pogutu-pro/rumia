# Implementation Plan: Navbar Search UX Overhaul

## Overview

Replace the existing `NavbarSearch` inline input with a two-state expandable search experience. The idle state is a compact pill button; activating it slides open an `ExpandedSearchPanel` containing the search input plus Filter, Price, and Book a Tour controls. The `/hostels` page becomes results-only — its search card is removed. All existing logic (`FilterBottomSheet`, `ActiveFilterChips`, `ListingSearchInput`, `useFilterStore`, `parseQuery`, `searchApi`) is reused without modification.

Implementation order follows the dependency chain: infrastructure hook → core `NavbarSearchRoot` component → `HostelsSearch` gutting → tests.

---

## Tasks

- [x] 1. Implement `useFocusTrap` hook
  - Create `web/src/hooks/use-focus-trap.ts` (new file).
  - The hook accepts `(containerRef: React.RefObject<HTMLElement>, active: boolean): void`.
  - When `active` becomes `true`: collect all focusable elements inside `containerRef.current` using the selector `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`, attach a `keydown` listener that cycles Tab/Shift-Tab within those elements, and save `document.activeElement` as the restore target.
  - When `active` becomes `false`: remove the `keydown` listener and restore focus to the saved element.
  - Re-collect focusable elements on every activation (handles dynamic content inside the panel).
  - _Requirements: 9.4_

- [x] 2. Implement `countActiveFilterGroups` utility and `NavbarSearchRoot` shell
  - In `web/src/components/layouts/navbar-search.tsx`, replace the entire file contents.
  - Add the pure `countActiveFilterGroups(state: FilterState): number` function (from design §Data Models) co-located in the file.
  - Scaffold the `NavbarSearchRoot` component (exported as `NavbarSearch` to match the existing import in `PublicHeader`):
    - Declare local state: `isOpen`, `query`, `results`, `totalCount`, `isLoading`, `selectedIndex`.
    - Read `useFilterStore`, `useSearchParams`, `usePathname`, `useRouter`.
    - Derive `isHostelsPage = pathname === '/hostels' || pathname.startsWith('/hostels/')`.
    - On mount and whenever `useSearchParams` changes, sync `q` param → local `query` state.
    - Add a scroll listener (`addEventListener('scroll', closePanel, { passive: true })`) only while `isOpen` is `true`; remove on close/unmount.
    - Attach an outside-click handler on `containerRef` to close the panel.
    - Return a placeholder `<div ref={containerRef}>` (IdleSearchPill and panel will be wired in subsequent tasks).
  - _Requirements: 1.1, 1.3, 2.10, 7.2, 7.4, 8.5_

- [x] 3. Implement `IdleSearchPill` sub-component
  - Inline `IdleSearchPill` inside `navbar-search.tsx` (not a separate file).
  - Props: `query`, `activeFilterCount`, `isExpanded`, `onActivate`, `triggerRef`.
  - Render a `<button>` styled as a rounded pill (`rounded-full`) with a `<Search />` icon.
  - Visual states:
    - No query, no filters: show "Search hostels" placeholder text in `text-slate-400`.
    - Query present: show query text, truncated at 24 chars on mobile (`truncate max-w-[120px] sm:max-w-none`).
    - Filters active (`activeFilterCount > 0`): show a green badge chip `Filters · {count}` alongside or instead of the placeholder.
  - ARIA: `aria-label="Search hostels"`, `aria-expanded={isExpanded}`, `aria-controls="navbar-search-panel"`, `aria-haspopup="dialog"`.
  - Wire `IdleSearchPill` into `NavbarSearchRoot`'s return JSX; connect `onActivate` to set `isOpen = true` and focus the panel input.
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.3_

- [x] 4. Implement `Backdrop` sub-component and panel open/close lifecycle
  - Inline `Backdrop` inside `navbar-search.tsx`.
  - Renders `<div aria-hidden="true" style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.35)' }}` inside a Framer Motion `AnimatePresence` block (fade in/out with `opacity` only).
  - Wire `Backdrop`'s `onClick` to close the panel (`isOpen = false`), return focus to `triggerRef`.
  - Wire Escape keydown on the panel container to close and return focus.
  - _Requirements: 2.5, 2.6, 2.7, 9.6_

- [x] 5. Implement `ExpandedSearchPanel` sub-component — structure and animation
  - Inline `ExpandedSearchPanel` inside `navbar-search.tsx` per the design interface.
  - Wrap in `AnimatePresence`; apply `mobileVariants` (slide down + fade, 200 ms) below `md:` breakpoint and `desktopVariants` (scale + fade, 200 ms) at `md:` and above.
  - Only animate `transform` and `opacity` (no `height`/`width` animation).
  - Panel attributes: `id="navbar-search-panel"`, `role="dialog"`, `aria-label="Search hostels"`, `aria-modal="true"`.
  - Mobile layout: full-width, `fixed` positioned just below the 56 px navbar, `overflow-y-auto`, `max-h-[calc(100dvh-56px-env(keyboard-inset-height,0px))]`.
  - Desktop layout: `absolute` dropdown, `max-w-[480px]`, anchored below the search area.
  - Call `useFocusTrap(panelRef, isOpen)` from inside the panel (or at `NavbarSearchRoot` level passing the same ref).
  - Auto-focus the `<input>` when the panel opens (pass `inputRef`, call `.focus()` in a `useEffect` that fires when `isOpen` becomes `true`).
  - Apply `touch-manipulation` to all interactive elements inside the panel.
  - _Requirements: 2.2, 2.3, 2.4, 2.8, 2.9, 2.10, 8.1, 8.2, 8.3, 8.4, 9.4, 9.5_

- [x] 6. Wire `ListingSearchInput` and search logic into `ExpandedSearchPanel`
  - Render `ListingSearchInput` at the top of the panel; bind `value={query}`, `onChange`, `onClear`, `onKeyDown`.
  - Debounce `query` by 250 ms using `useDebounce` (already in `NavbarSearchRoot` state).
  - On `/hostels`: sync debounced query to the URL via `router.replace` (no autocomplete dropdown).
  - Off `/hostels`, query ≥ 2 chars: call `searchApi.search({ q: debouncedQuery, limit: 5 })`, store results/totalCount/isLoading; show autocomplete list (see Task 7).
  - `onKeyDown`: Arrow Up/Down navigates `selectedIndex`; Enter calls `handleSearchSubmit`; Escape closes panel.
  - `handleSearchSubmit`: if a result is `selectedIndex`-highlighted, navigate to its listing URL; otherwise, if on `/hostels` use `router.replace`, else `router.push('/hostels?q=…')` preserving `FilterStore.toParams()` params. Close panel after navigation.
  - `onClear`: clear query, remove `q` param from URL if on `/hostels`, keep panel open.
  - Input ARIA: `role="combobox"`, `aria-autocomplete="list"`, `aria-controls="navbar-autocomplete-list"` (when not on `/hostels`).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 7.1, 7.3, 9.7, 11.3, 11.5, 11.6_

- [x] 7. Implement autocomplete results list inside `ExpandedSearchPanel`
  - Render `<ul id="navbar-autocomplete-list" role="listbox">` only when `!isHostelsPage && isOpen && debouncedQuery.length >= 2`.
  - Map over `results` (max 5 items) to render `<li role="option" aria-selected={selectedIndex === idx}>` per item, showing thumbnail, title, price, area — reusing the existing card layout from the current `NavbarSearch` autocomplete dropdown.
  - Show a loading spinner (`<Loader2>`) while `isLoading === true`.
  - Show "No hostels found" empty state when `results.length === 0 && !isLoading`.
  - Render a "View all N results" footer button that calls `handleSearchSubmit()`.
  - On API error: set `results = []`, `totalCount = 0`, log `console.error` — do not show an error banner.
  - _Requirements: 3.5, 9.7, 9.8, 11.4_

- [x] 8. Implement intent chips (`parsedTokens`) display inside `ExpandedSearchPanel`
  - Compute `parsedTokens` via `useMemo(() => { ... parseQuery(query) ... }, [query])` — use the exact assembly logic already present in the current `NavbarSearch` (gender → Ladies/Gents, roomType, maxPrice, minPrice, area, amenities).
  - Render a chip row with a `<Sparkles />` "Filters:" label only when `parsedTokens.length > 0`.
  - Place the chip row between the search input and the autocomplete list (or controls row if no autocomplete).
  - When `parsedTokens.length === 0`, render nothing (no empty container).
  - _Requirements: 3.7, 11.5_

- [x] 9. Implement Filter Controls row inside `ExpandedSearchPanel`
  - Render a horizontally scrollable `<div>` row (`overflow-x-auto scrollbar-none`) below the search input containing three controls:
    1. **Filter button** — triggers `FilterBottomSheet` in `mode="all"`, shows badge with `countActiveFilterGroups(filterState)` when > 0.
    2. **Price button** — triggers `FilterBottomSheet` in `mode="price"`, shows badge when `minPrice || maxPrice`.
    3. **Book a Tour link** — navigates to `/account/book-tour` (authenticated) or `/book-tour` (unauthenticated); closes panel on click.
  - `onApply` for the all-mode sheet: call `handleMobileApply` (sets all filter fields in store). If on `/hostels` use `router.replace`; otherwise `router.push('/hostels?…')` with filter params.
  - `onApply` for price-mode sheet: call `setPriceRange(d.minPrice, d.maxPrice)`, same URL logic.
  - Keep `ExpandedSearchPanel` in the DOM while `FilterBottomSheet` is open (the sheet portal renders above the panel via its own `z-[100]`).
  - Auth check: reuse the same `createClient().auth.getUser()` pattern from `HostelsSearch`.
  - Apply `touch-manipulation` to all three controls.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 8.3, 11.1, 11.2_

- [x] 10. Implement `ActiveFilterChips` display inside `ExpandedSearchPanel`
  - Render `<ActiveFilterChips>` below the controls row, wired to `useFilterStore` actions (`setGenders`, `setAmenities`, `setRoomTypes`, `setPriceRange`, `setZones`, `setMaxDistance`, `setSortByNearest`, `reset`).
  - Show the chips section only when `countActiveFilterGroups(filterState) > 0`; hide it (return null) otherwise to avoid empty space.
  - On any chip removal: if on `/hostels`, sync the updated store state to the URL via `router.replace`.
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 11. Checkpoint — verify `NavbarSearchRoot` in isolation
  - Ensure all tests pass, ask the user if questions arise.
  - Manual smoke check: open the dev server, click the idle pill, confirm the panel opens with focus on the input, press Escape to close and confirm focus returns to the pill.

- [x] 12. Remove the search card from `HostelsSearch`
  - In `web/src/app/(public)/hostels/hostels-search.tsx`:
    - Delete the entire `<div className="bg-white rounded-2xl shadow-…">` search card block, including `<ListingSearchInput>` and the controls `<div>` inside it.
    - Remove the `query` / `committedQuery` local state declarations and their `useState` calls.
    - Remove the `useDebounce` call for the local query (`debouncedQuery` was derived from local `query`).
    - Remove `setQuery` / `setCommittedQuery` and the `handleClearAll` references to them (keep `handleClearAll` for filter reset but remove `setQuery('')` / `setCommittedQuery('')` lines; clearing the search box is now the navbar's responsibility).
    - Remove the `desktopFilterOpen` state and the `FilterSidebar` / `Sheet` desktop sidebar block (Filter controls now live in the navbar panel).
    - Remove imports no longer needed: `ListingSearchInput`, `FilterSidebar`, `FilterBottomSheet` (from the search card), `Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` / `SheetTrigger`, `useDebounce`, `SlidersHorizontal`, `Tag`, `CalendarCheck`.
    - Keep: `hydrateFromParams` effect, the `qParamFromUrl` sync effect, `ActiveFilterChips`, results count line, listing grid, infinite scroll, compare logic, `handleMobileApply`, `handleClearAll` (filter-only).
    - The `combinedFilters` memo and `clientSearch` remain; `debouncedQuery` is now derived from `qParamFromUrl` directly (or replace `debouncedQuery` with `qParamFromUrl` in `combinedFilters` since URL updates are already debounced by the navbar).
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.1, 10.2, 10.3, 10.4_

- [x] 13. Checkpoint — verify end-to-end search flow
  - Ensure all tests pass, ask the user if questions arise.
  - Confirm: `/hostels` renders no `<ListingSearchInput>` element; `ActiveFilterChips` appears without a wrapping card; results grid still filters correctly from URL params.

- [ ] 14. Write property-based tests for `countActiveFilterGroups` and `IdleSearchPill`
  - Create `web/src/components/layouts/__tests__/navbar-search.pbt.test.tsx`.
  - Install `fast-check` as a dev dependency if not already present: `npm install --save-dev fast-check`.
  - Use `fc.record` to generate arbitrary `FilterState` values.

  - [ ]* 14.1 Write property test for idle badge count (Property 2)
    - **Property 2: Active filter badge count equals store count**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 2: badge value === countActiveFilterGroups(state)`
    - Generator: `fc.record({ genders: fc.array(fc.string()), amenities: fc.array(fc.string()), roomTypes: fc.array(fc.string()), minPrice: fc.option(fc.integer({ min: 1000, max: 30000 })), maxPrice: fc.option(fc.integer({ min: 1000, max: 30000 })), zones: fc.array(fc.string()), maxDistance: fc.option(fc.integer({ min: 100, max: 5000 })), sortByNearest: fc.boolean() })`.
    - Render `<IdleSearchPill>` with `activeFilterCount={countActiveFilterGroups(state)}`; assert badge text equals `countActiveFilterGroups(state)` when count > 0, and badge is absent when count === 0.
    - **Validates: Requirements 1.5, 4.8**

  - [ ]* 14.2 Write property test for idle pill query display (Property 1)
    - **Property 1: Idle state reflects URL query**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 1: idle pill displays q param`
    - Generator: `fc.string({ minLength: 1, maxLength: 80 })`.
    - Render `<IdleSearchPill>` with `query={str}`, `activeFilterCount={0}`; assert the pill's text content contains `str` (truncated to first 24 chars on the string used in assertions).
    - **Validates: Requirements 1.4, 7.4**

- [ ] 15. Write property-based tests for `ExpandedSearchPanel`
  - Add tests to `web/src/components/layouts/__tests__/navbar-search.pbt.test.tsx`.

  - [ ]* 15.1 Write property test for autocomplete result count bound (Property 4)
    - **Property 4: Autocomplete result count is bounded at 5**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 4: autocomplete shows min(N, 5) results`
    - Generator: `fc.array(fc.record({ id: fc.string(), title: fc.string(), price: fc.integer({ min: 1000, max: 50000 }), area: fc.option(fc.string()), slug: fc.option(fc.string()), county: fc.option(fc.string()) }), { maxLength: 20 })`.
    - Render the panel with `results={arr}` and query of length ≥ 2 (non-hostels page); assert `queryAllByRole('option').length === Math.min(arr.length, 5)`.
    - **Validates: Requirements 3.5**

  - [ ]* 15.2 Write property test for intent chips mirroring parseQuery (Property 5)
    - **Property 5: Intent chips mirror parseQuery output**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 5: chips match non-free_text tokens`
    - Generator: `fc.string({ minLength: 0, maxLength: 80 })`.
    - For each generated string: compute `parseQuery(str)` in the test; count non-`free_text` tokens; render the panel with `query={str}`; assert the number of rendered chip elements equals the expected count from `parseQuery`.
    - **Validates: Requirements 3.7**

  - [ ]* 15.3 Write property test for Filter button badge (Property 6)
    - **Property 6: Filter button badge count equals active filter group count**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 6: filter button badge === countActiveFilterGroups`
    - Generator: same `FilterState` generator as 14.1.
    - Render the controls row with `filterState={state}`; assert the Filter button shows a badge with value `countActiveFilterGroups(state)` when > 0, and no badge when 0.
    - **Validates: Requirements 4.8, 4.9**

  - [ ]* 15.4 Write property test for ActiveFilterChips presence (Property 7)
    - **Property 7: ActiveFilterChips presence mirrors filter state**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 7: chips present ↔ countActiveFilterGroups > 0`
    - Generator: same `FilterState` generator as 14.1.
    - Render the open panel with `filterState={state}`; assert `ActiveFilterChips` is present in the DOM iff `countActiveFilterGroups(state) > 0`.
    - **Validates: Requirements 5.1, 5.3**

- [ ] 16. Write property-based tests for navigation and routing
  - Add tests to `web/src/components/layouts/__tests__/navbar-search.pbt.test.tsx`. Mock `useRouter`, `usePathname`, `useSearchParams` from `next/navigation`.

  - [ ]* 16.1 Write property test for Enter navigation on non-hostels page (Property 3)
    - **Property 3: Enter navigates with correctly encoded query and preserved filter params**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 3: router.push called with encoded q + filter params`
    - Generator: `fc.tuple(fc.string({ minLength: 1 }), fc.record({ genders: fc.array(fc.constantFrom('male', 'female')), amenities: fc.array(fc.string()), roomTypes: fc.array(fc.string()), minPrice: fc.option(fc.integer({ min: 1000, max: 30000 })), maxPrice: fc.option(fc.integer({ min: 1000, max: 30000 })), zones: fc.array(fc.string()), maxDistance: fc.option(fc.integer()), sortByNearest: fc.boolean() }))`.
    - Seed `useFilterStore` with the generated `FilterState`; render the panel on a non-`/hostels` page; simulate Enter; assert `router.push` was called with a URL starting with `/hostels?q=` where the `q` value equals `encodeURIComponent(query.trim())`, and all non-empty filter params from `FilterStore.toParams()` appear in the URL.
    - **Validates: Requirements 3.2, 7.1, 11.6**

  - [ ]* 16.2 Write property test for router.replace on /hostels (Property 8)
    - **Property 8: router.replace (not push) used for all URL updates on /hostels**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 8: router.replace called on /hostels, never router.push`
    - Generator: `fc.tuple(fc.string({ minLength: 1 }), fc.record({ … same FilterState fields … }))`.
    - Set `pathname = '/hostels'`; simulate a query submission and a filter change; assert `router.replace` was called and `router.push` was never called.
    - **Validates: Requirements 3.3, 7.3**

- [ ] 17. Write example-based unit and integration tests
  - Create `web/src/components/layouts/__tests__/navbar-search.test.tsx`.
  - Mock `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`), `@/lib/api/search`, `@/lib/supabase/client`.

  - [ ]* 17.1 Write unit tests for `NavbarSearchRoot` interaction
    - Idle pill has `aria-label="Search hostels"` and `aria-expanded="false"` on mount.
    - Clicking idle pill opens `ExpandedSearchPanel`; focus moves to the input; `aria-expanded` becomes `"true"`.
    - Pressing Escape while panel is open closes the panel and returns focus to the trigger button.
    - Clicking the backdrop closes the panel.
    - On `/hostels`, typing a query calls `router.replace` (not `router.push`) with the debounced value in the URL.
    - On a non-`/hostels` page, typing ≥ 2 chars eventually calls `searchApi.search`.
    - _Requirements: 2.1, 2.6, 2.7, 3.1, 3.3, 9.1, 9.2, 9.3_

  - [ ]* 17.2 Write unit tests for `HostelsSearch` after search card removal
    - Does not render a `ListingSearchInput` element (`queryByRole('textbox')` returns null in closed panel state).
    - Does not render the search card container (`queryByTestId('search-card')` or `queryByText('Filter')` in the page itself returns null).
    - `ActiveFilterChips` renders directly without a wrapping elevated card.
    - With `?q=foo&gender=female` URL params, the listing grid receives the filtered results.
    - _Requirements: 6.1, 6.2, 6.4, 6.6, 10.1, 10.2_

  - [ ]* 17.3 Write accessibility unit tests
    - `role="combobox"` present on the search input when the panel is open.
    - `aria-hidden="true"` on the backdrop element.
    - `role="listbox"` on the autocomplete list and `role="option"` + `aria-selected` on each item.
    - `role="dialog"` and `aria-label="Search hostels"` on the expanded panel.
    - _Requirements: 9.6, 9.7, 9.8_

  - [ ]* 17.4 Write property test for exactly one search input visible at a time (Property 9)
    - **Property 9: Exactly one search input visible at any time**
    - Tag comment: `// Feature: navbar-search-ux-overhaul, Property 9: 0 or 1 textbox inputs visible`
    - Generator: `fc.tuple(fc.constantFrom('/', '/hostels', '/saved'), fc.boolean())` (route, panel-open).
    - Render `PublicLayout` tree with the given route and panel state; assert `queryAllByRole('textbox').length` is `1` when panel is open, `0` when closed (the idle pill is a `<button>`, not an `<input>`).
    - **Validates: Requirements 10.1, 10.2**

- [ ] 18. Final checkpoint — full test suite passes
  - Run `npx vitest --run` inside `web/` and confirm zero failures.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery.
- Every task can be executed independently in a single focused session, following the listed order.
- The `useFocusTrap` hook (Task 1) must be complete before `ExpandedSearchPanel` (Task 5).
- Tasks 2–10 build the new `NavbarSearchRoot` incrementally; Task 12 removes the now-redundant search card from `HostelsSearch`.
- `FilterBottomSheet` and `ActiveFilterChips` are used as-is — no internal changes to those components.
- All URL updates on `/hostels` use `router.replace`; off `/hostels` use `router.push`.
- Property tests run 100 iterations minimum (fast-check default).
- Each property test references the corresponding property number from the design document.
