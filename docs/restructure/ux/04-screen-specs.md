# UX 04 · Detailed Experience Specification

Covers deliverable 7. For each important screen: user goal, primary and secondary actions, hierarchy, interaction, responsive behaviour, empty/loading/error states and accessibility.

Breakpoints used: **S** < 640 px (phones) · **M** 640–1023 (large phones, tablets) · **L** 1024–1439 (laptops) · **XL** ≥ 1440.

---

## 1. Explore (`/`, `/{market}`)

**User goal.** See real places that could suit me, then narrow them down.
**Primary action.** Open a place.
**Secondary.** Refine (query, stay mode, filters), save, view on map.

### 1.1 Hierarchy (top to bottom)

1. **Top bar**: wordmark · Saved · Menu.
2. **Search block** (not a hero; ~140 px tall on S):
   - One line of plain text: "Places to rent in Nyeri, confirmed by owners." (Market name from data. This is the answer to "what is Rumia?")
   - **Search box**: placeholder "Try 'bedsitter near DeKUT under 8k'". Typing suggests areas, landmarks and property names; Enter parses the text into chips.
   - **Mode switch**: *Rent monthly* · *Stay a few nights*. Monthly is the default in markets where it's most of the supply.
3. **Filter row** (one line, horizontally scrollable on S): **Area** · **Price** · **Type** · **More**. Each shows its value when set ("Kamakwa", "≤ 8k"). Set filters are removable in one tap (×).
4. **Returning visitor only:** "Continue: Bedsitter · Kamakwa · ≤ 8k · 3 new" and "Recently viewed" (up to 6 small cards). Both dismissible.
5. **Result count and sort**: "48 places" · "Best match ▾" (Best match / Newest / Lowest price). Tapping "Best match" explains it in one sentence.
6. **Results**: cards (§5) in a grid; 20 per page.
7. **Show more** button with "Showing 20 of 48". After the last page: "That's everything. Get alerts for new places" (alert opt-in).
8. **Footer**: Help & safety · List your property · About · Terms · Privacy.

In **Stay a few nights** mode, the filter row becomes **Dates** · **Guests** · **Price** · **More**. Dates are optional; without dates, show places with general availability.

### 1.2 Interaction

- Query, mode and filters live in the URL (`?q=…&mode=monthly&area=kamakwa&max=8000`), so results are shareable and Back works.
- Results update as filters change (no "Apply" on desktop popovers; Apply with a live count on the mobile sheet).
- "More" sheet content depends on Type: hostel → sharing, gender policy, en-suite; apartment → bedrooms, parking, furnished; all → included utilities, has video, Wi-Fi.
- Few results (< 5): a labelled "Close to your search" group follows ("Just above your budget", "In nearby Ruringu, 12 min").
- Each card may show a single reason chip, which is the dominant ranking reason (`../08-intelligence.md` §4.3).

### 1.3 Responsive

| Size | Layout |
|---|---|
| S | 1 column of large cards (image 4:3, full width). Filter row scrolls. Floating **Map** button bottom-centre; map opens full screen with the same filters and a "List" button back |
| M | 2-column grid. Map button as on S |
| L | **Split view**: results 2 columns left (~60%), map right (~40%), sticky. Hovering a card highlights its pin; panning the map offers "Search this area" (not automatic, to avoid surprise reflows) |
| XL | Same split, 3 result columns; max content width 1,600 px |

### 1.4 States

- **Loading:** server-rendered first page, so content appears with the HTML. Client updates show the previous results dimmed with a thin progress bar at the top of the list. No skeleton flashes for fast responses (< 400 ms).
- **Empty:** "No places match all of that." Then the single filter whose removal adds the most results, as a button ("Remove 'Wi-Fi included' → 12 places"), and an alert opt-in ("Tell me when one is listed").
- **Error:** "Couldn't load places. Check your connection." Retry button; keep filters; if cached results exist, show them labelled "Showing results from 5 min ago".
- **Market not live:** "Rumia is coming to {town}. Tell us what you need and we'll let you know." (Waitlist intent.)

### 1.5 Accessibility

- The visible line in §1.1.2 is the page `h1`.
- Filter controls are buttons opening dialogs with focus trapped and returned on close; chips have "Remove {value}" labels.
- Result count is in a polite live region ("48 places").
- Map is supplementary: every map action has a list equivalent; pins are not the only way to reach a place.

---

## 2. Property page (`/p/{slug}`)

**User goal.** Decide whether this place is worth contacting.
**Primary action.** **WhatsApp** the contact person.
**Secondary.** Call, save, share, view map, choose a unit, see similar places.

### 2.1 Hierarchy (S, top to bottom)

