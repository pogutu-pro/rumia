# Design Document — Navbar Search UX Overhaul

## Overview

This document describes the technical design for consolidating Rumia's dual search surfaces (the `NavbarSearch` component and the `HostelsSearch` search card) into a single, expandable navbar search experience accessible from every public page.

**Goal:** Replace the compact, filter-less `NavbarSearch` with a two-state component: an idle search pill that is always visible, and an `ExpandedSearchPanel` that slides open to reveal the search input plus the Filter, Price, and Book a Tour controls. The `/hostels` page becomes a results-only view — its search card is removed.

**Scope:** `web/` directory only. No backend, mobile, or API changes.

**Key design decisions:**
- The existing `FilterBottomSheet`, `ActiveFilterChips`, `ListingSearchInput`, `useFilterStore`, `parseQuery`, and `searchApi` are reused without modification.
- All state lives in `useFilterStore` (Zustand) + React local state for panel open/close. No new global state is introduced.
- Framer Motion (already in the stack) handles the panel animation to stay consistent with existing motion patterns.
- Focus management follows the ARIA dialog pattern using a lightweight focus trap (Radix UI `FocusTrap` or a small custom hook).

---

## Architecture

The overhaul touches three layers:

```
PublicHeader (shell, unchanged layout)
  └── NavbarSearchRoot               ← new client component (replaces NavbarSearch)
        ├── IdleSearchPill           ← always rendered, triggers expansion
        ├── ExpandedSearchPanel      ← conditionally rendered / animated
        │     ├── ListingSearchInput (reused)
        │     ├── ControlsRow
        │     │     ├── FilterBottomSheet trigger (mode='all')
        │     │     ├── FilterBottomSheet trigger (mode='price')
        │     │     └── Book a Tour link
        │     ├── IntentChips        ← parsed NLP badges from parseQuery
        │     ├── AutocompleteList   ← only on non-/hostels pages
        │     └── ActiveFilterChips (reused)
        └── Backdrop                 ← aria-hidden overlay

HostelsSearch (gutted)
  ├── [REMOVED] search card container
  ├── ActiveFilterChips              ← now top-level, no enclosing card
  ├── results count line
  └── listing grid (unchanged)
```

**Data flow diagram:**

```
URL params ──► useFilterStore.hydrateFromParams()
                      │
                      ▼
              useFilterStore (Zustand)
                ┌─────┴──────┐
                │             │
         NavbarSearchRoot   HostelsSearch
         (reads + writes)   (reads + writes)
                │
         router.replace (on /hostels)
         router.push    (on other pages)
```

---

## Components and Interfaces

### 1. `NavbarSearchRoot`

**Path:** `web/src/components/layouts/navbar-search.tsx` (replaces current file)

**Responsibility:** Orchestrates idle ↔ expanded state, renders `IdleSearchPill` or `ExpandedSearchPanel`, manages focus, keyboard events, and scroll-to-close behaviour.

```typescript
// Internal state
interface NavbarSearchState {
  isOpen: boolean;          // panel open/closed
  query: string;            // current text input value
  results: Listing[];       // autocomplete results
  totalCount: number;       // total from search API
  isLoading: boolean;       // API fetch in flight
  selectedIndex: number;    // keyboard-highlighted autocomplete item
}
```

**Props:** None (reads from `useFilterStore`, `useSearchParams`, `usePathname`, `useRouter`).

**Key behaviours:**
- Reads `q` from `useSearchParams` on mount and whenever the URL changes; syncs into local `query` state.
- On open: moves focus to the `<input>` inside `ExpandedSearchPanel`.
- On Escape / backdrop click: closes panel, returns focus to `IdleSearchPill` trigger button.
- Scroll listener: `addEventListener('scroll', closePanel, { passive: true })` — added only while panel is open, removed on close/unmount.
- Wraps everything in a `<div ref={containerRef}>` for outside-click detection.

---

### 2. `IdleSearchPill`

**Path:** Inline sub-component inside `navbar-search.tsx`

Renders a `<button>` styled as a rounded search pill. It is the accessible trigger element.

```typescript
interface IdleSearchPillProps {
  query: string;               // current q param — displayed when non-empty
  activeFilterCount: number;   // total across all filter groups
  isExpanded: boolean;         // drives aria-expanded
  onActivate: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}
```

**Visual states:**
- Idle, no query, no filters: shows `<Search />` icon + "Search hostels" placeholder text.
- Idle, query present: shows `<Search />` icon + query text (truncated at 24 chars on mobile).
- Idle, filters active: shows a green badge chip with the count, e.g. `Filters · 3`.
- Aria: `aria-label="Search hostels"`, `aria-expanded={isExpanded}`, `aria-controls="navbar-search-panel"`.

