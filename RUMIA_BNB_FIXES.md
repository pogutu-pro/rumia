# RumiaBnB Fixes (#1–#8)

This document describes the RumiaBnB fixes implemented on branch `feat/rumia-bnb-fixes`. It records current behavior and known limits; it does not describe additional product features as implemented.

## Fix #1 — Draft and Publish State

**Problem:** BnB creation accepted an `is_active` value, but the shared listing creation service previously forced every new listing active. A draft could therefore become publicly visible.

**Implementation:** BnB creation forwards `data.is_active` into `ListingCreate`, and `ListingService.create_listing()` stores the supplied value. The shared schema’s default remains active for callers that omit the field.

**Expected behavior:** A BnB submitted with `is_active=false` stays inactive and is excluded from the active public feed. A published BnB submitted with `is_active=true` remains eligible for that feed, subject to its existing filters.

**Verification:** Focused creation tests cover draft, publish, and the regular listing default in `backend/tests/features/bnb/test_bnb_creation.py`.

## Fix #2 — BnB Edit Persistence

**Problem:** BnB-specific fields are nested under `bnb` in the request, while the previous update flow did not reliably map that nested payload into `bnb_details`.

**Implementation:** `BnbListingUpdate` models nested `bnb` data as `BnbDetailsUpdate`; `BnbService.update_bnb_listing()` sends supplied top-level listing fields through `ListingUpdate` and upserts nested BnB fields into `BnbDetails`. Nested partial updates use only explicitly supplied fields, preserving omitted values. Explicit `null` clears nullable BnB fields; the schema rejects `null` for required non-null fields. Top-level listing fields and submitted images continue through the listing update path.

**Verification:** `backend/tests/features/bnb/test_bnb_update.py` covers nested persistence, partial updates, clearing nullable fields, rejecting nulls for required fields, and preserving top-level listing updates.

## Fix #3 — Editing Paused BnBs

**Problem:** The public BnB detail endpoint intentionally hides inactive listings, so it could not initialize an owner’s edit form for a paused BnB.

**Implementation:** The authenticated `GET /api/v1/bnb/my/{listing_id}` edit-read path loads active or inactive short-stay listings. It requires an agent or admin role. Agents must resolve to the listing’s agent record; admins bypass that agent lookup. The public `GET /api/v1/bnb/{listing_id}` continues to return not found for inactive listings.

**Verification:** `backend/tests/features/bnb/test_bnb_edit_read.py` covers owner access to active and inactive BnBs, denial for another agent, admin access, public hiding, and authentication requirements. The dashboard edit page uses the authenticated edit-read API helper.

## Fix #4 — Dashboard View Route

**Problem:** The BnB dashboard View action previously linked to the generic `/listing/{id}` route.

**Implementation:** The View action now links to `/bnb/{id}`, matching the public BnB detail route. Generic listing routes are unchanged.

**Verification:** The dashboard component is `web/src/app/(dashboard)/dashboard/bnb/bnb-listings-client.tsx`; its View link uses the existing BnB listing ID.

## Fix #5 — BnB Cache Invalidation

**Problem:** BnB mutations could leave the public feed and detail page cached until their normal revalidation interval elapsed.

**Implementation:** After successful create, update, pause/publish, and delete actions, `web/src/app/actions/bnb.ts` revalidates `/bnb` and the affected `/bnb/{id}` detail path. The shared helper also revalidates `/`, `/dashboard/bnb`, and `/hostels`. Update additionally revalidates the legacy `/listing/{id}` path when the response has a slug. Failed mutations return before public BnB paths are invalidated. The public BnB feed and detail pages retain their five-minute (`revalidate = 300`) setting.

**Verification:** `web/src/app/actions/__tests__/bnb.test.ts` covers the four successful mutation paths and ensures failed mutations do not invalidate public BnB pages.

## Fix #6 — BnB Response Data

**Problem:** The frontend expected `verified` and `agent.slug`, but the BnB response mapper omitted those existing model values.

**Implementation:** The BnB response mapper copies `verified` from the listing’s existing `Listing.verified` field and includes `slug` in the existing `agent` object from the related `Agent.slug` field. No new source of truth or verification process is added. The frontend can use `agent.slug` for agent profile links and `verified` for the existing status display.

**Verification:** `backend/tests/features/bnb/test_bnb_response_mapping.py` checks those mapped values and existing response fields.

## Fix #7 — Image Lifecycle and Cleanup

**Problem:** BnB images could have R2 objects and `image_uploads` metadata without a reliable listing-to-upload association, so permanent deletion could leave orphaned storage objects.

**Implementation:** The BnB form retains the upload ID and sends it with image data. The BnB service maps it to `ListingImage.image_upload_id`, and the listing service persists that association. On permanent deletion of a `short_stay` listing, the shared `ImageService.cleanup_listing_uploads()` loads the upload IDs referenced by that listing, locks each upload row, and checks whether another listing references it. Shared uploads are retained. Otherwise, it deletes the recorded thumbnail/card/gallery/large variants plus the pipeline’s original and blur objects, then removes the upload metadata. Existing listing/image database cascades remain in place. Re-deleting absent R2 keys is treated as successful by the storage abstraction.

**Known limits:** Existing listing images without `image_upload_id` cannot be safely associated with their R2 objects and are not automatically cleaned up. Replacement-time R2 cleanup was not added; this cleanup runs when a BnB is permanently deleted.

**Verification:** The recorded image lifecycle test run reported `23 passed`. `git diff --check` also passed for that work. Tests use mocked R2 behavior rather than deleting production objects.

## Fix #8 — Inactive Listing Visibility

**Problem:** The generic `GET /api/v1/listings/{id_or_slug}` detail endpoint returned inactive listings even though public BnB detail hid inactive listings.

**Implementation:** Active listings remain publicly accessible. For inactive listings, anonymous callers and authenticated non-owners receive the existing not-found response. An authenticated listing owner or admin can still read the inactive listing; ownership uses the listing agent’s user ID, with the existing agent-ID fallback. The dedicated BnB public endpoint behavior is unchanged.

Three dashboard listing toggle actions previously used a cookie-free public read to get the current state. They now use an authenticated server read so an owner can continue managing a paused listing. The public web and mobile detail callers remain on the public read helper.

**Verification:** The recorded focused visibility tests reported `5 passed`; the related BnB owner/admin and public visibility subset reported `5 passed, 1 deselected`. ESLint passed for the two changed frontend listing API/action files.

## Verification

The following results were recorded during implementation; this documentation task did not rerun tests or access production systems:

- BnB image lifecycle test run: `23 passed`.
- Fix #8 focused listing visibility tests: `5 passed`.
- Related BnB owner/admin and public visibility tests: `5 passed, 1 deselected`.
- ESLint on the changed frontend listing API and action files: passed.
- `git diff --check` for the image lifecycle work: passed.
- Frontend `npm run typecheck` did **not** pass. TypeScript reported parser errors in generated `.next/dev/types/routes.d.ts` and `.next/dev/types/validator.ts`; this is not evidence that the whole repository passes typecheck.

## Known Limitations

- Legacy listing images without `image_upload_id` cannot be safely linked to their upload metadata or R2 variants, so deletion cleanup skips them.
- Replacing BnB images does not trigger R2 object cleanup; cleanup is implemented for permanent BnB deletion only.
- The frontend typecheck is blocked by parser errors in generated `.next/dev/types` files, as noted above.

## Future RumiaBnB Work

These fixes address the implementation and visibility issues listed above. Real booking availability and management, payment integration, notifications, reviews, and scalable search are separate product work and are not implemented by these fixes.
