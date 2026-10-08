# UX 01 · Current UX Audit and Journey Audit

Covers deliverables 1 (current UX audit) and 2 (user journey audit).

**Method and limits.** Evidence comes from the public web code (`web/src/app/(public)`, `web/src/components`) and from fetching the live site (`rumia.co.ke` home and the property page `/hostels/nyeri/Boma/baraka-boma`) on 2026-10-08. I could not drive a real browser in this session, so visual layout, real device performance and screen-reader output are **not yet observed**. Those checks are listed in §6 and should be done once the Chrome extension is connected (`/chrome`) and on real Android phones.

Tags: **[CODE]** read in code · **[LIVE]** seen on the live site · **[INFER]** reasoned from the two.

---

## 1. What works

| What | Why it's good | Evidence |
|---|---|---|
| Photo-first cards with price per period | Matches how people scan listings | `components/home/explore-listing-card.tsx` |
| "Total to move in" (rent + deposit) per room type | Exactly the number Kenyan renters need; rarely shown elsewhere | [LIVE] Baraka page: "Total to move in: KES 18,300" |
| Walking time to campus on cards | Answers "where is it?" in the user's terms | [LIVE] "Boma · 5–10 min walk" |
| Blur placeholders and responsive images | Perceived speed on slow networks | `listing_images.blur_data_url`, `next/image` |
| Server-rendered public pages with ISR | Fast first paint, crawlable, link previews work | `revalidate` on home/detail |
| Natural-language query parsing ("bedsitter under 8k") | Right idea: let people type what they mean | `lib/search/parse-query.ts` |
| Mobile sticky action bar on detail pages | Keeps the main action in reach | detail `page.tsx` bottom bar |
| Accessibility basics in places: `aria-*` on search, focus rings, reduced-motion on 404 | Shows intent to get it right | `navbar-search.tsx`, `not-found.tsx` |
| JSON-LD and OG images | SEO and shareable previews | `JsonLd`, `/api/og` |

---

## 2. What doesn't work

### 2.1 Blocking problems (fix even before the redesign)

| # | Problem | Evidence | Impact |
|---|---|---|---|
| B1 | **No Contact button between 768 px and 1023 px wide.** The sidebar CTA is `hidden lg:block`, the sticky bar is `md:hidden`; nothing renders in between | [CODE] `hostels/[county]/[area]/[slug]/page.tsx:509, 750`; same pattern in `bnb/[id]/page.tsx:531, 552` | Tablets in portrait and narrow laptop windows cannot contact a property at all |
| B2 | **Contact requires Google sign-in**, then phone, then possibly a fee step | [CODE] `listing/[id]/contact-modal.tsx` | Google refuses OAuth in WhatsApp/Instagram/Facebook in-app browsers (`disallowed_useragent`, enforced since 2017). That is where shared Rumia links open |
| B3 | **Save requires sign-in and sends the user to `/auth/login` with no way back** | [CODE] `components/ui/save-button.tsx:31-32` (`router.push('/auth/login')`, no `next`) | User loses the property they were looking at |
| B4 | **Location is switched off** on property pages ("hidden per product decision") | [CODE] detail page, commented-out `LocationSection`; [LIVE] no map | Location is the deciding factor in accommodation choice (Baymard, §UX 02) |
| B5 | **Invented claim: "Security Available"** is shown when no security type is set | [CODE] sidebar: `Security {listing.security_type \|\| 'Available'}` | A false trust signal on every listing without data |
| B6 | **Stock photo fallback**: listings without images show an Unsplash photo | [CODE] `explore-listing-card.tsx` `FALLBACK = 'https://images.unsplash.com/…'` | Looks like a scam pattern; destroys trust if noticed |
| B7 | **Card price ≠ detail price.** Card shows `listing.price` (KSh 9,300); detail shows "from KES 5,800" (minimum room type) | [CODE] card vs `startingPrice`; [LIVE] Baraka: card 9,300, detail 5,800 | Feels like bait-and-switch |

### 2.2 Major friction

