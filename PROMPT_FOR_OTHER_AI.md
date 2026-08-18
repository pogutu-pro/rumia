# Prompt for Other AI: Fix Fully Occupied Hostel Contact Flow

## Current State
- File: `src/app/(public)/listing/[id]/contact-modal.tsx`
- The hostel "OLD TAMAAL" currently has `is_full: false` and `is_active: false` in DB
- When user clicks "Contact" on a fully occupied hostel, they should see a modal saying the hostel is fully occupied with **Cancel** / **Continue with Agent** buttons
- Current code has the logic but user reports "it didn't work"

## Required Behavior
When Contact is pressed on a fully occupied hostel:
1. Modal opens showing: "This hostel is currently **fully occupied** — rooms are all taken. The owner can't take new bookings right now. If you'd like recommendations for other available hostels, the Rumia agent can help — a consultation fee of **KES {fee}** is charged for this service."
2. Two buttons: **Cancel** (closes modal) and **Continue with Agent** (proceeds to agent flow)
3. No "Hostel Owner" option shown when fully occupied
4. Server 409 `requiresAgent` should also trigger this notice (stale cache fix)

## Files to Check/Modify
- `src/app/(public)/listing/[id]/contact-modal.tsx` - main modal logic
- `src/app/(public)/hostels/[county]/[area]/[slug]/page.tsx` - ensures `isFull={listing.is_full ?? false}` passed to ContactButton
- `src/app/actions/listings.ts` - `toggleListingFullAction` revalidates public paths

## Key Implementation Details
- Add `full` step to `Step` type: `'choose' | 'full' | 'phone' | 'fee' | 'redirecting'`
- Add `fullLocked` state to track server-side 409 requiresAgent
- Use `isFullEffective = isFull || fullLocked` for consistent behavior
- In `ModalContent`, when `isFull` is true, render full notice + Cancel/Continue with Agent (NOT the two-option grid)
- When `step === 'full'`, render same notice (for 409/edge cases)
- In `continueToWhatsApp`, when `isFullEffective && type === 'hostel_owner'`, set `step('full')` instead of silent redirect
- In 409 `requiresAgent` handler: `setFullLocked(true); setStep('full');`

## Test
1. Set `is_full=true` for a test listing in DB
2. Visit public slug page
3. Click "Contact" → should see fully occupied notice with Cancel/Continue buttons
3. Click "Continue with Agent" → proceeds to agent flow (fee step if non-commission, WhatsApp if commission)
4. Click "Cancel" → closes modal

## Current Code Location
The choose-step `isFull` early-return and `step === 'full'` branch both exist in `contact-modal.tsx` but may need the consultation fee text fixed and cleanup of duplicate code.

## Debug Tips
- Check browser console for errors
- Verify `isFull` prop is passed correctly from slug page: `isFull={listing.is_full ?? false}`
- Ensure `revalidatePath` is called in `toggleListingFullAction` for the slug path