1. **Media** (full width, 4:3): video poster with a play button if there is a video, otherwise the cover photo. Counter "1 / 14". Swipe for photos. Tap opens the full-screen viewer with room tags (Room · Bathroom · Kitchen · Outside). Overlay buttons: back, share, save.
2. **Identity**: name (h1), then "Bedsitter · Kamakwa, Nyeri".
3. **Price block**:
   - "KSh 7,500 / month" (largest text on the page after the name).
   - "KSh 15,000 to move in (rent + deposit)".
   - "Included: water, Wi-Fi. Electricity: tokens."
4. **Facts** (2–4 quiet lines, each with a small icon; tap for an explanation):
   - "Available, confirmed by the owner 2 days ago"
   - "Visited by Rumia on 12 Sep 2026" (if true)
   - "Contact number verified" (if true)
   - "In DeKUT's accommodation register" (if true)
5. **Units** (only if more than one): compact table. Type · price · move-in · "3 available". Selecting a unit updates the price block and the pre-filled message. Duplicate-looking units are merged or flagged in the lister editor so seekers never see them.
6. **Location**: "8 min walk to DeKUT main gate · 12 min drive to Nyeri CBD", then a static map image (cheap) that becomes interactive on tap. Approximate area circle unless the lister chose an exact pin.
7. **About**: 3–5 lines, "Read more" for the rest.
8. **What's here**: amenities as a two-column text list (not pills).
9. **Good to know**: rules, gender policy, curfew, visitors, payment terms.
10. **Safety note** (one line, link to Help): "Don't pay any deposit before you've seen the room. Report anyone who asks."
11. **Listed by**: name, role, "On Rumia since 2025", "Usually replies within a day" (when the data exists), link to their profile.
12. **Similar nearby**: 4–6 cards.
13. **Report this listing** (text link).

**Sticky action bar (S and M):** **WhatsApp** (primary, ~60% width) · Call (icon + label) · the price on the left edge when space allows.

**Removed from this page:** view counters, empty review blocks, "Book a tour" as a primary action, M-Pesa payment details (a fraud vector and the wrong moment), uppercase micro-labels, decorative gradients.

### 2.2 Desktop (L, XL)

Two columns. Left (~62%): a media mosaic (one large, four small, "Show all photos"), then sections 2–13. Right: a sticky card with the price block, facts, unit picker, **WhatsApp** (primary), Call, and Save/Share as text buttons. On desktop, WhatsApp opens WhatsApp Web, with a fallback panel showing the number and a QR code ("Scan with your phone").

### 2.3 Responsive rule that prevents bug B1

The action bar shows **below 1024 px** and the sticky card **from 1024 px**, both from one component and one breakpoint constant. There is a visual regression test at 768 px and 1,023 px.

### 2.4 States

- **Let / paused:** banner at the top, "This place was let on 3 Oct." Media and details stay visible (useful context for a shared link); the action bar becomes "See 8 similar places nearby"; similar places move up.
- **Stale** (not confirmed recently): fact line in neutral colour, "Not confirmed in 3 weeks. Ask before you visit." Contact still allowed.
- **Loading:** server-rendered. The media slot reserves its space with the blur placeholder; nothing shifts.
- **Error:** if the API fails, serve the last cached version with "Details may be out of date"; if nothing is cached, a plain error with retry and search.
- **Removed (moderation):** "This listing was removed." No details. Similar places.

### 2.5 Accessibility

- Gallery: each image has alt text built from room tag + property ("Bathroom at Kamakwa Heights"); keyboard arrows in the viewer; Escape closes; focus returns to the gallery.
- Video: captions where the lister provides speech (later: auto-captions from the video provider); controls reachable by keyboard; no autoplay.
- Price and facts are text, not images. Icons are decorative (`aria-hidden`) because the text carries meaning.
- Action bar buttons ≥ 48 px high; WhatsApp button label is "WhatsApp {contact name}" for screen readers.

---

## 3. Contact (from the property page)

**User goal.** Talk to the right person now.

**S/M:** tap **WhatsApp** → Rumia records the inquiry (fire-and-forget, ≤ 300 ms budget, never blocks) → WhatsApp opens with:

> Hi Mary, I found *Kamakwa Heights* on Rumia (Bedsitter, KSh 7,500/month). Is it still available? Ref R7K2

**Call:** `tel:` link; inquiry recorded the same way.

**L/XL:** WhatsApp Web in a new tab; if the user doesn't have it, the fallback panel (number + QR).

**After contact:** when the user returns to the tab (visibility change) within 30 minutes, a small inline prompt under the action bar: "Did Mary reply? Yes · Not yet". Dismissible, never modal. "Not yet" after 24 h offers similar places.

**No** sign-in, phone capture, channel choice, fee explanation or confirmation dialog.

