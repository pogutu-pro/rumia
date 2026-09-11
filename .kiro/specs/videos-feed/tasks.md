# Implementation Plan: Videos Feed

## Overview

Implement the Videos Feed feature — a full-screen, vertically snapping short-form property discovery screen modelled on TikTok/Instagram Reels. The plan covers:
1. A minimal backend change to the existing `/listings` endpoint (add `has_video` filter).
2. A new `mobile/features/videos/` directory with all component files.
3. A new Expo Router tab screen at `mobile/app/(tabs)/videos.tsx`.
4. Integration of the Videos tab into the existing `_layout.tsx` tab bar.
5. Property-based and unit/integration tests for pure functions and component behaviour.

Implementation follows existing patterns in `mobile/app/listing/[slug].tsx`, `mobile/app/(tabs)/saved.tsx`, and `mobile/app/(tabs)/_layout.tsx` verbatim — no new patterns are introduced.

## Tasks

- [x] 1. Backend: Add `has_video` filter to `/listings` endpoint
  - [x] 1.1 Modify `backend/app/features/listings/router.py` to accept `has_video` query param
    - Add `has_video: Optional[bool] = Query(None, description="Filter to listings with a YouTube video (youtube_id IS NOT NULL)")` to `get_listings()` function signature, following the same pattern as `property_type`
    - Pass `has_video=has_video` to `ListingService.get_listings_feed()`
    - _Requirements: 15.1, 15.4, 15.5_

  - [x] 1.2 Modify `backend/app/features/listings/service.py` to apply `has_video` filter in `get_listings_feed()`
    - Add `has_video: Optional[bool] = None` parameter to `get_listings_feed()`
    - After existing `property_type` filter block, add: `if has_video is True: stmt = stmt.where(Listing.youtube_id.is_not(None))` and `elif has_video is False: stmt = stmt.where(Listing.youtube_id.is_(None))`
    - When `has_video` is not passed or is `None`, no filter is applied — existing callers are unaffected
    - _Requirements: 15.2, 15.3, 15.4_

  - [ ]* 1.3 Write property-based test for `has_video` filter in `backend/tests/features/listings/test_listings.py`
    - **Property 12: Backend `has_video` filter — only listings with youtube_id returned**
    - Use `hypothesis` with `@given(st.lists(listing_strategy()))` to generate listings with mixed `youtube_id` values
    - Assert that `get_listings_feed(session, has_video=True)` returns only rows where `youtube_id IS NOT NULL`
    - Assert that `get_listings_feed(session, has_video=False)` returns only rows where `youtube_id IS NULL`
    - Assert that calling without `has_video` returns all rows regardless of `youtube_id`
    - **Validates: Requirements 15.2, 15.3, 1.1**

- [ ] 2. Checkpoint — verify backend changes pass existing tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Mobile: Install `react-native-webview` dependency
  - Run `npx expo install react-native-webview` inside `mobile/` to add the package and update `package.json`, `yarn.lock`/`package-lock.json`, and `app.json` plugin registration
  - Verify the package appears in `mobile/package.json` dependencies
  - _Requirements: 4.1, 4.6_

- [ ] 4. Mobile: Create `mobile/features/videos/` directory with stub files
  - Create empty (or minimal-stub) files so later tasks can import from each other without resolver errors:
    - `mobile/features/videos/youtube-player.tsx`
    - `mobile/features/videos/property-overlay.tsx`
    - `mobile/features/videos/conversion-actions.tsx`
    - `mobile/features/videos/video-item.tsx`
    - `mobile/features/videos/videos-empty-state.tsx`
    - `mobile/features/videos/__tests__/youtube-player.test.ts`
    - `mobile/features/videos/__tests__/property-overlay.test.ts`
    - `mobile/features/videos/__tests__/conversion-actions.test.ts`
    - `mobile/features/videos/__tests__/videos-feed.test.ts`
  - _Requirements: 3.1 (file structure prerequisite)_

