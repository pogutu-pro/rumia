# 05 · Information Architecture and UX/UI Strategy

Covers: information architecture, UX/UI strategy, design system, the main seeker, lister and ops experiences. The visual design brief for Claude Design is in `13-design-brief.md`.

The test for every screen: **what is the simplest interface that lets this person do this job very well?**

> **Superseded for the public web:** `ux/` contains the detailed public UX redesign. Where it differs from this file (notably: home and search merge into one Explore screen with starting points instead of an intent card; no "Watch" mode at launch), `ux/` wins. Sections 3 (lister) and 1.3–1.4 (workspace, ops) here remain current.

---

## 1. Information architecture

### 1.1 Seeker (public)

Four destinations. Everything else is reached from them.

```
Home (Discover)      Search (results + map)      Saved (My Rumia)      Property page
   │                      │                          │                     │
   ├ intent card          ├ one query box            ├ saved properties    ├ media first
   ├ continue search      ├ filter chips             ├ saved searches /    ├ cost, availability, trust
   ├ fresh this week      ├ list ⇄ map               │   alerts            ├ location vs anchors
   └ areas & landmarks    └ result count, sort       └ contacted history   ├ sticky contact
                                                                           └ similar nearby / same building
```

Mobile bottom navigation: **Discover · Search · Saved · (Account)**. Desktop: same four in the header. "Watch" (video browsing) is a mode inside Discover, not a top-level tab, until video coverage is high (`02-product-vision.md` §2.4).

Removed or folded in:

| Today | Becomes |
|---|---|
| `/hostels`, `/browse`, `/bnb`, `/videos` | One Search, with type filter and video mode |
| `/hostels/[county]/[area]` | Place landing pages (SEO), same template as Search with a preset |
| `/compare` (1,427 lines) | Compare tray inside Saved (2–3 properties side by side) |
| `/book-tour`, `find-me-a-hostel` | One "Rumia Assist" request page, if the service continues (`04` §6) |
| `/verify`, `/verify/records`, `/verify/report` | Trust is shown on the property page; a public "Check a listing or agent" lookup stays as a single page |
| `/agents`, `/agents/[slug]`, `/agent/[id]` | Lister org profile page (`/l/{slug}`), reached from property pages |
| Account tabs (tours, saved, find-me-a-hostel, agent application) | My Rumia (saved, alerts, history) + "List your property" entry |

### 1.2 URL scheme

**[FACT]** Today: `/hostels/{county}/{area}/{slug}` for all categories, `/bnb/{id}` for short stays, `/listing/{id}` legacy redirects.

**[REC]**

| URL | Purpose |
|---|---|
| `/p/{slug}` | Canonical property page. Short, category-free, stable when type or area changes. This is the link owners share. `slug` = readable name + short id (`kamakwa-heights-7k2`) |
| `/{market}` | Market home (e.g. `/nyeri`) |
| `/{market}/{place}` | Neighbourhood landing (e.g. `/nyeri/kamakwa`) |
| `/{market}/{place}/{category}` | SEO landing (e.g. `/nyeri/kamakwa/bedsitters`) |
| `/{market}/near/{landmark}` | Landmark landing (e.g. `/nyeri/near/dekut`) |
| `/l/{slug}` | Lister org profile |
| `/search?…` | Search state in query params, shareable |

All old URLs 301 to new ones permanently (redirect table generated from the listings table).

### 1.3 Lister workspace

```
Today (attention list) ─ Listings ─ Inquiries ─ Account/Org
```

"Today" is the home: listings needing confirmation, changes requested by review, new inquiries, drafts to finish. One tap per action.

### 1.4 Ops console

```
Queues ─ Markets ─ Search ─ Settings (admin)
```

See `04-operating-model.md` §8.1.

---

## 2. Key seeker experiences

### 2.1 Arriving from a shared link (the most important page)

- Property page renders server-side, under ~100 KB of critical HTML/CSS and minimal JS; lead image or video poster visible immediately.
- No sign-in prompt, no install prompt, no cookie wall, no notification prompt on first visit.
- If the user-agent is an in-app browser, nothing changes for browsing or contact (contact needs no sign-in). If they choose an action that needs an account, show a clear "Open in Chrome" step with a copy-link fallback.
- Below the property: "Similar places nearby" and "More in {neighbourhood}", so a single-property visit can become a search.
- If the listing is let or paused: say so plainly at the top, then show alternatives. Never a 404 for a shared link.

