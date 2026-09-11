# Requirements Document

## Introduction

The Rumia web app currently has two separate search surfaces: a small inline search input inside `PublicHeader` (rendered via `NavbarSearch`) and a full search panel at the top of the `/hostels` page (`HostelsSearch`) that includes a search text field, Filter, Price, and Book a Tour controls. This split creates a confusing UX — users encounter a limited search in the navbar and a richer-but-redundant search when they reach `/hostels`.

This feature consolidates everything into a single, expandable navbar search experience. When idle, the navbar shows a compact, clean search pill. When activated, it expands into a full search panel containing the text input plus the Filter, Price, and Book a Tour controls. The `/hostels` page retains its results grid but stops acting as a search interface — its own search card is removed. The new navbar search is available from every page on the Rumia web app.

**Stack (confirmed by audit):** Next.js 16 App Router, React 19, Tailwind CSS v4, Zustand (filter-store, compare-store, wishlist-store), Radix UI primitives, Framer Motion, `lucide-react` icons, PWA with a `BottomNav` fixed at the bottom on mobile. The web app lives at `web/`.

**Key existing components to reuse:**
- `FilterBottomSheet` (`web/src/components/ui/filter/filter-bottom-sheet.tsx`) — all filter modes (`all`, `price`, `distance`)
- `FilterSidebar` (`web/src/components/ui/filter/filter-sidebar.tsx`)
- `ActiveFilterChips` (`web/src/components/ui/filter/active-filter-chips.tsx`)
- `useFilterStore` (`web/src/stores/filter-store.ts`) — central filter state with URL serialisation
- `ListingSearchInput` (`web/src/components/ui/listing-search-input.tsx`)
- `parseQuery` (`web/src/lib/search/parse-query.ts`) — NLP intent extraction

---

## Glossary

- **Navbar**: The fixed top header bar rendered by `PublicHeader` on all public pages; currently 56 px tall, `z-50`.
- **NavbarSearch**: The existing React component (`web/src/components/layouts/navbar-search.tsx`) — a compact inline search input rendered inside the Navbar.
- **ExpandedSearchPanel**: The new full-width overlay or drop-down that opens when the user activates the Navbar search field.
- **HostelsSearch**: The existing client component (`web/src/app/(public)/hostels/hostels-search.tsx`) that owns the search card plus results grid on the `/hostels` page.
- **FilterStore**: The Zustand store (`useFilterStore`) holding the canonical filter state (genders, amenities, roomTypes, minPrice, maxPrice, zones, maxDistance, sortByNearest) and its URL serialisation helpers.
- **Filter Controls**: The trio of interactive controls — Filter (opens `FilterBottomSheet` in `all` mode), Price (opens `FilterBottomSheet` in `price` mode), and Book a Tour (links to `/book-tour` or `/account/book-tour`).
- **ActiveFilterChips**: The pill row that shows currently applied filters with individual remove buttons.
- **SearchQuery**: The free-text search string synced to the URL `q` param.
- **BottomNav**: The fixed mobile navigation bar visible on small screens (`web/src/components/pwa/BottomNav.tsx`).
- **PublicLayout**: The Next.js layout wrapping all public pages (`web/src/app/(public)/layout.tsx`), which renders `PublicHeader`.
- **Backdrop**: A semi-transparent overlay that appears behind the `ExpandedSearchPanel` to dim page content.

---

## Requirements

### Requirement 1: Consolidated Navbar Search Entry Point

**User Story:** As a student browsing the Rumia web app, I want a single, persistent search control in the top navbar, so that I can initiate or refine a hostel search from any page without hunting for a separate search page.

#### Acceptance Criteria

1. THE Navbar SHALL render a visible search control on every public page at all times.
2. WHEN the Navbar search control is in its idle (collapsed) state, THE Navbar SHALL display a search text placeholder and a search icon, and SHALL NOT display Filter, Price, or Book a Tour controls.
3. THE Navbar search control SHALL occupy the centre slot of the Navbar, consistent with the existing layout structure in `PublicHeader`.
4. WHEN the page URL contains a non-empty `q` parameter, THE Navbar search control SHALL display the query text in its idle state so the current search is visible without opening the panel.
5. WHEN active filter state exists in the FilterStore (one or more of genders, amenities, roomTypes, minPrice, maxPrice, zones is non-empty), THE Navbar search control SHALL display a numeric active-filter badge on the search control in its idle state.

---

