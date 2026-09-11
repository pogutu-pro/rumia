# Requirements Document

## Introduction

The Videos Feed feature adds a dedicated `/videos` screen to the Rumia mobile app — a premium short-form property discovery experience built on top of existing data. Every listing in Rumia already stores a `youtube_id` (YouTube Shorts URL) and an `is_youtube_shorts` boolean on the `Listing` model. This feature surfaces those videos in a vertically snapping, full-screen feed similar to TikTok/Instagram Reels, while keeping every video anchored to its property. No new video hosting, no duplicate data models, no parallel systems — the Videos Feed reuses the existing `/listings` API endpoint (filtered to records where `youtube_id IS NOT NULL`), the existing `Listing` schema, the existing `ContactModal`, save/wishlist, and Share APIs, and the existing design tokens (`palette`, `lightColors`, `radii`, `shadows` from `mobile/lib/theme.ts`).

The screen is implemented as a new Expo Router file-based route at `mobile/app/(tabs)/videos.tsx`, making it a bottom-tab peer of the existing Home, Search, Verify, and Account tabs. The `react-native-webview` package (not yet in the project) is required to embed YouTube players — it must be added as a new dependency. Visibility is controlled by the existing `is_active` flag on the Listing model. Ordering follows the existing `sort_position ASC NULLS LAST, created_at DESC` convention already used by the listings feed.

**Audit-derived constraints applied throughout:**
- Video data lives on `Listing.youtube_id` and `Listing.is_youtube_shorts` — no new tables.
- Data is fetched via `apiFetch('/listings', { params: { has_video: true, ... } })` using the existing `apiFetch` client with Supabase JWT injection.
- The backend `/listings` endpoint already supports `is_active` filtering and `sort_position` ordering.
- WhatsApp/contact reuses the existing `ContactModal` from `mobile/features/listings/contact-modal.tsx`.
- Save/wishlist reuses `apiFetch('/profiles/me/wishlist/{id}', { method: 'POST/DELETE' })` with the auth-gate pattern from the listing detail page.
- Share reuses React Native's `Share.share()` already used on the listing detail screen.
- Navigation integrates into the existing tab layout in `mobile/app/(tabs)/_layout.tsx` using the `TABS` array pattern.
- Auth state is read from `useSessionStore` (`mobile/stores/session.ts`).
- Empty and error states use the `EmptyState` and `Skeleton` components from `mobile/lib/components/ui.tsx`.

---

## Glossary

- **Videos_Feed**: The `/videos` screen — a full-screen, vertically snapping short-form video feed within the Rumia mobile app.
- **Video_Item**: A single Listing record that has a non-null `youtube_id` field, rendered as one video card in the feed.
- **YouTube_Player**: The embedded YouTube player rendered inside a `react-native-webview` WebView for a single Video_Item.
- **Active_Item**: The Video_Item currently snapped into the visible viewport; its YouTube_Player is playing (or ready to play).
- **Inactive_Item**: Any Video_Item not currently snapped into view; its YouTube_Player is paused or unloaded.
- **Property_Overlay**: The UI layer rendered on top of or below the YouTube_Player that shows property context: title, price, location, property type badge, and conversion actions.
- **Conversion_Actions**: The set of interactive buttons for a Video_Item: View Listing, Contact (WhatsApp), Save, and Share.
- **ContactModal**: The existing bottom-sheet component at `mobile/features/listings/contact-modal.tsx` that handles WhatsApp contact flows.
- **Listing_Model**: The `ListingRead` type from `mobile/lib/api/schema.ts`, backed by the `listings` table in the database. Fields relevant to the Videos Feed: `id`, `slug`, `title`, `price`, `location`, `area`, `property_type`, `youtube_id`, `is_youtube_shorts`, `is_active`, `sort_position`, `is_saved`, `is_full`, `agent`, `landlord_phone`, `pays_commission`.
- **Property_Type**: The `property_type` field on a Listing — one of `"hostel"`, `"apartment"`, or `"short_stay"`.
- **Rumia_Design_System**: The design tokens defined in `mobile/lib/theme.ts`: `palette`, `lightColors`, `radii`, `spacing`, `shadows`, `iconSize`.
- **Tab_Bar**: The existing bottom navigation bar defined in `mobile/app/(tabs)/_layout.tsx`.
- **apiFetch**: The authenticated HTTP client at `mobile/lib/api/client.ts` that injects Supabase JWTs and handles retries.

