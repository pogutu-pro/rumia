# UX 03 · Principles, Information Architecture and Screen Inventory

Covers deliverables 4 (principles), 5 (IA) and 6 (screen inventory).

---

## 1. Principles

Seven, each phrased so it can settle an argument. If a proposal breaks one, it needs a strong reason.

1. **Show places, not pages about places.** Every public screen leads with real properties. No hero banners, no marketing sections between the user and the inventory.
2. **Ask nothing before showing something.** No required question, sign-in or setup before results. Every question Rumia asks must visibly change what the user sees the moment it is answered.
3. **One primary action per screen.** Explore: open a place. Property: WhatsApp the person with the keys. Saved: compare or contact. Everything else is visibly secondary.
4. **Facts over adjectives.** "Confirmed available 2 days ago", "Visited by Rumia on 12 Sep", "8 min walk to DeKUT", "KSh 16,500 to move in". No "Verified!" badges without a date, no "Premium", no invented claims, no fake urgency.
5. **Remember, don't re-ask.** The site remembers the user's last search, viewed places and saves on their phone, without an account. Rumia never makes someone do the same work twice.
6. **Cheap on data, fast on bad networks.** If a feature costs the user megabytes they didn't ask for (autoplay, giant payloads, decorative animation), it doesn't ship.
7. **Words people use.** Bedsitter, hostel, single room, deposit, "near Gate B". Never internal names (RumiaBnB, zones, leads, agents vs owners).

What I rejected from the brief's examples, and why:

- "Mobile web must feel native-quality" — kept in spirit, but as an outcome of principles 3 and 6 rather than a goal. Chasing native feel tends to add gestures and animation that cost performance and accessibility.
- "Search and discovery should coexist" — made concrete instead: **search and discovery are the same screen** (§2).

---

## 2. The central IA decision: one Explore screen

**Problem.** Today home, `/hostels`, `/bnb` and `/videos` are four ways into the same inventory, each with its own controls and vocabulary.

**Decision.** Merge home and search into **Explore**: a results screen that starts with sensible defaults and becomes a precise search as the user adds intent. Airbnb's home is a results grid; Zillow opens on the map. Neither makes you visit a landing page first.

- With no input: "Places available now in Nyeri", ranked by freshness, quality and popularity.
- With a query or filters: the same screen, narrowed, with an honest count.
- For a returning visitor: the same screen, starting from their last search, with "Continue" and "Recently viewed" strips above the results.

**Why.** It removes a step for every journey, makes discovery and search one mental model, and means improvements to ranking help everyone.

**Trade-off.** Less room for editorial "landing page" content. Acceptable: neighbourhood and landmark pages carry SEO and editorial content (§4).

---

## 3. Information architecture

```
Explore (/ and /{market})                      Property (/p/{slug})
  ├─ Search bar: one box + Monthly | Nightly       ├─ Media (video first if present)
  ├─ Filter row: Area · Price · Type · More        ├─ Price and move-in cost
  ├─ [Returning] Continue · Recently viewed        ├─ Availability and trust facts
  ├─ Results (list; + map on desktop)              ├─ Location with map
  └─ Show more                                     ├─ Units, what's included, details
                                                   ├─ Sticky: WhatsApp · Call · Save · Share
Saved (/saved)                                     └─ Similar nearby
  ├─ Saved places (status updates)
  ├─ Compare (2–3)                              Place pages (/{market}/{place})
  └─ Alerts (saved searches)                    Landmark pages (/{market}/near/{landmark})
                                                 Lister profile (/l/{slug})
Menu: Saved · Alerts · List your property · Help & safety · Sign in
```

### 3.1 Navigation

- **Top bar (all sizes):** Rumia wordmark (→ Explore) · search pill (on non-Explore pages) · Saved (heart with count) · Menu.
- **No bottom tab bar.** With only Explore and Saved as destinations, a tab bar costs ~56 px of a small screen on every page and collides with the property page's sticky action bar. Revisit if a third frequent destination appears.
- **Menu:** Saved, Alerts, List your property, Help & safety, Sign in / account. That's the whole site for seekers.
- Breadcrumb-style context on property pages: "← Back to results" when the user came from Explore (keeps scroll position); "More places in Kamakwa" when they arrived from a shared link.