---

### 3. `ExpandedSearchPanel`

**Path:** Inline sub-component inside `navbar-search.tsx`

Animated panel rendered inside a Framer Motion `AnimatePresence` block.

```typescript
interface ExpandedSearchPanelProps {
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onClear: () => void;
  onClose: () => void;
  results: Listing[];
  totalCount: number;
  isLoading: boolean;
  selectedIndex: number;
  onSelectResult: (index: number) => void;
  parsedTokens: string[];
  filterState: FilterState;
  onApplyFilters: (draft: FilterState) => void;
  isHostelsPage: boolean;
  isLoggedIn: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}
```

**Layout (mobile < 768 px):**
```
┌─────────────────────────────────────────────────────┐  ← full-width, slides down from navbar
│  [Search input — full width, auto-focused]          │
│  [Filter] [Price] [Book a Tour]  ← scroll row       │
│  [Intent chips — if any]                            │
│  [Autocomplete results — if not on /hostels]        │
│  [ActiveFilterChips — if filters active]            │
└─────────────────────────────────────────────────────┘
```

**Layout (desktop ≥ 768 px):**
```
                  ┌──────────────────────────────┐  ← dropdown, max-w-[480px], anchored below
                  │  [Search input — full width]  │
                  │  [Filter] [Price] [Book Tour] │
                  │  [Intent chips — if any]      │
                  │  [Autocomplete / results]     │
                  │  [ActiveFilterChips]          │
                  └──────────────────────────────┘
```

**Animation (Framer Motion, GPU-only):**
```typescript
// Mobile: slide down + fade in
const mobileVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

// Desktop: fade in + scale
const desktopVariants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.15 } },
};
```

Only `transform` and `opacity` are animated (Requirement 8.4).

**Focus trap:** Use a `useFocusTrap(containerRef, isOpen)` hook that collects all focusable elements inside the panel on mount and cycles Tab/Shift-Tab within them (Requirement 9.4).

**ARIA:**
- `id="navbar-search-panel"` so the trigger's `aria-controls` points to it.
- `role="dialog"` on the panel, `aria-label="Search hostels"`.
- The inner `<input>` gets `role="combobox"`, `aria-autocomplete="list"`, `aria-controls="navbar-autocomplete-list"` (conditionally).
- `<ul id="navbar-autocomplete-list" role="listbox">` with `<li role="option" aria-selected={…}>` per item.

---

### 4. `Backdrop`

A `<div>` with `position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,0.35)` rendered via `AnimatePresence`. `aria-hidden="true"`, click triggers `onClose`.

The panel sits at `z-index: 50` (same as current navbar `z-50`); the backdrop at `z-40`.

---

### 5. `HostelsSearch` (modified)

**Path:** `web/src/app/(public)/hostels/hostels-search.tsx`

The following are removed:
- The `<div className="bg-white rounded-2xl shadow-[…]">` container that holds `ListingSearchInput` and the controls row.
- The `<ListingSearchInput>` element and its `query` / `committedQuery` local state.
- The `setQuery` / `setCommittedQuery` state and the `useDebounce` call for local query.

The following remain unchanged:
- `hydrateFromParams` effect (reads URL on mount).
- `ActiveFilterChips` (now rendered without the enclosing card `<div>`).
- Results count line.
- Listing grid, progressive rendering, infinite scroll.
- `handleMobileApply`, `handleClearAll`, compare logic.

The `query` state used for `clientSearch` is now driven entirely by the `q` URL param (already handled by the existing `useEffect` that syncs `qParamFromUrl` → `query`). The search box typing path (`setQuery`, `setCommittedQuery`) is removed because the navbar now owns that responsibility.

**Simplified `HostelsSearch` data path after overhaul:**
```
URL ?q=… + filter params
        │
        ▼ hydrateFromParams + qParamFromUrl effect
        │
  local query state ──► clientSearch(allListings, combinedFilters)
                                        │
                                        ▼
                                  typedListings ──► grid
```

---

### 6. `useFocusTrap` hook

**Path:** `web/src/hooks/use-focus-trap.ts` (new)

```typescript
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean,
): void
```

When `active` becomes true: collects all `[href, button, input, select, textarea, [tabindex]:not([tabindex="-1"])` elements inside `containerRef.current`, attaches a `keydown` listener for Tab cycling. Restores focus to the previously focused element when `active` becomes false.

---

## Data Models

No new data models are introduced. All existing types are reused.

### FilterState (existing, unchanged)
```typescript
interface FilterState {
  genders: string[];
  amenities: string[];
  roomTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  zones: string[];
  maxDistance: number | null;
  sortByNearest: boolean;
}
```