### 2.2 Home (Discover)

New visitor:

1. One-line value statement for the market ("Real, available places to rent in Nyeri. Confirmed by owners this week.").
2. **Intent card** (optional, inline, not modal): *Monthly or nightly?* → *Where?* (landmarks and neighbourhoods as chips; DeKUT is one chip, not the default) → *Budget* (range slider with market-appropriate steps). Each answer immediately filters the content below it, so the user sees the effect of answering.
3. "Fresh this week": confirmed-available listings, ranked (`08-intelligence.md`).
4. Areas: neighbourhood cards with counts and typical price.

Returning visitor with an active intent:

1. "Continue your search: 1BR · Kamakwa · ≤ 15k" with "4 new since Tuesday".
2. Saved properties with status changes ("Price dropped", "Let").
3. Then the regular sections.

### 2.3 Search

- One input that accepts natural language ("bedsitter near dekut under 8k with wifi"), parsed into visible, removable chips. The existing `parse-query.ts` is a good start; it moves server-side and reads place and landmark names from data instead of hard-coded keywords.
- Honest result count, default sort "Best match" with a visible explanation; alternatives: Newest, Price.
- List and map views. Map is especially useful for apartments and short stays.
- Paged server-side (cursor), 20 per page, not 1,000 listings downloaded to the phone.
- Empty or tiny result sets suggest the nearest relaxation ("2 more if you go to 16k", "9 in Ruringu, 10 min away").
- "Save this search" shown after the user has refined a search, with the benefit stated ("We'll WhatsApp you when a match is listed").

### 2.4 Property page

Order and rationale in `03-users-and-behavior.md` §3.5. Additional rules:

- **Price block**: rent per period, deposit, and an "Included" line (water, electricity, Wi-Fi) shown as icons with text. If the property has multiple unit types, show a compact unit table ("Bedsitter KSh 7,500 · 3 available") and let the user pick one; contact pre-fills the chosen unit.
- **Availability and trust block**: plain-language lines from `04` §7. Tapping one explains it.
- **Location**: neighbourhood, approximate pin (exact address shared by the lister in chat if they choose), walking/driving time to the user's anchor or to major landmarks.
- **Sticky action bar (mobile)**: WhatsApp (primary), Call, Save, Share.
- **Share**: native share sheet; pre-composed WhatsApp text with price and area; an Open Graph image showing lead photo, price, neighbourhood and trust line, so a link preview in a WhatsApp chat is informative before anyone taps it.

### 2.5 Contact

One tap → WhatsApp with a pre-filled message and reference code (`04` §5.5). No sign-in, no phone capture, no channel choice, no fee step. After returning to Rumia, a light prompt: "Did they reply?" (Yes / No / Not yet). This gives response-rate data per lister and a natural moment to offer "Save this search / get alerts".

### 2.6 Saved (My Rumia)

- Saved properties with live status (available, price changed, let).
- Compare tray (2–3).
- Saved searches with alert channel (WhatsApp, email, push) and frequency.
- Contact history with reference codes and "Did you move in?" for outcome capture.
- Works without an account on the current device; signing in syncs across devices. The prompt to sign in is "Keep your saved places on any phone".

---

## 3. Lister experience

### 3.1 Create listing (replaces the 1,814-line form)

Mobile-first, step-by-step, auto-saved, roughly 3 minutes for a simple listing:

1. **Media**: pick photos and a video from the phone. Upload starts immediately in the background, compressing on the device. Suggest shot types ("Add a bathroom photo"), don't require them.
2. **What is it?** Property type (Hostel / Bedsitter-studio block / Apartment / House / Short stay). This decides which questions follow.
3. **Where?** Drop a pin (default to current location when on site) → neighbourhood is derived; name of building.
4. **Units and prices**: add unit types with price, period, deposit, count available. Hostel: room type + sharing. Apartment: bedrooms. Short stay: guests + nightly price.
5. **What's included**: toggle chips (water, electricity, Wi-Fi, hot water, parking, security, furnished).
6. **Contact**: defaults to the org's designated contact; change per property.
7. **Review**: preview exactly as seekers will see it, with a checklist ("Add 2 more photos for a better ranking"). Submit.

