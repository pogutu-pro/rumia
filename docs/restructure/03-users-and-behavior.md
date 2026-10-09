# 03 · Users and Behavioural Model

Covers: user and behavioural model, actor taxonomy, the psychological reasons journeys succeed or fail.

Principles referenced are standard ones from HCI and behavioural research. Where a principle is named, the reason it applies is given; where nothing established applies, plain reasoning is used instead.

---

## 1. Actors

Ask of each actor: does it need an account, a limited capability, or nothing?

| Actor | What they want | Account? | Notes |
|---|---|---|---|
| **Seeker** (student, parent, worker, visitor) | The right place, fast, without being cheated | **Optional** | Account unlocks saved searches, alerts, history. Never required to browse or contact |
| Parent / sponsor | Reassurance a place is safe and real | No | Arrives via a shared link from the student. Trust signals must work for them without context |
| **Lister** (owner, caretaker, property manager, independent agent) | Fill vacancies with the least effort | Yes | One account type with a role inside a **lister organisation**. Replaces separate "agent" and "owner" concepts |
| **Scout** (Rumia field contributor) | Earn by bringing real supply onto Rumia | Yes | A capability, not a separate user type. Creates listings on behalf of owners, who can later claim them |
| **Market lead** | Supply density and truth in one market | Yes (staff) | Replaces "manager". Responsible for outcomes, not for campus branding |
| **Reviewer / moderator** | Clear the queues correctly | Yes (staff) | Can be the market lead at small scale; separate when volume demands |
| **Admin** | Run the platform: markets, staff, money, policy | Yes (staff) | Small number of people |
| Support | Answer seekers and listers | Folded into ops | Not a separate role until there is a support team |
| Content contributor (photographer, videographer) | Paid for media | No account | Media is uploaded by the lister or scout who commissioned it |

**[REC]** Five capabilities instead of today's `student | agent | manager | admin` plus flags (`is_owner`, `is_support`, `is_founder`, `is_featured`, `super_admin` remnants). Detail in `04-operating-model.md`.

---

## 2. Seeker modes

A seeker moves through recognisable modes. The product should notice which one they're in and behave accordingly.

| Mode | Signals | What helps | What hurts |
|---|---|---|---|
| **Arriving via a link** | Entry on a property page, referrer is WhatsApp/IG/TikTok, in-app browser | Fast page, the property itself, one clear action, then "more like this nearby" | Interstitials, sign-in walls, cookie banners, a home page they didn't ask for |
| **Exploring** ("just looking") | No filters, browsing, short dwell | Visual browsing, a few good rails, area entry points | Being asked to define criteria up front |
| **Searching** | Filters set or typed intent, repeated views in a price band/area | Precise results, honest counts, sticky filters, compare | Irrelevant "recommended" items mixed in |
| **Deciding** | Repeated visits to 2–5 properties, saves, gallery depth, map | Compare, real total cost, availability recency, contact | New options pushed at them; anything that resets their shortlist |
| **Contacted / visiting** | Contact initiated | Directions, what to ask/check, reminders | Silence; no way to record outcome |
| **Settled** | Long gap after contacts | Leave them alone; optional "did you find a place?" | Promotional notifications |

**[OBS]** Today's product treats every visitor as an exploring student near DeKUT. Arrivers get a full site header and a sign-in wall at contact; deciders get no comparison of total cost; settled users get nothing (and no one learns the outcome).

---

## 3. Why journeys fail: diagnosis

### 3.1 Why a new user abandons signup

Evidence: 44% of student profiles incomplete; sign-in failures on `www` (fixed); in-app browser block (unfixed).

| Cause | Mechanism |
|---|---|
| Sign-in demanded before value | Asking for commitment before the user has seen anything worth committing to produces reactance and exits. The current flow gates the most valuable action (contact) behind it |
| Technical block in in-app browsers | Google shows an error the user can't interpret; they assume Rumia is broken |
| Context loss across the OAuth redirect | Each redirect is a chance to lose the thread. The `sessionStorage` resume exists but is fragile across in-app → system browser hops |
| Irrelevant questions | "Which campus?" is meaningless to a worker or parent. An irrelevant question signals "this isn't for me" |
| No visible reason to give a phone number | People share phone numbers when they see the return (e.g. "we'll WhatsApp you when it's available") |

**[REC]** Remove sign-in from browse and contact. Ask for a phone only when the user chooses something that needs it (alerts), and say what it will be used for.

### 3.2 Why an agent fails to complete a property submission

Evidence: a single 1,800-line form, hostel-shaped fields required for all types, everything on one page, validation via toast at submit.

| Cause | Mechanism |
|---|---|
| Length visible all at once | A long form signals effort before any progress is felt; people defer it |
| Wrong questions for the property | "Distance from campus" and "gender" for a 2-bedroom flat make the lister invent answers |
| Errors only at the end | Late feedback after effort is discouraging and often lands off-screen on mobile |
| Typing on a phone in the field | Free-text distance, location and description fields are slow on a phone |

**[REC]** Media-first, step-by-step capture with derived fields (`05-experience.md` §6): start with photos and video (the part they already have), then 5–7 short questions dependent on property type, auto-save as draft, and a visible "ready to publish" checklist. A saved incomplete draft creates a pull to finish it, so make drafts visible on return.