### Active filter count helper
A pure utility function (co-located in `navbar-search.tsx`) used by both `IdleSearchPill` (badge) and the Filter button (badge):

```typescript
function countActiveFilterGroups(state: FilterState): number {
  return (
    (state.genders.length > 0 ? 1 : 0) +
    (state.amenities.length > 0 ? 1 : 0) +
    (state.roomTypes.length > 0 ? 1 : 0) +
    (state.minPrice !== null || state.maxPrice !== null ? 1 : 0) +
    (state.zones.length > 0 ? 1 : 0) +
    (state.maxDistance !== null ? 1 : 0)
  );
}
```

### ParsedToken display (existing `parsedTokens` logic from current `NavbarSearch`)
Unchanged. Tags are assembled from `parseQuery(query)` the same way as today:
```typescript
const parsedTokens: string[] = useMemo(() => {
  if (!query.trim()) return [];
  const parsed = parseQuery(query);
  const tags: string[] = [];
  if (parsed.gender) tags.push(parsed.gender === 'female' ? 'Ladies' : 'Gents');
  if (parsed.roomType) tags.push(parsed.roomType.replace(/_/g, ' '));
  if (parsed.maxPrice) tags.push(`Under KES ${parsed.maxPrice.toLocaleString()}`);
  if (parsed.minPrice) tags.push(`From KES ${parsed.minPrice.toLocaleString()}`);
  if (parsed.area) tags.push(parsed.area);
  tags.push(...parsed.amenities);
  return tags;
}, [query]);
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Idle state reflects URL query

*For any* non-empty string value set as the `q` URL search parameter, the idle `IdleSearchPill` should display that string as its current query text.

**Validates: Requirements 1.4, 7.4**

---

### Property 2: Active filter badge count equals store count

*For any* `FilterState` where `countActiveFilterGroups(state) > 0`, the idle `IdleSearchPill` should render a badge, and the badge's numeric value should equal `countActiveFilterGroups(state)`.

**Validates: Requirements 1.5, 4.8**

---

### Property 3: Enter navigates with correctly encoded query and preserved filter params

*For any* non-empty query string typed into the search input on a non-`/hostels` page, pressing Enter should navigate to `/hostels?q={encodeURIComponent(query)}` and all currently active FilterStore params (as serialised by `FilterStore.toParams()`) should be appended to the URL.

**Validates: Requirements 3.2, 7.1, 11.6**

---

### Property 4: Autocomplete result count is bounded

*For any* API response returning N items (N ≥ 0), the autocomplete dropdown should display exactly `min(N, 5)` result rows — never more than 5.

**Validates: Requirements 3.5**

---

### Property 5: Intent chips mirror parseQuery output

*For any* query string for which `parseQuery` returns at least one non-`free_text` token, the `ExpandedSearchPanel` should render a visible chip for each of those tokens, and for any query string where `parseQuery` returns only `free_text` tokens or no tokens, no intent chips should be rendered.

**Validates: Requirements 3.7**

---

### Property 6: Filter button badge count equals active filter group count

*For any* `FilterState`, the Filter button badge inside `ExpandedSearchPanel` should show a count equal to `countActiveFilterGroups(state)` when that count is greater than 0, and should show no badge when the count is 0.

**Validates: Requirements 4.8, 4.9**

*(Note: Properties 2 and 6 test different components — the idle pill vs. the expanded panel Filter button — so both are retained despite testing the same `countActiveFilterGroups` logic.)*

---

### Property 7: ActiveFilterChips presence mirrors filter state

*For any* `FilterState`, when the `ExpandedSearchPanel` is open, `ActiveFilterChips` should be present in the DOM if and only if `countActiveFilterGroups(state) > 0`.

**Validates: Requirements 5.1, 5.3**

---

### Property 8: Router.replace (not push) is used for all URL updates on /hostels

*For any* filter state change or query submission that occurs while the user is on the `/hostels` page, the router method called should be `router.replace` (not `router.push`), so that the browser history stack does not grow with each filter change.

**Validates: Requirements 3.3, 7.3**

---

### Property 9: Exactly one search input visible at any time

*For any* public page rendered through `PublicLayout`, the total number of visible search `<input>` elements on the page should be exactly 1 when the `ExpandedSearchPanel` is open, and 0 when it is closed (the idle state is a `<button>`, not an `<input>`).

**Validates: Requirements 10.1, 10.2**

---

## Error Handling

### API / network errors (autocomplete)
- If `searchApi.search` rejects, set `results = []`, `totalCount = 0`, log to `console.error`.
- Do not show an error banner; the input remains usable and the user can still press Enter to navigate to `/hostels`.
- Debounce prevents spam on transient failures.

### Router errors (navigation)
- Navigation is a fire-and-forget `router.push` / `router.replace`. No special error handling beyond what Next.js provides.

### FilterStore hydration on malformed URL params
- `hydrateFromParams` already gracefully handles missing/malformed values (returns empty arrays / null). No additional handling needed.

### Panel z-index conflicts
- `FilterBottomSheet` renders at `z-[100]` (its existing value). The `ExpandedSearchPanel` is at `z-50` and the `Backdrop` at `z-40`. This stacking ensures the bottom sheet appears above everything else without change.

### Mobile keyboard viewport shift
- The `ExpandedSearchPanel` uses `overflow-y-auto` with a `max-h` constraint (e.g., `max-h-[calc(100dvh-56px-env(keyboard-inset-height,0px))]`) so content remains scrollable when the soft keyboard reduces the visible area (Requirement 8.2).
- `dvh` (dynamic viewport height) is supported in all modern mobile browsers.

---

## Testing Strategy

This feature involves a mix of UI component logic, URL synchronisation, and user interaction flows. The testing approach uses **example-based unit/integration tests** for specific interactions and **property-based tests** for the universal invariants identified in the Correctness Properties section above.

### Property-Based Testing Library

Use **fast-check** (`npm install --save-dev fast-check`) for property tests. It is a mature TypeScript-first PBT library that integrates cleanly with Vitest (the project's test runner).

Each property test runs **100 iterations minimum**.

Tag each property test with a comment:
```
// Feature: navbar-search-ux-overhaul, Property N: <property text>
```

### Unit / Example Tests

Rendered with **@testing-library/react** + **Vitest**. Mock `useRouter`, `useSearchParams`, `usePathname` from `next/navigation`.

**`NavbarSearchRoot` tests:**
- Renders idle pill on mount with correct `aria-label` and `aria-expanded="false"`.
- Clicking the idle pill opens the `ExpandedSearchPanel` and moves focus to the input.
- Pressing Escape closes the panel and returns focus to the trigger button.
- Clicking the backdrop closes the panel.
- When on `/hostels` and query is typed, autocomplete dropdown is absent; `router.replace` is called for URL sync.
- When off `/hostels`, autocomplete dropdown appears after 250 ms debounce.
- Filter button click opens `FilterBottomSheet` in `all` mode.
- Price button click opens `FilterBottomSheet` in `price` mode.
- Book a Tour button links to `/account/book-tour` when authenticated, `/book-tour` otherwise.

**`HostelsSearch` tests:**
- Does not render a `ListingSearchInput` element.
- Does not render the search card container.
- `ActiveFilterChips` renders directly (no wrapping card `<div>`).
- With `?q=foo&gender=female` URL params, `clientSearch` receives those values.

**Accessibility tests:**
- `aria-expanded` on trigger toggles with panel open/close.
- `role="combobox"` on the search input.
- `aria-hidden="true"` on the backdrop.
- `role="listbox"` on autocomplete list; `role="option"` + `aria-selected` on items.

### Property-Based Tests

Each property maps directly to the Correctness Properties section:

| Property | Test input generator | Assertion |
|---|---|---|
| 1 — Idle reflects URL query | `fc.string({ minLength: 1, maxLength: 80 })` | Idle pill text content contains the q param value |
| 2 — Badge count | `fc.record({ genders: fc.array(fc.string()), amenities: fc.array(fc.string()), … })` with at least one non-empty field | Badge value === `countActiveFilterGroups(state)` |
| 3 — Enter encodes query + preserves filter params | `fc.string({ minLength: 1 })` × arbitrary `FilterState` | `router.push` called with correctly encoded URL |
| 4 — Autocomplete bounded at 5 | `fc.array(fc.record({…}), { maxLength: 20 })` | `Math.min(results.length, 5)` rows in DOM |
| 5 — Intent chips mirror parseQuery | `fc.string()` | chips count matches non-free_text tokens from `parseQuery` |
| 6 — Filter button badge | arbitrary `FilterState` | badge value === `countActiveFilterGroups(state)` or absent |
| 7 — ActiveFilterChips presence | arbitrary `FilterState` | chip presence ↔ `countActiveFilterGroups > 0` |
| 8 — router.replace on /hostels | arbitrary `FilterState` + query | mock confirms `replace` called, never `push` |
| 9 — One search input | route enum × panel state | `queryAllByRole('textbox').length` in {0, 1} |

### Integration / Smoke Tests
- Manual or Playwright end-to-end: open home page, expand search, type a query, press Enter → land on `/hostels` with correct URL params and results.
- Visual check: panel animation uses only `transform`/`opacity` (no `height` animation).
- `touch-manipulation` on interactive elements inside the panel — checked via computed style in Playwright.