Description is optional and short; the system composes a summary from structured fields. Fields that only apply to one type are not shown for others. Draft listings appear on "Today" until finished.

### 3.2 Keeping a listing true

- "Still available?" one-tap on "Today" and in WhatsApp/SMS.
- "Mark let" per unit type, and "Available again from {date}".
- Weekly digest: views, contacts, how this listing ranks vs similar ones, one concrete suggestion.

---

## 4. Authentication UX

- No sign-in to browse, contact, share or save on the current device.
- Sign-in triggers: syncing saves across devices, creating alerts, listing a property, staff work.
- Methods: Google (works in real browsers) now. Phone number OTP next, since it works in in-app browsers and every Kenyan user has a phone number (`06-architecture.md` §6).
- In-app browser detected + Google chosen → explain and offer "Open in browser" (Android intent link where possible; copy-link otherwise) or switch to phone OTP once available.
- After sign-in, return to the exact action, not to `/account`.
- No profile completion modal. Phone is collected when choosing WhatsApp alerts; campus/landmark is collected as part of intent, not identity.

---

## 5. States

| State | Rule |
|---|---|
| Loading | Skeletons that match final layout; media placeholders use blur data already generated. Never a spinner over a blank page |
| Empty | Explain why and offer the nearest useful action ("No 2-bedrooms under 10k in Kamakwa. 5 in Ruringu ↗"). Never a dead end |
| Error | Say what happened in plain language and what to do. Keep user input. Offer retry. Report to Sentry with the cause (`06` §5) |
| Offline | Saved properties and recently viewed pages readable offline (service worker); actions queue or explain |
| Success | Confirm inline with the result, not just a toast ("Saved. We'll tell you if the price changes") |
| Destructive | Undo instead of "Are you sure?" where possible (unsave, remove from compare) |

---

## 6. Design system

**[FACT]** shadcn/ui on Radix with Tailwind 4; three icon libraries (lucide, heroicons, react-icons); two chart libraries; framer-motion; next-themes.

**[REC]**

- **Keep** shadcn/ui + Radix + Tailwind. It is the right base and the team knows it.
- **Tokens first**: colour (semantic: `surface`, `text`, `muted`, `accent`, `positive`, `warning`, `danger`, `trust`), type scale, spacing, radius, elevation, motion durations, defined once as CSS variables and consumed by Tailwind. Light and dark.
- **One icon set** (lucide). One chart library for internal use (recharts) or none if PostHog/Metabase cover analytics.
- **Composite components** owned by Rumia, built once: `PropertyCard` (variants: grid, list, compact, map popover), `PriceBlock`, `TrustLine`, `AvailabilityPill`, `MediaGallery`, `VideoPlayer`, `IntentCard`, `FilterChips`, `ActionBar`, `QueueItem`, `EntityTimeline`, `EmptyState`.
- **Typography**: one variable sans family with good numerals (prices are the most-read text). Prices tabular.
- **Motion**: functional only (sheet open/close, gallery). Respect `prefers-reduced-motion`. No spring animations on modals for low-end devices.
- **Brand personality**: calm, clear, local. Not "luxury property portal", not "student party". Premium supply gets better photography and layout space, not a different visual language.

### 6.1 Accessibility and device budget

- WCAG 2.2 AA contrast; tap targets ≥ 44 px; labels on every input; focus visible; screen-reader names for icon buttons.
- Performance budget for public pages on a mid-range Android over 4G: LCP < 2.5 s, INP < 200 ms, CLS < 0.1, ≤ 150 KB JS on the property page.
- Respect `Save-Data` and slow connections: no video autoplay, smaller image variants.
- Swahili: design so a second language can be added (strings externalised). Translating is a later decision.

---

## 7. What to remove from the current UI

- Contact modal steps: channel choice, sign-in, phone, fee.
- Profile completion modal.
- Five homepage rails from one pool.
- View counts on public pages.
- Campus switcher as a primary navigation element (becomes a market selector shown only when there are 2+ live markets).
- Separate BnB search and listing pages.
- Confetti, three.js effects and decorative animation.