### 3.2 Vocabulary

| Concept | Word shown | Not |
|---|---|---|
| Monthly vs nightly | **Rent monthly** · **Stay a few nights** | RumiaBnB, short-stay, BnB |
| Property types | Hostel · Single room · Bedsitter · Apartment · House | Room type enums |
| Saved | Saved | Wishlist |
| Neighbourhood | Area name (Kamakwa, Boma, Near Gate B) | Zone |
| The person you contact | The name and role the lister gives ("Mary, caretaker") | Agent vs hostel owner |
| Verification | The specific fact ("Visited by Rumia on 12 Sep") | "Verified" alone |

### 3.3 URLs

As in `../05-experience.md` §1.2: `/p/{slug}` for properties; `/{market}`, `/{market}/{place}`, `/{market}/near/{landmark}` for landings; lowercase, hyphenated, no spaces; all old URLs 301.

---

## 4. Screen inventory

Status: **Keep** (as is) · **Simplify** (same purpose, less) · **Redesign** (same purpose, new design) · **Rebuild** (new structure and code) · **Remove** · **New**.

| Screen / route today | Decision | Becomes |
|---|---|---|
| Home `/` | **Rebuild** | Explore |
| `/hostels` | **Remove** (merge) | Explore with filters; 301 |
| `/hostels/[county]/[area]` | **Rebuild** | Place page `/{market}/{place}` |
| `/hostels/[county]/[area]/[slug]` | **Rebuild** | Property `/p/{slug}` |
| `/listing/[id]` | **Remove** | 301 to `/p/{slug}` |
| `/bnb` | **Remove** (merge) | Explore in "Stay a few nights" mode |
| `/bnb/[id]` | **Remove** (merge) | Property `/p/{slug}` |
| `/browse` | **Remove** | Already a redirect |
| `/videos` | **Remove** for now | A "Has video" filter + full-screen walkthrough viewer inside the property page. Revisit a Watch mode when ≥ 40% of live places have video |
| `/compare` | **Rebuild** (smaller) | Compare inside Saved, 2–3 places |
| `/saved` | **Rebuild** | Saved (device-first; sync on sign-in) with Alerts |
| `/auth/login` | **Rebuild** | A sign-in sheet opened in context, returning to the action; a fallback page for direct links |
| `/account` (tabs) | **Simplify** | Account settings only (name, phone, alerts channel, delete data) |
| Profile completion modal | **Remove** | Phone asked only when choosing WhatsApp alerts |
| `/book-tour`, `/account/book-tour` | **Remove** from the public path | If Rumia Assist continues: one "Get help finding a place" page linked from Help and from empty states |
| `find-me-a-hostel` (account tab) | **Remove** | Same as above |
| `/verify`, `/verify/records`, `/verify/report` | **Simplify** to one page | "Check a listing or agent" (`/check`): paste a phone number or link, see what Rumia knows; report |
| `/agents`, `/agents/[slug]`, `/agent/[id]` | **Rebuild** | Lister profile `/l/{slug}`: who they are, verification facts, their places |
| `/policy`, `/terms` | **Keep** | Linked from footer and sign-in |
| `/offline` | **Redesign** | Shows saved and recently viewed places available offline |
| 404 `not-found` | **Simplify** | Keep focus handling; add search and "places in Nyeri" link; drop animation |
| Error `error.tsx` | **Redesign** | Plain message, retry, keeps the user's place |
| — | **New** | Landmark pages `/{market}/near/{landmark}` |
| — | **New** | Alerts (saved searches) management |
| — | **New** | Help & safety page (how Rumia verifies, how to avoid deposit scams, how to report) |
| — | **New** | "No longer available" state for let/paused properties (not a 404) |
| — | **New** | "List your property" entry page for listers (bridges to the lister workspace) |

Public screens after the rebuild: **Explore, Property, Saved, Place, Landmark, Lister profile, Check, Help & safety, List your property, Account, Sign-in, legal, offline, 404/error.** Of these, seekers need to learn three: Explore, Property, Saved.