### Requirement 2: Expandable Search Panel Activation

**User Story:** As a student, I want the navbar search to expand into a full search experience when I click or tap it, so that I can access filters, price controls, and tour booking without navigating away from my current page.

#### Acceptance Criteria

1. WHEN the user clicks or taps the idle Navbar search control, THE Navbar SHALL transition the search control into the ExpandedSearchPanel state.
2. WHEN the ExpandedSearchPanel opens, THE Navbar SHALL display: the search text input (with cursor focused), the Filter button, the Price button, and the Book a Tour button.
3. WHEN the ExpandedSearchPanel opens on a viewport narrower than 768 px, THE Navbar SHALL render the ExpandedSearchPanel as a full-width panel that slides down from the Navbar without pushing page content below.
4. WHEN the ExpandedSearchPanel opens on a viewport 768 px or wider, THE Navbar SHALL render the ExpandedSearchPanel as a dropdown panel anchored below the Navbar search area.
5. THE Navbar SHALL display a Backdrop behind the ExpandedSearchPanel whenever the panel is open.
6. IF the ExpandedSearchPanel is open AND the user presses the Escape key, THEN THE Navbar SHALL close the ExpandedSearchPanel and return focus to the trigger element.
7. IF the ExpandedSearchPanel is open AND the user clicks or taps the Backdrop, THEN THE Navbar SHALL close the ExpandedSearchPanel.
8. WHEN the ExpandedSearchPanel opens, THE Navbar SHALL apply a smooth CSS transition of no more than 250 ms to the panel entrance (translate and opacity).
9. WHEN the ExpandedSearchPanel closes, THE Navbar SHALL apply a smooth CSS transition of no more than 200 ms to the panel exit.
10. THE Navbar SHALL NOT cause layout shift in the page content below when the ExpandedSearchPanel opens or closes.

---

### Requirement 3: Search Text Input Behaviour

**User Story:** As a student, I want the search text input inside the expanded panel to behave consistently with how search currently works, so that I get results as I type and can submit a search with Enter.

#### Acceptance Criteria

1. WHEN the ExpandedSearchPanel is open, THE Search_Input SHALL accept free-text and SHALL debounce input by 250 ms before triggering search updates.
2. WHEN the user presses Enter or submits the search form inside the ExpandedSearchPanel, THE Navbar SHALL navigate the browser to `/hostels?q={encoded_query}` (preserving any active filter URL params from FilterStore), and SHALL close the ExpandedSearchPanel.
3. WHEN the user presses Enter or submits the search form inside the ExpandedSearchPanel while already on `/hostels`, THE Navbar SHALL update the URL query param `q` in place using `router.replace` (no full navigation) and SHALL close the ExpandedSearchPanel.
4. WHEN the search text input contains a value and the user clicks the clear (×) button, THE Search_Input SHALL clear the text, SHALL remove the `q` param from the URL if already on `/hostels`, and SHALL keep the ExpandedSearchPanel open.
5. WHEN the Search_Input value is at least 2 characters and the user is NOT on `/hostels`, THE Navbar SHALL display an autocomplete dropdown inside the ExpandedSearchPanel showing up to 5 live search results from the `/search` API endpoint.
6. WHEN the user is on `/hostels`, THE Navbar SHALL NOT show the autocomplete dropdown; it SHALL instead filter results on the page in real time by syncing the debounced query to the FilterStore.
7. WHEN the Search_Input contains a query that the `parseQuery` utility can extract intent from (gender, room type, price, area, amenities), THE Navbar SHALL display the extracted intent tokens as labelled badge chips inside the ExpandedSearchPanel above the autocomplete results.

---

### Requirement 4: Filter, Price, and Book a Tour Controls

**User Story:** As a student, I want the Filter, Price, and Book a Tour controls to be available inside the expanded search panel, so that I can refine my search by location, price range, and schedule a tour all from the navbar without navigating to `/hostels` first.

#### Acceptance Criteria