| Problem | Evidence | Principle violated |
|---|---|---|
| Home has no visible statement of what Rumia is; the only `<h1>` is screen-reader-only | [CODE] `(public)/page.tsx` `h1.sr-only` | First-visit comprehension; visibility |
| Everything defaults to DeKUT students: "Explore near DeKUT", "Student rooms near campus", "Budget-friendly hostels", footer "Built for university students" | [LIVE] home | Match with the real world for non-students; the product says "not for you" to workers and visitors |
| Category tabs mix a brand and types: "Hostels · RumiaBnB · Apartments", default Hostels | [LIVE], `explore-discovery.tsx` | Internal naming ("RumiaBnB") leaks; default excludes most non-student needs |
| Home is 4 horizontal rails (22 + 12 + 12 + 12 cards) drawn from the same pool, assembled from 5 API calls | [LIVE], [CODE] | Choice overload, duplicate-feeling content, and horizontal scrolling hides most items |
| Search placeholder "Search hostels, areas…" and every search routes to `/hostels`, even for apartments | [CODE] `navbar-search.tsx` | Information scent points only to hostels |
| Search panel mixes searching with "Book a tour" | [CODE] `handleBookTour` in search | Two unrelated tasks in one control |
| Filters are hostel-specific (gender, room type, distance from campus, zones) and identical for all property types | [CODE] `components/ui/filter/*` | Irrelevant choices for apartments and short stays |
| `/hostels` downloads up to 1,000 listings and filters on the phone | [CODE] `hostels/page.tsx:35` | Slow and data-expensive on Kenyan mobile plans |
| Two primary buttons on property pages: "Book a Tour" and "Contact" with equal weight; live HTML shows "Book a Tour" as the visible CTA | [CODE], [LIVE] | One primary action per screen; the paid tour competes with the free contact |
| Contact forces a choice between "hostel owner" and "Rumia agent", explained with fees | [CODE] contact modal | Hick's law; users can't make this choice well |
| View counts at the top of the page: "0 views today · 24 this week · 59 this month · 1,853 since listed" | [LIVE] | Low numbers act as negative social proof; noise above the fold |
| Empty "Student Reviews" section on pages with no reviews | [LIVE] | An empty block reads as "nobody likes this" |
| Video placed far down the page, below room types | [CODE] render order | The most persuasive media is the least seen |
| Footer tagline "Verified campus accommodations and simplified lead generation" | [LIVE] | "Lead generation" is internal business language addressed to customers |
| Property URLs contain raw spaces and mixed case: `/hostels/nyeri/Near Gate A/…`, `/hostels/nyeri/Boma/…` | [LIVE] | Ugly in WhatsApp, breaks some link parsers, weak SEO |
| Duplicate-looking room options with very different prices (two "Bedsitter – Upper floor, 1 person" at 11,300 and 5,800) | [LIVE] Baraka | Data quality looks like a trick; the UI doesn't help listers avoid it |

### 2.3 Navigation and IA

- Header: logo, a search pill, "Videos" (desktop only), "Wishlist". On mobile, **Videos is not reachable from the header** (`hidden md:inline-flex`). [CODE]
- "Wishlist" (header) vs "Saved" (route `/saved`) vs "hostel_wishlisted" (analytics): three names for one thing. [CODE]
- Public routes overlap: `/hostels`, `/browse` (redirect), `/bnb`, `/videos`, `/compare`, `/verify`, `/verify/records`, `/verify/report`, `/agents`, `/agents/[slug]`, `/agent/[id]`, `/listing/[id]`, `/book-tour`. Four ways to look at listings, three verification pages. [CODE]
- Short stays have their own search, cards and detail page (`/bnb/[id]`), so the same user moves between two different products. [CODE]

### 2.4 Visual consistency

[CODE] counts across public pages and components:

- Four grey families used side by side: `slate` (1,276 uses), `gray` (120), `neutral` (20), `zinc` (8). Raw palette classes everywhere, no semantic tokens.
- Two typefaces (Inter + Plus Jakarta Sans) with weights up to `font-black`.
- Five radius values in regular use (`full`, `xl`, `2xl`, `lg`, `md`), plus one-offs.
- **101 uses of 9–11 px text** (`text-[9px]`, `[10px]`, `[11px]`), used for badges, labels and prices' context. Too small for comfortable reading on phones and for low-vision users.
- Gradients, `font-black` prices, uppercase micro-labels ("STARTING FROM", "MOVE IN FROM") and coloured pills compete for attention on the detail sidebar.

### 2.5 Accessibility (from code; to be verified with tools)

- Text below 12 px in 101 places (above).
- The home page's only `h1` is visually hidden; sighted users get no page heading.
- Icon-only buttons mostly labelled (save, share, mute), good; the mobile Wishlist link reuses the desktop label.
- Contact and tour flows are modals with focus management of varying quality; the contact modal is 871 lines with multiple steps, hard to keep accessible.
- Video feed autoplays YouTube iframes (muted) for the active item and pre-renders neighbours (`video-item.tsx`): motion and data cost without consent.
- Not verified: colour contrast of `text-slate-400` labels on white (likely below 4.5:1 at small sizes), keyboard order, screen-reader announcements.

### 2.6 Performance-related UX

- Home: 5 parallel feed calls per render (cached by ISR, so mostly invisible to users, but slow on cache misses). [CODE]
- `/hostels`: up to 1,000 listings with images and room types in one response. [CODE]
- Video page: YouTube iframes; each costs hundreds of KB to MB before play. [CODE]
- Heavy client bundles: framer-motion on many public components; three.js and chart libraries installed (bundle impact to be measured). [CODE]
- Not measured: real LCP/INP on a mid-range Android over 4G. Must be measured before and after.

---

## 3. Journey audit

### Journey 1 · A WhatsApp link to a property

