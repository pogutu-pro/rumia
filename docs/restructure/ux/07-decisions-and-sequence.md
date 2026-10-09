# UX 07 · Before vs After, Rebuild Decisions, Sequence, Final Answer

Covers deliverables 12 (before vs after), 13 (rebuild decision) and 14 (implementation sequence), and answers the final question.

---

## 1. Before vs after

| Moment | Today | Proposed |
|---|---|---|
| First visit | Four rails of DeKUT hostels; no visible statement of what Rumia is; tabs "Hostels · RumiaBnB · Apartments" | One line saying what Rumia is in this town, one search box, four data-driven starting points, then real places ranked by freshness and quality |
| Knowing what you want | Type into "Search hostels…", land on `/hostels` with hostel filters; 1,000 listings downloaded | Type "2 bedroom under 30k"; chips appear; type-specific filters; server-side results with an honest count; split map on desktop |
| Not knowing | Scroll horizontal rails of the same pool | Browse Explore and the map; area and landmark pages; similar places on every property page |
| Card | Type pill, verified pill, title, area + walk time, price that may not match the detail page; stock photo if no image | Price · type / name · area / walk time · freshness. Price matches the property page. No stock images |
| Property page | Gallery, title, view counts, facts, video far down, no map, "Security Available" by default, M-Pesa details, empty reviews, two primary buttons | Media (video first) → price and move-in cost → dated facts → units → location with map → details → safety note. One primary button: WhatsApp |
| Contact | Choose owner/agent → Google sign-in (blocked in WhatsApp browser) → phone → maybe fee → WhatsApp | **One tap → WhatsApp** with a pre-filled message and ref code |
| Tablet (768–1023 px) | No Contact button at all | Same action bar as phones |
| Save | Sign-in redirect, page lost | Instant, on the device; undo; sync optional |
| Return visit | Same as a first visit | "Continue your search · 3 new", recently viewed, saved places with status changes |
| Let property via old link | 404 | "Let on 3 Oct" with similar places |
| Short stays | Separate product (`/bnb`) | A mode on the same screens |
| Visual system | 4 greys, 2 fonts, 5 radii, 101 tiny-text uses, gradients and black-weight prices | Semantic tokens, 1 font, 2 radii, ≥ 12 px text, one accent, one shadow |

---

## 2. Rebuild decision by area

| Area | Decision | Reason |
|---|---|---|
| Public page structure and routes | **Rebuild** | Structure encodes DeKUT hostels + separate BnB; URLs have spaces; four overlapping listing routes |
| Home | **Rebuild** (as Explore) | Wrong model (landing + rails) |
| Search, filters, results | **Rebuild** | Client-side search over 1,000 items; hostel-only filters; 947-line search component mixing tour booking |
| Property page | **Rebuild** | Hierarchy wrong, blocking bugs B1/B4/B5/B7, two primary actions |
| Contact flow | **Remove** and replace with one tap | Blocked in the main channel |
| Save / Saved / Compare | **Rebuild** | Account wall; compare is a separate 1,427-line page |
| Sign-in | **Rebuild** as an in-context sheet | Only for sync/alerts/listing |
| Videos page | **Remove** (for now) | YouTube autoplay feed; low coverage; data cost |
| Verify pages | **Simplify** to `/check` | Three pages, one bulk endpoint |
| Agent pages | **Rebuild** as lister profiles | New org model |
| Header/footer | **Rebuild** | Hidden mobile links, internal language ("lead generation") |
| 404 | **Keep** structure, simplify | Good focus handling |
| Share modal | **Refactor** | Good base; add pre-written message, better OG |
| Image pipeline, blur placeholders, `next/image` | **Keep** | Works |
| OG image route | **Refactor** | Add price, area, freshness |
| Natural-language parser | **Refactor** (move server-side, data-driven places) | Right idea, hard-coded areas |
| JSON-LD / SEO plumbing | **Keep**, update URLs | Works |
| Service worker hygiene | **Keep**, extend for saved/offline | Recently fixed and sound |
| shadcn/Radix primitives, Tailwind | **Keep** | Good base; add tokens |
| framer-motion, three.js, chart libs, Fuse, extra icon sets on public pages | **Remove** | Bundle weight without user value |
| Next.js App Router | **Keep** | Fits SSR/ISR, edge caching, OG |

**Overall: rebuild the public UI on the existing Next.js stack.** It's a rebuild of structure and components, not of the platform. The ideal UX also depends on backend changes already planned: server-side search with cursor paging (`../06-architecture.md` §3.5), contact without auth and inquiries (`../04-operating-model.md` §5.5), freshness and verification facts (`../04` §4, §7), properties/units with consistent pricing (`../07-domain-and-data.md`), device ids and events (`../08-intelligence.md`). Where the backend isn't ready, the UI shows less rather than inventing (e.g. no freshness line until `last_confirmed_at` exists).

---

## 3. Implementation sequence

### Step 0 · Fix now, regardless of redesign (days)

These are bugs and trust problems in the current UI. Ship them on the current code:

1. B1: Contact button missing at 768–1023 px (hostel and BnB detail pages).
2. B5: remove the "Security Available" default.
3. B6: remove the Unsplash fallback image; show a neutral "No photo yet" tile.
4. B7: card price = the property page's "from" price.
5. Hide view counters and empty review sections.
6. B3: save redirects back to the property after sign-in (until device saves ship).
7. Footer copy: remove "simplified lead generation".
8. Lowercase, hyphenated area segments in URLs, with 301s from the current ones.
9. B4: restore the location section (approximate area at minimum).

### Step 1 · Design in Claude Design (1–2 weeks)

Design system tokens and type exploration first, then screens in this order, each on S and L:

1. Property page (available, stale, let states) + action bar + contact handoff
2. Property card variants
3. Explore (new visitor, returning, few results, empty, nightly mode, filter sheet, map split)
4. Saved + compare + alerts
5. Place / landmark page
6. Sign-in sheet (incl. in-app browser variant), Help & safety, `/check`, lister profile

### Step 2 · Validate (1 week, overlapping)

- **Clickable prototype tests with 6–8 people in Nyeri**: 3 students (incl. a first-year), 1 parent, 2 young workers, 1 short-stay visitor. On their own Android phones, starting from a WhatsApp message containing a prototype link.
- Tasks: "Your friend sent you this. Would you contact it? Do it." · "Find a bedsitter under 8,000 near the university." · "Find a 2-bedroom for your family under 30,000." · "Come back tomorrow and find the place you liked."
- Measure: time to first contact, wrong taps, what they say about trust, whether they understand each fact line, what they'd want to know that isn't there.
- Also test with 2–3 listers: does their place look right, would they share the link?
- Iterate designs once; re-test the property page if it changed substantially.

### Step 3 · Build (in this order; each replaces the old screen when it ships)

| Order | Build | Depends on |
|---|---|---|
| 1 | Design tokens + core components (Button, FactLine, PriceBlock, PropertyCard, MediaViewer, ActionBar, Sheet) | — |
| 2 | **Property page** `/p/{slug}` + one-tap contact + OG image + redirects | Inquiries/ref codes API; consistent "from" price |
| 3 | **Explore** (server search, filters, map split, Show more) + place/landmark pages | Search API with cursor paging; places/landmarks |
| 4 | Device id, device saves, recently viewed, Continue | Events + device id |
| 5 | Saved + compare + alerts | Saved searches + notification channel |
| 6 | Sign-in sheet, Help & safety, `/check`, lister profile | Org model |
| 7 | Delete old public routes and components | All above |

### Step 4 · Measure against the before

Baseline now, compare after each release: share-link → contact rate, time to first contact, search → open → contact funnel, zero-result rate, return-visit rate, saves per visitor, Core Web Vitals on Android.

---

## 4. The final question

> If an exceptional product team were given Rumia today, what public web experience would they build to make Rumia one of the easiest property discovery products in Kenya to use?

**They would build three screens and make them very good.**

1. **A property page that sells the place and gets you talking in one tap.** Video or the best room photo first. The rent, the move-in total, and what's included, right under the name. Plain dated facts instead of badges: "Available, confirmed by the owner 2 days ago", "Visited by Rumia on 12 Sep", "8 min walk to DeKUT gate". A real map. One green button: *WhatsApp Mary*, which opens WhatsApp with the message already written. No account, no choice of agent, no fee screen, no tour upsell in the way. A one-line warning never to pay before viewing. If the place is let, the link still works and shows what's similar. This page is built to be opened from a WhatsApp chat on a cheap Android phone and to look good as a link preview, because that's how most people will meet Rumia.

2. **One Explore screen that is both the home page and the search.** It says what Rumia is in one sentence, offers one search box that understands "bedsitter near DeKUT under 8k", a monthly/nightly switch, three filters (area, price, type) and a "More" sheet that only asks questions relevant to the type you picked. Results are real places with honest counts, ranked by availability, trust and fit, each card showing price, name, area, walk time and how recently it was confirmed. On a laptop the map sits next to the list. When nothing matches, it tells you the one change that would help and offers to tell you when something appears.

3. **A Saved screen that remembers for you without asking you to sign up.** Hearts save instantly on the phone. Saved places show what changed (price, let, reconfirmed). Pick two or three to compare on the facts that matter. Turn your search into an alert and get a WhatsApp message when a match is listed: "3 new verified 2-bedrooms around KSh 30k in Nyeri since Tuesday."

Around those three: place and landmark pages for Google, a lister profile owners put in their bio, a Help & safety page, and a sign-in that appears only when you ask Rumia to remember across devices.

**What they would leave out:** a landing-page hero, category carousels, a TikTok-style feed, view counters, empty review sections, a separate short-stay product, a separate compare page, account walls, autoplay video, and any badge that isn't a dated fact.

**Why this is simpler than Airbnb:** no dates or guest counts for monthly rentals, no checkout, no account, three filters instead of dozens, and the price shown is what you pay to move in. Rumia's question is simpler than Airbnb's, so its product can be too: *find a real place you can afford near where you need to be, then talk to the person with the keys.*