1. WHEN the ExpandedSearchPanel is open, THE Navbar SHALL render the Filter button, the Price button, and the Book a Tour button in a horizontal scrollable row below the search text input.
2. WHEN the user clicks or taps the Filter button inside the ExpandedSearchPanel, THE Navbar SHALL open the `FilterBottomSheet` component in `all` mode (reusing the existing component without reimplementing filter logic).
3. WHEN the user clicks or taps the Price button inside the ExpandedSearchPanel, THE Navbar SHALL open the `FilterBottomSheet` component in `price` mode.
4. WHEN the user clicks or taps the Book a Tour button inside the ExpandedSearchPanel, THE Navbar SHALL navigate the user to `/account/book-tour` if the user is authenticated, or to `/book-tour` if not authenticated, and SHALL close the ExpandedSearchPanel.
5. WHEN the FilterBottomSheet is open (from any button in the ExpandedSearchPanel), THE Navbar SHALL keep the ExpandedSearchPanel in the DOM (it SHALL NOT close the ExpandedSearchPanel beneath the sheet).
6. WHEN the user applies filters via `FilterBottomSheet` from within the ExpandedSearchPanel, THE FilterStore SHALL update its state, and IF the user is on `/hostels`, THE Navbar SHALL sync the new filter state to the URL using `router.replace`.
7. WHEN the user applies filters via `FilterBottomSheet` from within the ExpandedSearchPanel while NOT on `/hostels`, THE Navbar SHALL navigate to `/hostels` with the filter params appended to the URL.
8. WHEN the Filter button has at least one active filter (from FilterStore), THE Navbar SHALL display a numeric badge on the Filter button showing the count of active filter groups.
9. WHEN the Price button has an active price filter (minPrice or maxPrice is non-null in FilterStore), THE Navbar SHALL display a badge on the Price button.

---

### Requirement 5: Active Filter State Display in Expanded Panel

**User Story:** As a student who has set filters, I want to see my active filters listed inside the expanded search panel, so that I know what is applied and can remove individual filters without leaving the panel.

#### Acceptance Criteria

1. WHEN the ExpandedSearchPanel is open and one or more filters are active in FilterStore, THE Navbar SHALL render the `ActiveFilterChips` component below the Filter Controls row.
2. WHEN the user removes a filter chip inside the ExpandedSearchPanel, THE FilterStore SHALL update, and THE Navbar SHALL reflect the change immediately (chip disappears, badge count updates).
3. WHEN all filters are cleared, THE Navbar SHALL hide the `ActiveFilterChips` row inside the ExpandedSearchPanel without layout shift.

---

### Requirement 6: Hostel Results Page — Search Card Removal

**User Story:** As a student arriving at `/hostels`, I want the page to focus on showing me results, so that I don't see a duplicated search interface that is already available in the navbar.

#### Acceptance Criteria

1. THE Hostels_Page SHALL NOT render the elevated search card (search input + Filter, Price, Book a Tour controls row) that currently appears at the top of `HostelsSearch`.
2. THE Hostels_Page SHALL continue to render the `ActiveFilterChips` row directly, without the enclosing search card container.
3. THE Hostels_Page SHALL continue to render the results count line below the `ActiveFilterChips` row.
4. THE Hostels_Page SHALL continue to apply client-side filtering and display the hostel results grid exactly as before.
5. WHEN the user arrives at `/hostels` with URL params (`q`, `gender`, `amenities`, etc.), THE Hostels_Page SHALL hydrate the FilterStore from those URL params and apply them to the results, consistent with current behaviour.
6. THE Hostels_Page SHALL NOT contain a `ListingSearchInput` component or a standalone search `<input>` at the top of its layout.

---

### Requirement 7: Search State Consistency Across Navigation

**User Story:** As a student, I want my search query and filters to remain consistent as I navigate between pages, so that I don't lose my search context when I go back or switch pages.

#### Acceptance Criteria

1. WHEN the user navigates from a non-`/hostels` page to `/hostels` via the navbar search, THE Hostels_Page SHALL receive the SearchQuery and active FilterStore state via URL params and SHALL display matching results immediately.
2. WHEN the user navigates away from `/hostels` and returns using the browser back button, THE Navbar search control SHALL reflect the SearchQuery from the URL `q` param.
3. WHEN the FilterStore state changes on `/hostels` (via filter controls in the ExpandedSearchPanel), THE URL SHALL be updated using `router.replace` so the browser history entry is updated in place rather than creating a new history stack entry per keystroke.
4. WHEN the user opens the ExpandedSearchPanel on any page, THE Search_Input SHALL be pre-populated with the current `q` URL param value if present.
5. WHILE the FilterStore has active state, THE Navbar SHALL display the active-filter badge on the idle search control regardless of the current page, so the user always knows filters are applied.

---

### Requirement 8: Mobile Web Interaction Quality

