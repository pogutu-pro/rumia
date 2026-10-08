# UX 06 · Personalization on the Web ("Rumia Brain")

Covers deliverable 11, and incorporates your challenge to the first plan.

---

## 1. Rumia Brain: what it is for

You're right that the original vision was never "copy Spotify". It was: **Rumia should understand the user instead of making the user configure the search again and again.** The first plan rejected the feed analogy but under-sold that goal. It stays, with a defined job:

> **Rumia Brain matches people to places. It is not an entertainment feed.**

The pipeline:

```
Intent → Context → Preferences → Ranking → Recommendations → Alerts
```

| Stage | What it is | Example |
|---|---|---|
| **Intent** | What the user is looking for now, stated or clearly implied | "2-bedroom apartment in Nyeri around KSh 30k" |
| **Context** | Situation at this moment: mode (monthly/nightly), market, device, where they arrived from, time of year (semester start) | Arrived from a shared link to a 2-bedroom in Ruringu |
| **Preferences** | What tends to matter to this person, learned slowly and always editable | Prefers ensuite, saves places with parking, never opens hostels |
| **Ranking** | Ordering of real, available places using the above plus freshness, trust and quality | `../08-intelligence.md` §4 |
| **Recommendations** | Places surfaced without a query: Continue, Similar nearby, Fresh matches | "Similar to the 2 you saved" |
| **Alerts** | Telling the user when something new fits | "3 new verified 2-bedrooms around KSh 30k in Nyeri since Tuesday" |

The alert in your example is the most valuable output of the whole system, and it doesn't require a feed, an app, or much data. It requires remembering intent and knowing when supply changes.

**Changes made to the main plan because of this:** `../02-product-vision.md` §2.1 and `../08-intelligence.md` now name Rumia Brain and this pipeline explicitly.

---

## 2. What Rumia can realistically know at each stage

The new-visitor experience must be excellent with **zero** knowledge. Each later stage adds something only when it has a real signal.

| Stage | What Rumia knows | Where it's stored | What changes for the user |
|---|---|---|---|
| **Anonymous, first page view** | Entry URL (which property/place), referrer kind (WhatsApp, Google…), in-app browser or not, coarse market from URL (not IP-tracking), device class, `Save-Data` | Request only | Shared-link landing behaviour; the market shown; data-light media. **Nothing personal** |
| **First-time visitor, in session** | Query and filters they set, mode, places opened, saves, gallery/video engagement, contacts | Session (memory + `sessionStorage`), events with `device_id` | Results reflect their filters (of course); "Similar nearby" on property pages leans toward what they opened; a reason chip when inferred ("Showing bedsitters like the ones you opened · change") |
| **Returning anonymous visitor** (same browser) | Last search (query + filters + mode), recently viewed (last 20), saved places, contacts made, dismissed items | First-party `localStorage` + server by `device_id` | Explore opens on "Continue: Bedsitter · Kamakwa · ≤ 8k · 3 new"; Recently viewed; saved status changes ("Price dropped") |
| **Signed-in user** | Everything above, synced across devices; alert preferences and channel; phone if they chose WhatsApp alerts | Account | Same experience on any device; alerts by WhatsApp/email; history of contacts with outcome prompts |
| **Highly engaged user** (several sessions, saves and contacts in one search episode) | A stable **active search profile**: typical budget band, places, unit kinds, must-haves; long-term preferences across episodes | Account (or device) | Ranking tilts toward their profile when they haven't set filters; "Fresh matches for you" strip; alert suggestions ("You keep looking at Ruringu too. Add it to your alert?") |

### What Rumia will not do

- Infer or use sensitive traits (gender, religion, income, ethnicity). Gender policy is a property fact users can filter on, never something inferred about them.
- Use IP geolocation or device location without the user tapping "Near me".
- Reference behaviour in messages ("We saw you looking at…"). Alerts reference only what the user explicitly saved.
- Personalise before there's a signal. A new visitor sees market-level ranking, not guesses.
- Show "For you" as a label. Personalised sections are named by what they are: "Continue your search", "Similar to places you saved", "New matches for your alert".

---

## 3. Rules for precedence

1. **What the user just did beats everything.** Filters and query are hard constraints.
2. **This session beats history.** If a past hostel seeker now opens 2-bedroom apartments, the session wins without asking.
3. **History only breaks ties** when the user has given no filters.
4. **One-off behaviour is ignored** until it repeats (a single look at a premium house doesn't change their results).
5. **A long gap (21+ days) starts a new episode.** "Continue" offers the old search but doesn't silently apply it.

---

## 4. Controls the user sees

- Every inferred adjustment appears as a chip with **Change** and **×**.
- "Recently viewed" and "Continue" each have a remove control.
- Settings → "Personalised results" on/off; "Clear my history on this device"; "Delete my data" for accounts.
- Privacy notice in plain language, linked from the footer and the settings toggle (consent model to confirm with a data protection adviser, `../06-architecture.md` §6).

---

## 5. Making the first visit excellent without personalization

Because most visitors are anonymous and arrive once:

- **Market-level ranking does the work**: fresh, verified, well-photographed places with clear prices first.
- **Good defaults**: monthly mode, the market's whole inventory, sorted by Best match, not a guessed category.
- **Starting points** derived from data rather than from the user: four tappable suggestions under the search box, generated from what's actually available and commonly searched ("Bedsitters under 8k", "Near DeKUT", "1–2 bedroom apartments", "This weekend"). Tapping one sets real filters the user can see and change.
- **Shared-link arrivals** get the property itself plus "More in {area}", which is the most relevant possible context.

---

## 6. Phasing (links to the main roadmap)

| Phase | Brain capability |
|---|---|
| With the new Explore (UX phase 3) | Device memory: last search, recently viewed, device saves; starting points; market-level ranking with reason chips |
| With Saved/Alerts | Saved searches → WhatsApp/email alerts; status changes on saved places |
| After ~3 months of events | Inferred intent chips; "Similar to places you saved"; active search profile tilt |
| When thresholds in `../08-intelligence.md` §5.2 are met | Learned re-ranking |