---

## Requirements

### Requirement 1: Video Data Discovery via Existing Listings API

**User Story:** As a Rumia user, I want to see only properties that have videos in the Videos Feed, so that every card in the feed has real playable content.

#### Acceptance Criteria

1. WHEN the Videos_Feed screen loads, THE Videos_Feed SHALL fetch listings from the existing `/listings` API endpoint using `apiFetch` with the query parameter `has_video=true` (or equivalent backend filter for `youtube_id IS NOT NULL`).
2. THE Videos_Feed SHALL only display Listing records where both `youtube_id` is non-null and `is_active` is `true`.
3. WHEN fetching listings, THE Videos_Feed SHALL pass the existing `sort_position ASC NULLS LAST, created_at DESC` ordering (the default ordering of the `/listings` endpoint when no `sort` param is given).
4. THE Videos_Feed SHALL use `@tanstack/react-query` with `queryKey: ['videos-feed']` to cache and manage the fetched video listings, consistent with the pattern used across other screens in the app.
5. IF the `/listings` API call fails with a network error, THEN THE Videos_Feed SHALL display a Rumia-styled error state with a retry button, without crashing the app.
6. IF the `/listings` API call fails with a 404 or 500, THEN THE Videos_Feed SHALL display the same error state as a network failure, and the error SHALL NOT propagate to other screens.

---

### Requirement 2: Paginated Video Feed with Lazy Loading

**User Story:** As a Rumia user on an older Android device, I want the Videos Feed to load fast and not lag when I scroll, so that I can browse smoothly even on a slow connection.

#### Acceptance Criteria

1. THE Videos_Feed SHALL initially load a maximum of 10 Video_Items per page (matching the `limit` parameter pattern used by the home screen).
2. WHEN the user scrolls to within 2 Video_Items of the end of the current page, THE Videos_Feed SHALL automatically fetch the next page of listings and append them to the feed.
3. AT ANY GIVEN TIME, THE Videos_Feed SHALL have at most 3 YouTube_Players mounted in the React tree — the Active_Item player and one adjacent player on each side — to limit memory usage on older Android devices.
4. WHEN a Video_Item is more than 2 positions away from the Active_Item, THE Videos_Feed SHALL unmount or replace its YouTube_Player with a static thumbnail (the first image from `listing.images` or a branded placeholder) to free memory.
5. THE Videos_Feed SHALL NOT trigger a full-list re-render when only the active index changes, using `React.memo` or `useCallback` to isolate per-item renders.
6. WHEN all pages have been loaded and no more pages exist (`page >= pages`), THE Videos_Feed SHALL display a polished Rumia end-of-feed indicator rather than an infinite loader.

---

### Requirement 3: Full-Screen Vertically Snapping Feed Layout

**User Story:** As a Rumia user, I want to scroll vertically through property videos that snap into place, so that I always see exactly one video at a time, just like TikTok or Instagram Reels.

#### Acceptance Criteria

1. THE Videos_Feed SHALL render Video_Items in a vertically scrolling `FlatList` with `pagingEnabled={true}` so that each scroll gesture snaps to exactly one Video_Item.
2. EACH Video_Item SHALL occupy 100% of the device viewport height (using `useWindowDimensions().height`) so that one and only one video is visible at a time.
3. THE Videos_Feed SHALL use `decelerationRate="fast"` on the FlatList to ensure snapping feels responsive on touch.
4. THE Videos_Feed SHALL NOT use nested scroll containers inside Video_Items, to prevent scroll conflicts on Android.
5. THE Videos_Feed SHALL set `showsVerticalScrollIndicator={false}` to preserve the immersive feel.
6. WHEN the feed is displayed on a device with safe-area insets (notch, home indicator), THE Videos_Feed SHALL account for insets so the Property_Overlay controls are reachable and not obscured.
7. THE Videos_Feed SHALL use `removeClippedSubviews={true}` on the FlatList to release off-screen native views on Android.