- [ ] 5. Mobile: Implement `buildYouTubeEmbedUrl` and `YouTubePlayer` in `mobile/features/videos/youtube-player.tsx`
  - [ ] 5.1 Implement `buildYouTubeEmbedUrl(youtubeId, { isActive, isMuted })` pure function
    - Returns `https://www.youtube.com/embed/{youtubeId}?autoplay=...&mute=...&controls=1&rel=0&modestbranding=1&playsinline=1`
    - `autoplay=1` when `isActive=true`, else `autoplay=0`
    - `mute=1` when `isMuted=true` OR `isActive=false`; `mute=0` only when `isMuted=false AND isActive=true`
    - Export the function so it can be imported by tests and `VideoItem`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ] 5.2 Implement `YouTubePlayer` component using `react-native-webview`
    - Props: `{ youtubeId: string; isActive: boolean; isMuted: boolean }`
    - Uses `buildYouTubeEmbedUrl` to construct the `source.uri`
    - Sets `allowsInlineMediaPlayback={true}`, `mediaPlaybackRequiresUserAction={false}`, `scrollEnabled={false}`, `bounces={false}`, `allowsFullscreenVideo={false}`
    - Maintains local `hasError` state; on `onError` or `onHttpError`, sets `hasError=true` and renders `ThumbnailFallbackView` instead of the WebView
    - `ThumbnailFallbackView` shows a "Video unavailable" label with Rumia branding; `PropertyOverlay` and `ConversionActions` remain mounted
    - _Requirements: 4.1, 4.6, 4.8, 10.1, 10.2, 10.5_

  - [ ]* 5.3 Write property-based tests for `buildYouTubeEmbedUrl` in `mobile/features/videos/__tests__/youtube-player.test.ts`
    - **Property 5: YouTube embed URL contains the correct video ID**
    - Use `fast-check` (`fc.property`) with an arbitrary non-empty `youtubeId` string, arbitrary `isActive` boolean, arbitrary `isMuted` boolean
    - Assert `url.includes('/embed/${youtubeId}')`
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 5.4 Write property-based tests for autoplay/mute parameter correctness in `mobile/features/videos/__tests__/youtube-player.test.ts`
    - **Property 6: Embed URL autoplay and mute parameters are correct**
    - Use `fast-check` with arbitrary `youtubeId`, `isActive`, and `isMuted` booleans
    - Parse the URL's `searchParams` and assert `autoplay` and `mute` values match the rules in Property 6 of the design
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [ ] 6. Mobile: Implement `PropertyOverlay` in `mobile/features/videos/property-overlay.tsx`
  - [ ] 6.1 Implement pure helper functions `getPriceLabel` and `getPropertyTypeBadge`
    - `getPriceLabel(propertyType, price)` — returns `"KES X/night"` for `short_stay`, `"KES X/mo"` otherwise
    - `getPropertyTypeBadge(propertyType)` — returns `{ label, color }` using `palette.emerald[600]`, `palette.sky[600]`, `palette.amber[500]` for the three property types
    - Export both functions for testing
    - _Requirements: 5.3, 5.4, 7.1, 7.2, 7.3_

  - [ ] 6.2 Implement `PropertyOverlay` component
    - Props: `{ listing: Listing; isMuted: boolean; onToggleMute: () => void }`
    - Positioned `absolute`, `bottom: 0`, `left: 0`, `right: 0`; uses `LinearGradient` from `expo-linear-gradient` (or equivalent already in the project) from `rgba(0,0,0,0.7)` at bottom to `transparent` at 50% height
    - Displays: property type badge (pill with `getPropertyTypeBadge` color), listing title, price (`getPriceLabel`), location; area shown only if `listing.area != null`; distance to campus shown only if `listing.distance_to_campus != null`
    - Shows "Fully Occupied" pill when `listing.is_full === true`
    - Includes a mute/unmute toggle icon button; state driven by `isMuted` prop and `onToggleMute` callback
    - Uses safe-area bottom inset (`useSafeAreaInsets`) so controls are not obscured by home indicator
    - Uses Rumia design tokens: white text, `palette.emerald[600]` for price, `palette.slate[300]` for secondary text, `radii['2xl']` for pill shapes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 4.9, 7.1, 7.2, 7.3, 7.4, 7.5, 3.6_

  - [ ]* 6.3 Write property-based tests for `getPriceLabel` in `mobile/features/videos/__tests__/property-overlay.test.ts`
    - **Property 7: Price label matches property type**
    - Use `fast-check` with `fc.constantFrom('hostel', 'apartment', 'short_stay')` and `fc.nat()` for price
    - Assert label ends with `/night` for `short_stay` and `/mo` for all others
    - **Validates: Requirements 5.3, 7.1, 7.2, 7.3**

  - [ ]* 6.4 Write property-based tests for `getPropertyTypeBadge` in `mobile/features/videos/__tests__/property-overlay.test.ts`
    - **Property 8: Property type badge label and color are consistent**
    - Use `fc.constantFrom('hostel', 'apartment', 'short_stay')` and assert each type maps to the correct `label` and `color` token
    - **Validates: Requirements 5.4, 7.1, 7.2, 7.3**