### 3.3 Why an owner doesn't maintain their listing

| Cause | Mechanism |
|---|---|
| Maintenance has no trigger | Nothing prompts them when a unit is let. Behaviour needs motivation, ability and a prompt at the same time (Fogg); the prompt is missing |
| High effort to update | Logging in to a dashboard to flip one field is too much effort for the reward |
| No visible benefit | They don't see that fresh listings get more contacts |
| Listings never expire | Nothing bad happens if they ignore it, so they ignore it |

**[REC]** A reconfirmation loop: a WhatsApp or SMS message every 7–14 days, "Is Kamakwa Heights still available? Reply 1 = yes, 2 = let, 3 = change price", with one-tap links. No answer → the listing is demoted, then paused. Show listers "Listings confirmed this week get N× more contacts" once the data supports it.

### 3.4 Why a user distrusts a property

| Cause | Mechanism |
|---|---|
| Stale or bait listings | One bad experience generalises to the whole platform |
| Photos look stock or too polished | Seekers are primed for fraud in Kenyan rentals (fake agents, deposit scams) |
| Unexplained "verified" badge | A badge without meaning is ignored, or worse, seen as marketing |
| Fees appearing late | Fee disclosure at contact time feels like a trap, even when honest |
| Small social-proof numbers | "12 views" can make a place look unpopular; social proof only helps when numbers are meaningful |

**[REC]** Trust signals that are specific and checkable:

- "Available, confirmed 3 days ago by the owner"
- "Visited by Rumia on 12 Sep 2026" (with the visit photos labelled)
- "Contact number verified"
- "Listed in DeKUT's official accommodation register" (where true)
- Short video taken on site
- Total monthly cost shown up front

Drop view counts from public pages until they are large enough to help.

### 3.5 What to show first on a property page

Order by the questions a seeker asks, in the order they ask them:

1. **Is it what I want?** Video or lead photo, type, price per period.
2. **Can I afford it?** Total monthly cost, deposit, what's included.
3. **Is it real and available?** Availability recency, verification.
4. **Where is it, relative to what matters to me?** Neighbourhood, walking time to the user's anchor (campus, CBD, work).
5. **What's it like?** Gallery by room, amenities, rules.
6. **How do I act?** Contact, save, share (sticky on mobile).
7. **What else?** Similar nearby, other units in the same building.

Everything else (reviews, agent profile, view counts, tours) is secondary or removed.

### 3.6 Cognitive load to remove

- The "hostel owner vs Rumia agent" choice at contact: users don't have the information to choose. Rumia should route.
- Five homepage rails (all, apartments, short stays, popular, newest) built from the same pool. Fewer, labelled by user purpose.
- Fee types: commission, consultation fee, finding fee, tour fee. One clear model, stated once.
- Hostel-specific jargon for non-student users ("distance category", "zone").

### 3.7 What creates confidence and enjoyment

- **Recognition over recall.** "Continue your search: 1BR near Kamakwa under 15k" on return, instead of re-entering filters.
- **Clear progress.** Seekers see their shortlist and what's changed since last time; listers see "3 of 5 steps done".
- **Honest counts.** "14 places match" makes the space feel bounded and searchable. An endless feed in a small market feels padded.
- **Visual browsing.** Large media, swipeable galleries, short video. Enjoyable without commitment.

---

## 4. When to ask, when to infer, when to stay out of the way

| Situation | Behaviour |
|---|---|
| First visit, arrived on a property | Stay out of the way. Show the property. After they scroll or return, offer "Looking for something like this? Tell us what you need" |
| First visit, arrived on the home page | Offer intent capture as an optional, 3-tap card: stay type, area/landmark, budget. Skippable, never modal |
| Behaviour clearly implies intent (e.g. 6 opens of 1-bedrooms in Kamakwa at 10–14k) | Infer it, show it as an editable chip: "Showing 1BR · Kamakwa · ≤15k. Change" |
| Behaviour contradicts saved intent | Current behaviour wins for this session. Don't overwrite saved intent silently; offer "Update your search?" |
| Returning user with an active search | Resume it. Highlight new and changed items |
| User idle for 30+ days after contacting | Assume settled. Stop alerts unless they confirm they're still looking |
| Anything sensitive (gender, religion, income) | Never infer. Only use what's explicitly given, and only for filtering they asked for |

**Not creepy** means: every inference is visible, editable and resettable; nothing inferred is used outside Rumia; no notifications reference behaviour the user didn't knowingly perform ("We noticed you looked at…" is out; "3 new places match your search" is in).

---

## 5. New vs returning users

| | New | Returning |
|---|---|---|
| Home | Intent card (optional), popular areas, a small "fresh this week" rail | "Continue your search" with new-since-last-visit, saved properties with status changes |
| Property page | Full context, trust explained | Same, plus "You viewed this 2 days ago; price unchanged" |
| Ranking | Market-level popularity + freshness + quality | Adds intent fit and similarity to saves |
| Prompts | None until meaningful engagement | Alert opt-in after 2nd session with a stable intent |