---

### Requirement 4: YouTube Player Embedding and Playback Control

**User Story:** As a Rumia user, I want the active video to play automatically and pause when I scroll away, so that only one video plays at a time and I don't experience audio overlap.

#### Acceptance Criteria

1. THE Videos_Feed SHALL embed each YouTube video using a `react-native-webview` WebView rendering a YouTube IFrame embed URL constructed from `listing.youtube_id`.
2. WHEN `listing.is_youtube_shorts` is `true`, THE Videos_Feed SHALL use the YouTube Shorts embed URL format (`https://www.youtube.com/embed/{youtube_id}?...`) with appropriate embed parameters.
3. WHEN a Video_Item becomes the Active_Item (snaps into view), THE YouTube_Player SHALL begin or resume playback with `autoplay=1` in the embed URL parameters, subject to browser/WebView autoplay policy.
4. WHEN the user mutes at the session level, THE YouTube_Player SHALL start all subsequent videos with `mute=1` in the embed parameters; when unmuted, THE YouTube_Player SHALL use `mute=0`.
5. WHEN a Video_Item becomes Inactive (scrolls out of the snapped viewport), THE Videos_Feed SHALL reload that Video_Item's WebView with `autoplay=0` (or set `mute=1`) to silence it.
6. THE Videos_Feed SHALL pass `allowsInlineMediaPlayback={true}` and `mediaPlaybackRequiresUserAction={false}` to each WebView to allow autoplay on iOS.
7. THE embed URL SHALL include `controls=1`, `rel=0`, `modestbranding=1`, and `playsinline=1` parameters to minimize YouTube chrome and prevent recommended video navigation.
8. IF a `youtube_id` produces a failed embed (HTTP error, video deleted, private video), THEN THE Videos_Feed SHALL display a Rumia-branded fallback card with the Property_Overlay still visible and a "Video unavailable" label, so the property can still be actioned.
9. THE Videos_Feed SHALL include a mute/unmute toggle button in the Property_Overlay; its state SHALL be persisted across Video_Items within the session using a component-level `useState` in the screen root.

---

### Requirement 5: Property Context Overlay

**User Story:** As a Rumia user watching a short-form property video, I want to see key property details without leaving the feed, so that I can decide whether to take action without losing my place.

#### Acceptance Criteria

1. EACH Video_Item SHALL display a Property_Overlay that is always visible (not a hidden toggle) and positioned at the bottom of the Video_Item, above the safe area inset.
2. THE Property_Overlay SHALL display: listing title, formatted price (`formatKESPerMonth` from `mobile/lib/format.ts`), location field, and property type badge.
3. THE Property_Overlay SHALL adapt its price label based on `property_type`: `"hostel"` → "KES X/mo", `"apartment"` → "KES X/mo", `"short_stay"` → "KES X/night" (using `bnb.price_unit` if available, otherwise `"/night"`).
4. THE Property_Overlay SHALL display a property type badge: `"hostel"` → "Hostel", `"apartment"` → "Apartment", `"short_stay"` → "Short Stay" — using only the `property_type` field already available on `ListingRead`.
5. WHEN `listing.area` is non-null, THE Property_Overlay SHALL display the area alongside the location.
6. THE Property_Overlay SHALL use a gradient overlay at the bottom of the video frame (dark-to-transparent from bottom to mid-frame) so the text remains legible against any video content.
7. THE Property_Overlay SHALL follow the Rumia_Design_System: text in white (`#ffffff`) over the gradient, Rumia green (`palette.emerald[600]`) for price and accents, `palette.slate[300]` for secondary text, `radii['2xl']` for pill shapes.

---

### Requirement 6: Conversion Actions (View, Contact, Save, Share)