- [ ] 7. Mobile: Implement `ConversionActions` in `mobile/features/videos/conversion-actions.tsx`
  - [ ] 7.1 Implement `getSaveMethod` pure helper and `ConversionActions` component
    - `getSaveMethod(isSaved: boolean): 'POST' | 'DELETE'` — returns `'DELETE'` when saved, `'POST'` when not
    - Export `getSaveMethod` for testing
    - Props: `{ listing: Listing; onContact: () => void }`
    - Renders a vertical column of four icon buttons on the right edge of the item: View Listing (`ExternalLink` or `Eye` icon), Contact (`MessageCircle`), Save (`Heart`), Share (`Share2`)
    - _Requirements: 6.1, 6.7_

  - [ ] 7.2 Implement View Listing navigation
    - On tap, calls `router.push('/listing/${listing.slug || listing.id}')` using `useRouter()`
    - No authentication required
    - _Requirements: 6.2, 11.4_

  - [ ] 7.3 Implement Contact button
    - On tap, calls `onContact()` which hoists `ContactModal` opening to the screen root
    - Renders even when `listing.agent` is null; `ContactModal` handles the "No contact number" alert internally
    - _Requirements: 6.3, 10.6, 11.3_

  - [ ] 7.4 Implement Save button with auth gate and mutation
    - Reads `isAuthenticated` from `useSessionStore((s) => s.isAuthenticated)` (`mobile/stores/session.ts`)
    - When unauthenticated: `router.push('/(auth)/login')` without calling the API
    - When authenticated: calls `apiFetch('/profiles/me/wishlist/${listing.id}', { method: getSaveMethod(listing.is_saved) })` via `useMutation`
    - On mutation success: invalidates `['videos-feed']` and `['wishlist']` query keys with `queryClient.invalidateQueries`
    - Heart icon uses filled style + `palette.rose[500]` when `listing.is_saved`, outlined style otherwise
    - _Requirements: 6.4, 6.5, 6.7, 6.8, 11.2, 11.5_

  - [ ] 7.5 Implement Share button
    - On tap, calls `Share.share({ message: '${listing.title} — KES ${listing.price.toLocaleString()}${priceUnit} · ${listing.location}' })` using React Native's built-in Share API
    - `priceUnit` is `/night` for `short_stay`, `/mo` otherwise
    - _Requirements: 6.6_

  - [ ]* 7.6 Write property-based test for `getSaveMethod` in `mobile/features/videos/__tests__/conversion-actions.test.ts`
    - **Property 10: Save toggle uses correct HTTP method**
    - Use `fc.boolean()` for `isSaved` and assert the returned method matches Property 10 of the design
    - **Validates: Requirements 6.4, 6.7**

  - [ ]* 7.7 Write unit tests for auth-gate behaviour in `mobile/features/videos/__tests__/conversion-actions.test.ts`
    - **Property 11: Auth gate — unauthenticated save navigates to login**
    - Mock `useSessionStore` to return `isAuthenticated=false`
    - Assert `router.push('/(auth)/login')` is called and `apiFetch` is NOT called when Save is tapped unauthenticated
    - **Validates: Requirements 6.5, 11.2**

- [ ] 8. Mobile: Implement `VideoItem` with windowing logic in `mobile/features/videos/video-item.tsx`
  - [ ] 8.1 Implement `getWindowedIndices` pure helper and `VideoItem` component
    - `getWindowedIndices(activeIndex, listLength)` — returns the set of indices satisfying `|index - activeIndex| <= 1`, bounded by `[0, listLength - 1]`; always at most 3 elements
    - Export `getWindowedIndices` for testing
    - `VideoItem` wrapped in `React.memo` with props: `{ listing, index, activeIndex, isMuted, onToggleMute, onContact }`
    - `isInWindow = Math.abs(index - activeIndex) <= 1`
    - When `isInWindow=true`: renders `<YouTubePlayer youtubeId={listing.youtube_id!} isActive={index === activeIndex} isMuted={isMuted} />`
    - When `isInWindow=false`: renders static `<Image source={{ uri: listing.images[0]?.r2_url }}` thumbnail or Rumia placeholder
    - Outer `<View style={{ height: windowHeight, width: '100%' }}>` using `useWindowDimensions().height`
    - Renders `<PropertyOverlay>` and `<ConversionActions>` regardless of windowing state
    - _Requirements: 2.3, 2.4, 2.5, 3.2, 12.1, 12.3_

  - [ ]* 8.2 Write property-based test for windowing in `mobile/features/videos/__tests__/videos-feed.test.ts`
    - **Property 2: Windowing — at most 3 players mounted at any time**
    - Use `fc.nat()` for `activeIndex` and `fc.nat()` for `listLength`
    - Call `getWindowedIndices(activeIndex, listLength)` and assert `result.length <= 3`
    - **Validates: Requirements 2.3, 2.4, 12.1**

  - [ ]* 8.3 Write property-based test for viewport height in `mobile/features/videos/__tests__/videos-feed.test.ts`
    - **Property 4: Viewport height — each item fills the screen**
    - Use `fc.integer({ min: 400, max: 1600 })` for `windowHeight`
    - Call `getVideoItemStyle(windowHeight)` (or equivalent) and assert `style.height === windowHeight`
    - **Validates: Requirements 3.2, 13.3**