**If WhatsApp isn't installed** (detected by the deep link failing to hand off within ~1.5 s): show the number with Copy and Call.

---

## 4. Saved (`/saved`)

**User goal.** Keep a shortlist and decide between a few places.
**Primary action.** Open or contact a saved place.
**Secondary.** Compare, set alerts, sync across devices.

### Hierarchy

1. "Saved on this phone" with a quiet "Keep them on any device → Sign in" link (only after 2+ saves).
2. Saved cards with status: "Price dropped to 7,000", "Let on 3 Oct", "Confirmed today".
3. **Compare**: select 2–3 → a side-by-side table of the decision facts only (price, move-in, included, walk time to the user's anchor, availability, verification). Not every field.
4. **Alerts**: saved searches with channel and frequency; "Add alert from your current search".

### States

- **Empty:** "Tap ♡ on any place to keep it here." Link to Explore.
- **Offline:** saved places readable from cache; status shows "Last updated 2 h ago".

### Interaction

- Save is optimistic and instant; undo toast ("Saved · Undo") for 5 s.
- Anonymous saves live in local storage keyed by device id and on the server against the device id; on sign-in they merge into the account.

---

## 5. Property card (component)

**Goal.** Let the user decide "I want to see this" in about a second.

```
┌───────────────────────────────┐
│  [cover photo 4:3]        ♡  │   ▶ 0:45 badge if video
│                               │
└───────────────────────────────┘
KSh 7,500 / month · Bedsitter
Baraka · Kamakwa
8 min walk to DeKUT · confirmed 2 days ago   ← quiet text; ✓ icon if visited
```

- Three text lines, max. Price first because it's the first filter in people's heads; type in the same line.
- Line 2 is the name and area. Students know hostels by name and recommend them by name, so the name aids recognition on return and word of mouth.
- Line 3 is location relative to the user's anchor (or the market's main landmark), then the single strongest freshness/trust fact. If stale: "not confirmed recently" in neutral grey.
- No type pill over the image, no "Verified" pill, no view counts, no rating stars until reviews are meaningful.
- Single image (no in-card carousel). Carousels on cards cost data and make swiping ambiguous on phones; the property page is one tap away. Revisit on desktop if data shows users want it.
- Whole card is one link; heart is a separate 44 px button.
- Variants: grid (Explore), compact (Recently viewed, Similar), map popover (image + 2 lines).

---

## 6. Place page (`/{market}/{place}`) and landmark page (`/{market}/near/{landmark}`)

**User goal (often from Google).** "What's it like to live in Kamakwa / near DeKUT, and what's available?"

1. h1 "Places to rent in Kamakwa, Nyeri" / "Places to rent near DeKUT".
2. Three facts: typical bedsitter price, typical 1-bedroom price, walk time to the landmark or CBD.
3. Explore results pre-filtered to this place (same component).
4. Short description written by Rumia (60–120 words), then nearby places links.

Same states as Explore. These pages carry SEO.

---

## 7. Sign-in (sheet)

**Triggered only by:** syncing saves, creating an alert, listing a property, staff work.

1. Sheet titled with the reason: "Keep your saved places on any phone".
2. Options: **Continue with Google** · (later) **Use phone number**.
3. If in an in-app browser and Google is chosen: "Google sign-in doesn't work inside WhatsApp's browser. Open Rumia in Chrome" with an Android intent link and a Copy link fallback. With phone OTP live, that option is promoted instead.
4. After success: back to the same screen, action completed ("Saved places synced").

**Error states:** each failure says what happened ("The sign-in took too long. Try again.") and keeps the user on the page.

---

## 8. Help & safety (`/help`)

Short, scannable answers: how Rumia checks places (what each fact means), how to avoid deposit scams, what to check on a viewing, how to report, how to list a property. Linked from every safety note and from the menu.

---

## 9. Check a listing or agent (`/check`)

One input: "Paste a phone number or Rumia link". Result: what Rumia knows (verified contact? listed places? reports?) and a Report button. Replaces three `/verify` pages and the public bulk endpoint. Rate-limited.

---

## 10. Lister profile (`/l/{slug}`)

Name and role, facts ("On Rumia since 2025", "Contact verified", "4 places listed", "Usually replies within a day"), their live places as cards, Report. Designed to be the link owners put in their TikTok/Instagram bio.

---

## 11. Shared-link landing behaviour (applies to Property)

When `referrer_kind` is WhatsApp/Instagram/TikTok or the user-agent is an in-app browser:

- No banners, prompts or install suggestions.
- "← Back to results" is replaced by "More places in Kamakwa".
- After the user scrolls past the main details, a single line appears above Similar nearby: "Looking for something like this? Explore 48 places in Nyeri."