| Step | Today | Problems |
|---|---|---|
| Tap link in WhatsApp | Opens in WhatsApp's in-app browser. Link preview shows OG title/image | URL has spaces/case; OG image doesn't state availability or price clearly (to verify) |
| Page loads | Gallery, title, location line, view counts, quick facts | View counts ("0 today") above the fold; no map; video far below |
| Understand price | Card price vs "from" price may differ; room options can look duplicated | B7 |
| Trust | "Verified Agent" label, tick icons, sometimes an invented "Security Available" | No freshness/availability date; B5 |
| Contact | Tap Contact → choose owner/agent → **Google sign-in (blocked in this browser)** | B2: dead end for most visitors from WhatsApp |
| Book a tour (alternative) | Paid tour flow | Competes with contact |
| Save | Redirect to login, page lost | B3 |

**Steps to contact today:** 4–7, with a hard block in the most common browser. **Target:** 1 tap.

### Journey 2 · First visit, no specific property

Lands on home → sees a search pill and "Hostels · RumiaBnB · Apartments" tabs set to Hostels → "Explore near DeKUT" rail → three more rails. There is no sentence saying what Rumia is or for whom. A worker or parent sees a student hostel site. A student sees useful content quickly. **Verdict:** good for DeKUT students, wrong for everyone else.

### Journey 3 · Knows exactly what they want ("2-bedroom apartment in Nyeri under 30k")

Typing into the search goes to `/hostels?q=…`. The parser recognises some terms; filters are hostel-centric (gender, room types), there's no bedroom filter, and no map. Results come from a client-side search over everything loaded. **Verdict:** possible, but the interface keeps saying "hostels", and a non-student has to translate their need into hostel vocabulary.

### Journey 4 · Doesn't know what they want

Home rails, area dropdown, Videos page (desktop link only). Browsing is pleasant on the first rail, then repetitive (the same pool sorted four ways). No map to browse by area. **Verdict:** partial.

### Journey 5 · Returning visitor

Rumia shows the same home as a first visit. No recently viewed, no remembered search, saved items only after sign-in. **Verdict:** Rumia knows nothing about a returning anonymous visitor, though the browser could easily remember their last search and viewed properties.

### Saved properties

Requires an account, redirects without return, and `/compare` is a separate 1,427-line page. **Verdict:** high cost for a low-commitment action. Saving should be the easy "maybe" step before contacting.

### Sharing

Share modal with WhatsApp, Facebook, copy link, and the native share sheet where available. **Good base.** Missing: a pre-written message with price and area, and a preview that sells the property in the chat.

### Error and recovery

- 404 page is well built (focus management, reduced motion). [CODE]
- Auth errors are toasts on the login page; the user's original context is lost. [CODE]
- A let or inactive listing returns 404 to non-owners (`listings/router.py`), so **a shared link to a let property is a dead end** instead of "this is taken; here are similar ones". [CODE]
- Offline: an `/offline` page exists; saved properties aren't readable offline. [CODE]

---

## 4. Heuristic summary

| Heuristic | Rating | Main reason |
|---|---|---|
| Visibility of system status | Weak | No freshness/availability status; saves vanish into a login redirect |
| Match with the real world | Weak | DeKUT/student/RumiaBnB vocabulary for everyone |
| User control and freedom | Weak | Login redirects lose context; filters can't be undone quickly on mobile |
| Consistency | Weak | Two products (hostels vs BnB), three names for saved, four greys |
| Error prevention | Weak | Price mismatch, duplicate room options, invented security claim |
| Recognition over recall | Weak | Returning users re-enter everything |
| Flexibility | Fair | Natural-language search exists |
| Minimalist design | Weak | View counts, empty reviews, 4 rails, two primary CTAs |
| Error recovery | Fair | Good 404; dead ends for let listings and blocked sign-in |
| Help | Fair | Fee explanations exist but appear at the wrong moment |

Additional lenses:

- **Hick's law**: owner-vs-agent contact choice, five filter groups shown at once.
- **Fitts's law**: mobile sticky bar is good; header heart is a 36 px target, below the 44 px recommendation.
- **Information scent**: "Search hostels" wording weakens scent for apartments and short stays.
- **Serial position**: the most important persuasive content (video, location) sits in the low-attention middle-to-end of the page.
- **Choice architecture**: the paid tour is presented as an equal alternative to free contact, which nudges toward a paid path without saying why.

---

## 5. Verdict

**The current public UI is not a good enough base to restyle.** Its structure encodes the original product (DeKUT hostels plus a separate BnB), its core action is blocked in the main channel, and its information hierarchy puts noise above decision-critical information. The underlying data pipeline, SSR setup and several components are reusable. **Recommendation: rebuild the public UI** on the existing Next.js stack (`07-decisions-and-sequence.md`), and ship the blocking fixes B1–B7 immediately, independent of the redesign.

---

## 6. Still to verify with a real browser and devices

1. B1 at 768–1023 px, in Chrome DevTools and on an actual tablet.
2. LCP/INP/CLS on the property page and home on a mid-range Android over throttled 4G and 3G.
3. The full journey from a WhatsApp message on Android and iPhone, including what Google shows in the in-app browser.
4. Colour contrast with an automated checker (axe) on home, results and property pages.
5. Keyboard-only and TalkBack/VoiceOver passes on home → property → contact.
6. The OG preview card as rendered inside WhatsApp.