- [ ] 9. Mobile: Implement `VideosFeedScreen` in `mobile/app/(tabs)/videos.tsx`
  - [ ] 9.1 Set up screen structure, `useInfiniteQuery`, and data flattening
    - Import and configure `useInfiniteQuery` with `queryKey: ['videos-feed']`
    - `queryFn` calls `apiFetch('/listings', { params: { has_video: true, limit: 10, page: pageParam } })`
    - `getNextPageParam`: returns `lastPage.page + 1` if `lastPage.page < lastPage.pages`, else `undefined`
    - `initialPageParam: 1`
    - Flatten pages with `useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])`
    - Manage `activeIndex`, `isMuted`, and `contactListing` state at screen root
    - _Requirements: 1.1, 1.3, 1.4, 2.1_

  - [ ] 9.2 Implement `FlatList` with paging and performance configuration
    - `pagingEnabled`, `decelerationRate="fast"`, `showsVerticalScrollIndicator={false}`, `removeClippedSubviews`
    - `initialNumToRender={1}`, `windowSize={3}`
    - `getItemLayout={(_data, index) => ({ length: windowHeight, offset: windowHeight * index, index })}`
    - `keyExtractor={(item) => item.id}`
    - `renderItem` passes all props to `<VideoItem>`; callbacks (`onToggleMute`, `onContact`) created with `useCallback`
    - `onViewableItemsChanged` (via `useRef`) updates `activeIndex`, triggers `fetchNextPage()` when `idx >= listings.length - 2 && hasNextPage`, and fires PostHog `video_item_viewed` event
    - `viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}`
    - _Requirements: 2.2, 3.1, 3.3, 3.4, 3.5, 3.7, 12.2, 12.4, 12.5, 12.6_

  - [ ] 9.3 Implement loading, empty, error, and end-of-feed states
    - While `isLoading=true` and no data: render full-screen `<Skeleton>` from `mobile/lib/components/ui.tsx`
    - When `isError=true` and `listings.length === 0`: render full-screen error state with "Try again" button wired to `refetch()`
    - `ListEmptyComponent`: `<VideosEmptyState>` (from `mobile/features/videos/videos-empty-state.tsx`) with "No videos yet" title, subtitle, and "Explore listings" button navigating to `/explore`
    - `ListFooterComponent`: end-of-feed indicator when `!hasNextPage && listings.length > 0`
    - Wrap `FlatList` in a class `ErrorBoundary` (use `react-error-boundary` or a class component) so a single item render error doesn't unmount the feed
    - _Requirements: 1.5, 1.6, 2.6, 9.1, 9.2, 9.3, 9.4, 10.3, 10.4_

  - [ ] 9.4 Add `Stack.Screen` metadata, PostHog screen event, and `ContactModal`
    - `<Stack.Screen options={{ title: 'Property Videos · Rumia', headerShown: false }} />`
    - On screen focus (use `useFocusEffect` from `@react-navigation/native`), fire `posthog.capture('videos_feed_viewed')`
    - Hoist `<ContactModal listing={contactListing} onClose={() => setContactListing(null)} />` to screen root so it can be opened from any `VideoItem`
    - _Requirements: 6.3, 14.1, 14.2, 14.3_

  - [ ]* 9.5 Write property-based test for pagination trigger in `mobile/features/videos/__tests__/videos-feed.test.ts`
    - **Property 3: Pagination trigger — next page fetched when near end**
    - Extract `shouldTriggerFetchNextPage(activeIndex, listLength, hasNextPage)` pure function from the scroll handler
    - Use `fc.nat({ max: 100 })` and `fc.boolean()` to assert that it returns `true` only when `activeIndex >= listLength - 2 && hasNextPage === true`
    - **Validates: Requirements 2.2**

  - [ ]* 9.6 Write property-based test for video filter in `mobile/features/videos/__tests__/videos-feed.test.ts`
    - **Property 1: Video filter — only valid video listings displayed**
    - Export `filterVideoListings(listings)` helper (if used for client-side guard) or validate that the API params sent always include `has_video: true`
    - Use `fc.array(arbitraryListing())` and assert filtered results have `youtube_id != null && is_active === true`
    - **Validates: Requirements 1.2**