**User Story:** As a student on a mobile device (including low-end Android browsers), I want the navbar search expansion to feel smooth and native, so that the interaction does not feel sluggish or cause jarring layout jumps.

#### Acceptance Criteria

1. WHEN the ExpandedSearchPanel opens on a mobile viewport, THE Navbar SHALL automatically focus the Search_Input so the software keyboard appears without requiring an additional tap.
2. WHEN the software keyboard appears on a mobile device and reduces the visible viewport, THE ExpandedSearchPanel SHALL remain fully scrollable and SHALL NOT have its action buttons clipped off screen.
3. THE Navbar SHALL use `touch-manipulation` CSS on all interactive elements inside the ExpandedSearchPanel to eliminate the 300 ms tap delay on mobile browsers.
4. THE Navbar expansion animation SHALL use only CSS `transform` and `opacity` properties (GPU-accelerated) and SHALL NOT animate `height`, `width`, `top`, `margin`, or `padding` to avoid layout recalculation on low-end devices.
5. IF the ExpandedSearchPanel is open AND the user scrolls the page (e.g., with an inertia swipe), THEN THE Navbar SHALL close the ExpandedSearchPanel so the user can freely scroll results.
6. WHEN the ExpandedSearchPanel is open on mobile, THE BottomNav SHALL remain visible and accessible below the panel.

---

### Requirement 9: Accessibility

**User Story:** As a student using assistive technology or keyboard navigation, I want the navbar search to be fully accessible, so that I can use it without a mouse or pointer device.

#### Acceptance Criteria

1. THE Navbar search control SHALL have an accessible `aria-label` of `"Search hostels"` when in idle state.
2. WHEN the ExpandedSearchPanel is open, THE Navbar SHALL set `aria-expanded="true"` on the trigger element.
3. WHEN the ExpandedSearchPanel is closed, THE Navbar SHALL set `aria-expanded="false"` on the trigger element.
4. THE ExpandedSearchPanel SHALL trap focus within the panel while it is open, following the ARIA dialog pattern.
5. WHEN the ExpandedSearchPanel opens, THE Navbar SHALL move focus to the Search_Input automatically.
6. THE Backdrop SHALL have `aria-hidden="true"` so screen readers do not announce the overlay.
7. THE Search_Input inside the ExpandedSearchPanel SHALL have `role="combobox"`, `aria-autocomplete="list"`, and `aria-controls` pointing to the autocomplete results list when the dropdown is visible.
8. THE autocomplete results list SHALL have `role="listbox"` and each result item SHALL have `role="option"` with `aria-selected` reflecting keyboard-highlight state.

---

### Requirement 10: No Duplicate Search Interfaces

**User Story:** As a student, I want there to be exactly one search experience on the site at any time, so that I am never confused about which search bar I should use.

#### Acceptance Criteria

1. THE Application SHALL NOT render more than one active search text input visible to the user simultaneously on any given page.
2. THE Hostels_Page SHALL NOT render its own standalone search input or search card when the ExpandedSearchPanel is the designated search entry point.
3. THE Navbar SHALL be the sole owner of the search entry point and Filter Controls on all public pages.
4. WHEN the user is on `/hostels` and the ExpandedSearchPanel is closed, the page SHALL display only the `ActiveFilterChips` (if any) and the results count — no separate search controls.

---

### Requirement 11: Preserve Existing Logic — No Regressions

**User Story:** As a developer maintaining Rumia, I want the overhaul to reuse existing search, filter, and tour-booking logic without reimplementing it, so that bugs already fixed in those components are not re-introduced.

#### Acceptance Criteria

1. THE Navbar SHALL invoke `FilterBottomSheet` for all filter interactions and SHALL NOT reimplement any filter UI logic inline.
2. THE Navbar SHALL use `useFilterStore` for all filter state management and SHALL NOT introduce a parallel filter state.
3. THE Navbar SHALL use `ListingSearchInput` or an equivalent input primitive for the Search_Input and SHALL NOT reimplement search debouncing independently.
4. THE Navbar SHALL call the existing `/search` API endpoint (via `searchApi.search`) for autocomplete previews and SHALL NOT add a new API endpoint.
5. THE Navbar SHALL use `parseQuery` for NLP intent extraction in the autocomplete section and SHALL NOT duplicate that logic.
6. WHEN existing `FilterStore.hydrateFromParams` and `FilterStore.toParams` helpers are available, THE Navbar SHALL use them for URL ↔ state synchronisation.