**User Story:** As a Rumia user discovering a property through the Videos Feed, I want to take action directly from the feed — view the full listing, contact the agent, save it, or share it — so that I don't have to leave the feed to convert.

#### Acceptance Criteria

1. EACH Video_Item SHALL display four Conversion_Actions as icon buttons arranged vertically on the right side of the Video_Item, consistent with the Reels/Shorts interaction paradigm.
2. WHEN the user taps "View Listing", THE Videos_Feed SHALL navigate to `router.push('/listing/${listing.slug || listing.id}')` using the existing Expo Router navigation, matching the pattern used in `mobile/app/(tabs)/saved.tsx`.
3. WHEN the user taps "Contact", THE Videos_Feed SHALL open the existing `ContactModal` component (from `mobile/features/listings/contact-modal.tsx`) for the current Video_Item's listing, reusing its WhatsApp flow without modification.
4. WHEN the user taps "Save" and the user is authenticated, THE Videos_Feed SHALL call `apiFetch('/profiles/me/wishlist/{listing.id}', { method: 'POST' })` to save or `{ method: 'DELETE' }` to unsave, and SHALL update the heart icon fill state, matching the save pattern in `mobile/app/listing/[slug].tsx`.
5. WHEN the user taps "Save" and the user is NOT authenticated, THE Videos_Feed SHALL navigate to `router.push('/(auth)/login')`, matching the auth-gate pattern in the listing detail page.
6. WHEN the user taps "Share", THE Videos_Feed SHALL invoke `Share.share({ message: '...' })` using React Native's built-in Share API, with a message that includes the listing title, price, and location — matching the format used in `mobile/app/listing/[slug].tsx`.
7. THE Save button SHALL reflect the current `listing.is_saved` state from the API response with a filled heart icon (`palette.rose[500]`) when saved and an outlined heart when unsaved.
8. AFTER a successful save/unsave mutation, THE Videos_Feed SHALL invalidate the `['wishlist']` query key to keep the Saved tab in sync, matching the pattern in the listing detail screen.

---

### Requirement 7: Property-Aware UI Adaptation

**User Story:** As a Rumia user, I want the Videos Feed UI to accurately reflect the type of property I'm viewing, so that the information shown is relevant and not confusing.

#### Acceptance Criteria

1. WHEN `property_type` is `"short_stay"`, THE Property_Overlay SHALL display pricing in per-night terms and show the "Short Stay" badge using Rumia amber (`palette.amber[500]`) accent.
2. WHEN `property_type` is `"hostel"`, THE Property_Overlay SHALL display pricing in per-month terms and show the "Hostel" badge using Rumia green (`palette.emerald[600]`) accent.
3. WHEN `property_type` is `"apartment"`, THE Property_Overlay SHALL display pricing in per-month terms and show the "Apartment" badge using `palette.sky[600]` accent.
4. THE Property_Overlay SHALL NOT display fields that are null or missing in the Listing record — if `listing.area` is null, the area is omitted; if `listing.distance_to_campus` is null, it is omitted.
5. WHEN `listing.is_full` is `true`, THE Property_Overlay SHALL display a "Fully Occupied" pill badge over the property title so users can see availability before tapping Contact.

---

### Requirement 8: Tab Navigation Integration

**User Story:** As a Rumia user, I want to discover the Videos Feed from the main navigation, so that it feels like a first-class part of the app.

#### Acceptance Criteria

1. THE Videos_Feed SHALL be added as a new tab in the existing Tab_Bar defined in `mobile/app/(tabs)/_layout.tsx` by adding an entry to the `TABS` array with `name: 'videos'`, an appropriate label (e.g. "Videos"), and a suitable Lucide icon (e.g. `Play` or `Clapperboard`).
2. THE Tab_Bar SHALL display the Videos tab between existing tabs in a position that does not overcrowd the bar — a maximum of 5 tabs are acceptable; if 5 tabs overcrowd the bar, the Videos tab SHALL be the 3rd tab (center position).
3. THE Videos_Feed route SHALL be a file at `mobile/app/(tabs)/videos.tsx`, consistent with the Expo Router file-based routing convention used by all other tabs.
4. THE Tab_Bar icon for the Videos tab SHALL follow the same `renderTabIcon` helper and stroke/fill pattern used by other icons in the Tab_Bar layout.
5. THE Stack navigator in `mobile/app/_layout.tsx` SHALL NOT require changes for the Videos tab — tab screens are automatically registered by the existing `(tabs)` group.