- [ ] 10. Mobile: Add Videos tab to `mobile/app/(tabs)/_layout.tsx`
  - Add `Play` to the `lucide-react-native` import in `_layout.tsx`
  - Insert a Videos entry into the `TABS` array at index 2 (center position): `{ name: 'videos', label: 'Videos', icon: Play }`
  - No other changes to the `renderTabIcon` helper, the `Tabs.Screen` mapping loop, or `mobile/app/_layout.tsx` are required — the new route is auto-registered by the `(tabs)` group
  - Verify the tab bar still shows all five tabs and the Videos tab icon follows the same focused/unfocused stroke pattern as other tabs
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Mobile: Implement `VideosEmptyState` in `mobile/features/videos/videos-empty-state.tsx`
  - Renders the `EmptyState` component from `mobile/lib/components/ui.tsx`
  - Passes a video-themed icon, title `"No videos yet"`, and subtitle explaining that property videos will appear when agents publish them
  - Includes an "Explore listings" action button that calls `router.push('/explore')`
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 12. Mobile: Write unit and integration tests for component behaviour
  - [ ]* 12.1 Write unit tests for `YouTubePlayer` error fallback in `mobile/features/videos/__tests__/youtube-player.test.ts`
    - Test that `YouTubePlayer` renders `ThumbnailFallback` after `onError` fires on the WebView
    - Test that `PropertyOverlay` remains mounted when the fallback is shown
    - _Requirements: 4.8, 10.1_

  - [ ]* 12.2 Write unit tests for `PropertyOverlay` in `mobile/features/videos/__tests__/property-overlay.test.ts`
    - Test that `area` is omitted from render when `listing.area === null`
    - Test that `distance_to_campus` is omitted when null
    - Test that "Fully Occupied" pill is visible when `listing.is_full === true` and absent otherwise
    - Test mute toggle button calls `onToggleMute` on press
    - _Requirements: 7.4, 7.5, 4.9_

  - [ ]* 12.3 Write unit tests for `ConversionActions` in `mobile/features/videos/__tests__/conversion-actions.test.ts`
    - Test that tapping "View Listing" calls `router.push('/listing/${slug}')`
    - Test that tapping "Contact" calls `onContact()`
    - Test that tapping "Share" calls `Share.share` with correct message format
    - Test that save heart is filled (`palette.rose[500]`) when `listing.is_saved=true` and outlined when `false`
    - _Requirements: 6.2, 6.3, 6.6, 6.7_

  - [ ]* 12.4 Write integration tests for `VideosFeedScreen` in `mobile/features/videos/__tests__/videos-feed.test.ts`
    - Test loading state: `Skeleton` is shown while `isLoading=true`
    - Test empty state: `EmptyState` component with correct title rendered when `items.length === 0`
    - Test error state: error component with "Try again" button rendered on API failure
    - Test end-of-feed indicator appears when `hasNextPage=false` and `listings.length > 0`
    - _Requirements: 1.5, 1.6, 2.6, 9.1, 9.4_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all backend tests pass with `pytest backend/tests/features/listings/`
  - Ensure all mobile tests pass with `jest mobile/features/videos/`
  - Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; all core implementation tasks are unmarked.
- Property-based tests use `fast-check` on the mobile side and `hypothesis` on the backend — both are already common choices for their respective stacks.
- `react-native-webview` (Task 3) must be installed before any component referencing it can be compiled.
- All file paths are relative to the workspace root; `mobile/` and `backend/` prefixes are included for clarity.
- Each task references specific requirements for traceability.
- The `(tabs)` group in Expo Router auto-registers `videos.tsx` — no changes to `mobile/app/_layout.tsx` (the root Stack) are needed.
- `expo-linear-gradient` is assumed to already be in the project (common Expo dependency); if not, install it alongside `react-native-webview` in Task 3.
