# 02 · Product Vision, Principles and Strategy

Covers: product vision and principles, challenges to the brief, geographic scaling strategy.

---

## 1. What Rumia should become

> **Rumia is the place you trust to find somewhere to live or stay in a Kenyan town: every property is real, current and shown honestly, and the product gets you to the right few faster each time you use it.**

Three commitments sit under that sentence, in priority order:

1. **True.** If Rumia shows it, it exists, the price is real, and it was confirmed available recently. This is the product. Everything else is presentation.
2. **Shown well.** Each property has one excellent, shareable page (video, photos, real costs, location relative to things that matter) that owners are proud to send around.
3. **Fit to you.** Rumia remembers what you're looking for and narrows the field for you, openly and under your control.

The order matters. Personalization on top of stale or fake listings makes the problem worse: it gets users to bad listings faster.

---

## 2. Challenges to the brief

You asked for disagreement where warranted. These are the places I think the brief is wrong or premature.

### 2.1 "Spotify / YouTube / TikTok for property" is the wrong model. Use it for inspiration only.

**Problem.** Those products work because consumption is daily, items are cheap to try (a song costs 3 minutes), the catalogue is enormous, and behaviour is abundant. Housing has the opposite shape:

| | Spotify / TikTok | Rumia |
|---|---|---|
| Frequency | Daily, for years | 1 to 3 intense weeks, once or twice a year (students: per semester or year) |
| Cost of a wrong item | Seconds | A visit, a deposit, a year in the wrong place |
| Catalogue in the user's reach | Millions | Hundreds in Nyeri; a user's budget and area narrow it to dozens |
| Behavioural data per user | Thousands of signals | Tens per search episode |
| Item lifetime | Permanent | Weeks (a unit is let, then gone) |

**Recommendation.** Treat Rumia as an **episodic, high-consideration search** product that borrows two things from feed products: low-effort browsing for the "just looking" phase, and memory across sessions. The real personalization primitive is **intent captured once, remembered, and turned into alerts** ("3 new 1-bedrooms under KSh 15,000 near Kamakwa since Tuesday"). That beats an inferred taste profile in this domain because the user's need is explicit, short-lived and specific.

**Consequence.** No ML recommender in the first year. Rule-based ranking with logged features, so a learned model can be trained later if volume justifies it (`08-intelligence.md`).

**Revision after review: keep the goal, change the job.** The original vision was never "copy Spotify". It was that *Rumia should understand the user instead of making the user configure the search again and again.* That goal stays, as **Rumia Brain**: a matching system, not an entertainment feed.

```
Intent → Context → Preferences → Ranking → Recommendations → Alerts
```

Its signature output is an alert like "You were looking for a 2-bedroom in Nyeri around KSh 30k. Three new verified listings match." Details: `08-intelligence.md` §0 and `ux/06-personalization-web.md`.

### 2.2 "Premium" is not a category

**Problem.** The brief lists premium homes alongside hostels and apartments. Premium is a price and quality position, not a type of property. A premium 2-bedroom is still an apartment.

**Recommendation.** Model premium as a **derived tier** (price percentile within the market and category, plus quality signals like verified, professional media, amenities) and as **curated collections**. Do not add a `premium` property type.

**Consequence.** Premium supply can appear without a separate code path, and the premium label can't be bought by setting a field.

### 2.3 Short stays should not get a booking engine yet

**Problem.** Long-term rentals (monthly) and short stays (nightly) are different transactions. A nightly stay needs availability by date, instant confidence, and payment protection. Without those, Rumia's short stays compete with Airbnb and Booking.com on a weaker offer.

**Recommendation.** One catalog: short stays are a `price_period = night` offer on a property, discoverable in the same search. Keep the contact via WhatsApp. **No calendar, booking or payment until Nyeri long-term rentals have product-market fit.** Remove the separate `/bnb` API, forms and pages by folding them in.

**Consequence.** Short stays stay a secondary category. That is correct for Nyeri, where the larger, under-served need is long-term rentals for students and young workers.

### 2.4 A TikTok-style video feed should not be the home screen

**Problem.** It only works with a lot of good video, and today video is an optional YouTube link. Full-screen autoplay also costs Kenyan users real money on mobile data.

**Recommendation.** Make video **the first thing on a property page** and support it natively (`09-media-and-content.md`). Keep a "Watch" surface as a secondary way to browse. Revisit a video-first home once most live listings in a market have video.

### 2.5 The contact gate is a strategic problem, not a UX detail

**Problem.** Rumia's growth loop is links shared on WhatsApp, Instagram and TikTok. Those open in in-app browsers. Google refuses OAuth there. Contact requires Google sign-in. The loop is cut at the point of value.

**Recommendation.** **Seekers never need an account to contact a property.** Attribution moves from "who is signed in" to a short reference code carried in the pre-filled WhatsApp message. Accounts become optional and earn their place by offering saved searches, alerts and history (`05-experience.md` §4).