---

### Requirement 9: Empty State

**User Story:** As a Rumia user who opens the Videos Feed when no published videos exist, I want to see a polished placeholder that explains the situation, so that the app does not appear broken.

#### Acceptance Criteria

1. WHEN the Videos_Feed fetches listings with `has_video=true` and the result set is empty (`items.length === 0`), THE Videos_Feed SHALL display the `EmptyState` component from `mobile/lib/components/ui.tsx` with a video-themed icon, a title such as "No videos yet", and a subtitle explaining that property videos will appear here when agents publish them.
2. THE empty state SHALL include an action button "Explore listings" that navigates to `router.push('/explore')` so users are not left stranded.
3. THE empty state SHALL NOT display any fake, placeholder, or demo Video_Items.
4. WHILE data is loading on initial fetch, THE Videos_Feed SHALL display a full-screen `Skeleton` component from `mobile/lib/components/ui.tsx` with Rumia branding, rather than a blank screen.

---

### Requirement 10: Error Handling and Resilience

**User Story:** As a Rumia user, I want a single broken video or network hiccup to not ruin my entire browsing session, so that I can continue discovering other properties even when one video fails.

#### Acceptance Criteria

1. IF a single YouTube_Player WebView fails to load (invalid youtube_id, deleted video, network error), THEN THE Videos_Feed SHALL display a Rumia-branded fallback thumbnail for that Video_Item only, while all other Video_Items continue to function.
2. THE fallback thumbnail for a failed YouTube_Player SHALL use the first image URL from `listing.images[0]?.r2_url` if available, or a Rumia-branded placeholder image.
3. IF the entire `/listings` API request fails, THEN THE Videos_Feed SHALL display a full-screen Rumia error state with a "Try again" button that retries the query, using `useQuery`'s `refetch` function.
4. THE Videos_Feed SHALL wrap the FlatList content in a React Error Boundary so that a JavaScript render error in one Video_Item does not unmount the entire feed.
5. IF `listing.youtube_id` is present but does not produce a valid YouTube embed URL (e.g. it is an empty string or a non-YouTube URL), THEN THE Videos_Feed SHALL treat that Video_Item as having a failed player and show the fallback thumbnail.
6. THE Videos_Feed SHALL handle missing `listing.agent` gracefully — if `listing.agent` is null, the Contact button SHALL still appear but the `ContactModal` SHALL display its existing "No contact number" alert flow without crashing.

---

### Requirement 11: Authentication-Dependent Actions

**User Story:** As a Rumia user browsing without an account, I want to watch videos and view properties freely, but be guided to sign in only when I take an action that requires authentication, so that browsing remains friction-free.

#### Acceptance Criteria

1. THE Videos_Feed SHALL be publicly accessible without authentication — any user may open the screen and scroll through videos.
2. WHEN an unauthenticated user taps "Save", THE Videos_Feed SHALL navigate to `router.push('/(auth)/login')` instead of calling the wishlist API, matching the auth-gate pattern in `mobile/app/listing/[slug].tsx`.
3. WHEN an unauthenticated user taps "Contact", THE Videos_Feed SHALL open the `ContactModal` — the modal itself does not require authentication and handles its own WhatsApp flow.
4. WHEN an unauthenticated user taps "View Listing", THE Videos_Feed SHALL navigate to the listing detail screen — no authentication is required to view a listing.
5. THE Videos_Feed SHALL read authentication state from `useSessionStore((s) => s.isAuthenticated)` from `mobile/stores/session.ts`, consistent with the pattern used across all other screens.

---

### Requirement 12: Mobile-First Performance

**User Story:** As a Rumia user on an older Android phone with a slow connection, I want the Videos Feed to scroll smoothly and not drain my battery or crash the app, so that it is usable on the devices most Rumia users actually have.

#### Acceptance Criteria

1. AT ANY GIVEN TIME, THE Videos_Feed SHALL have at most 3 YouTube_Players (WebViews) mounted in the component tree simultaneously, enforced by the windowing strategy in Requirement 2, Criterion 3.
2. THE Videos_Feed SHALL use `keyExtractor` returning stable keys (`listing.id`) on the FlatList to avoid unnecessary re-mounts on re-renders.
3. WHEN a Video_Item is first brought into the windowed range (within 1 position of Active_Item), THE Videos_Feed SHALL begin loading the YouTube_Player in background with autoplay disabled (`autoplay=0`) so it is ready when the user snaps to it, reducing perceived load time.
4. THE Videos_Feed SHALL NOT use `react-native-reanimated` shared values inside the FlatList's `renderItem` unless they are created outside the render function, to avoid worklet churn on every scroll frame.
5. THE Videos_Feed SHALL set `initialNumToRender={1}` and `windowSize={3}` on the FlatList to minimize initial render cost.
6. THE Videos_Feed SHALL use `getItemLayout` on the FlatList (returning fixed height equal to `windowHeight`) so the FlatList does not measure items dynamically, avoiding layout shifts.

---

### Requirement 13: Desktop / Tablet Experience

**User Story:** As a Rumia user accessing the app on a tablet or through the Expo web preview, I want the Videos Feed to remain usable and well-proportioned, so that the experience is not broken on larger screens.

#### Acceptance Criteria

1. WHEN rendered on a screen wider than 600dp, THE Videos_Feed SHALL constrain the video player and Property_Overlay to a centered column of `maxWidth: 430` pixels, matching the web frame constraint already applied by `AppFrame` in `mobile/app/_layout.tsx`.
2. THE Property_Overlay Conversion_Actions SHALL remain accessible and tappable on all screen sizes.
3. THE Videos_Feed SHALL use `useWindowDimensions()` for all height/width calculations rather than hardcoded pixel values, so it responds correctly to device rotation and resizing.

---

### Requirement 14: SEO and Metadata

**User Story:** As a Rumia product owner, I want the Videos Feed screen to have appropriate metadata for analytics and search indexing, so that the feature is trackable and discoverable.

#### Acceptance Criteria

1. THE Videos_Feed screen SHALL set a page title of "Property Videos · Rumia" using Expo Router's `<Stack.Screen options={{ title: '...' }} />` pattern, consistent with how other screens set headers.
2. THE Videos_Feed SHALL fire an analytics event to the existing PostHog instance (via `mobile/lib/posthog.tsx`) when the screen is focused, with event name `"videos_feed_viewed"`.
3. WHEN the user snaps to a new Active_Item, THE Videos_Feed SHALL fire a PostHog event `"video_item_viewed"` with properties `{ listing_id, property_type, youtube_id }`, so video engagement can be tracked per listing.

---

### Requirement 15: Backend Filter Support

**User Story:** As a Rumia developer, I want the existing `/listings` endpoint to support filtering by video availability so the Videos Feed can fetch only video-enabled listings efficiently without a separate endpoint.

#### Acceptance Criteria

1. THE backend `/listings` router SHALL accept an optional query parameter `has_video` of type boolean.
2. WHEN `has_video=true` is passed, THE ListingService SHALL add a filter `Listing.youtube_id IS NOT NULL` to the query, so only listings with a YouTube video are returned.
3. WHEN `has_video` is not passed or is `false`, THE `/listings` endpoint SHALL behave exactly as before, with no change to existing callers.
4. THE new `has_video` filter SHALL be implemented in `backend/app/features/listings/router.py` and `backend/app/features/listings/service.py` using the same pattern as the existing `property_type` filter.
5. THE new filter SHALL be added to the OpenAPI schema automatically by FastAPI, requiring no manual schema changes.