**Trade-off.** Less identity data per contact. Accepted; the current approach collects identity by blocking the action, and 44% of profiles are incomplete anyway.

### 2.6 Don't build a nationwide marketplace

The brief already says this; I agree, and add a rule: **a town opens publicly only when it passes a density threshold** (§4 below). Before that, it exists only as a waitlist.

### 2.7 Your listed tech stack doesn't match the repo

Vercel, Redis, TanStack Query and Axios are listed as current direction. The repo runs on an Oracle VM with nginx, has no Redis, never calls TanStack Query, and uses Axios alongside fetch. This doesn't change the recommendations, but decisions should be made against what actually runs (`06-architecture.md`).

---

## 3. Product principles

Use these to settle design and scope arguments. Each is phrased so it can rule something out.

1. **Value before identity.** Never ask who someone is before showing them something worth staying for. Ask for data at the moment it delivers a benefit the user can see ("Get alerts → your phone").
2. **Truth over volume.** A smaller set of confirmed listings beats a larger stale one. Stale listings are demoted automatically, not by someone noticing.
3. **One page per property, shareable everywhere.** The property page is the product's unit of distribution. It must load fast in an in-app browser on 3G and make sense without context.
4. **Show the real cost.** Monthly rent plus deposit plus what's included (water, electricity, Wi-Fi). Hidden costs are the most common reason renters feel deceived.
5. **Explain every inference.** When Rumia ranks or filters on the user's behalf, it shows why ("Because you're looking near DeKUT under 12k") and lets them change it.
6. **Complexity lives in the system.** Listers answer simple questions; the system derives category, tier, distance and quality. Ops staff work queues; the system decides what goes in them.
7. **Every internal screen maps to a responsibility.** No dashboard without an owner and a decision it supports.
8. **Design for the median phone and data plan.** Low-end Android, intermittent 3G/4G, data cost-conscious users.

---

## 4. Geographic scaling strategy

**[FACT]** Today: `regions` (47 counties), `campuses` (with branding fields required), `campus_zones` (areas with a tour price), free-text `county` and `area` on listings, and DeKUT defaults throughout (`01-current-state.md` D8).

### 4.1 Model

- **Market**: an operating unit Rumia chooses to serve (e.g. "Nyeri"). Has a status (`hidden` → `pilot` → `live` → `paused`), a geographic boundary, an ops team, and defaults (currency formatting, anchors to show). This is what a manager scope becomes.
- **Place**: a geographic hierarchy for addressing and SEO: county → town → neighbourhood (e.g. Nyeri County → Nyeri Town → Kamakwa). Places are data, not code.
- **Landmark**: a point people orient by: a university campus (DeKUT), a hospital, the CBD, a stage. Distances are computed from coordinates, not typed by agents. A campus becomes a landmark with a `kind = university`, optionally with student features (official registry, school-email verification).

Details in `07-domain-and-data.md` §3.

### 4.2 Market entry rule

A market goes from `pilot` to `live` only when it meets a threshold you set. Suggested starting values, to be tuned:

| Signal | Threshold (suggested) |
|---|---|
| Fresh listings (confirmed available ≤ 14 days) | ≥ 150 |
| Neighbourhoods with ≥ 10 fresh listings | ≥ 5 |
| Listings with verified contact | ≥ 90% |
| Median lister response to reconfirmation | ≤ 48 h |
| An accountable market lead | Named |

Before that, the market's pages say "Coming soon" and collect waitlist intents (which also tell you where to go next).

### 4.3 Sequence

1. **Nyeri**: students (DeKUT first, then other Nyeri institutions you choose to serve) and young workers; long-term rentals first.
2. **Next market**: chosen by waitlist demand and supply access, not by map coverage. A university town (e.g. Juja/Thika, Njoro, Kakamega, Eldoret) reuses the student wedge; a city (Nairobi) does not and should not be next.

**[ASSUMPTION]** The existing "coming soon" campuses list reflects real demand. Confirm before choosing market 2.

---

## 5. What success looks like

| Metric | Definition | Why |
|---|---|---|
| **North star: Qualified contacts** | Seekers per week who contact a fresh (confirmed ≤ 14 d) listing | Captures demand and supply truth in one number |
| Outcome | Confirmed move-ins (lister or seeker confirms) | The real result; sampled at first |
| Supply health | % of live listings confirmed available ≤ 14 days | The truth commitment |
| Lister responsiveness | Median time to answer reconfirmation | Leading indicator of freshness |
| Distribution loop | Share of sessions arriving on a property page from a shared link, and properties visited per such session | Tests the content-loop thesis |
| Seeker effort | Median time and properties viewed from first visit to first contact | Measures "radically simpler" |

Vanity metrics to stop reporting: total registered users, total listings (including stale), all-time view counts.
