# 04 · Operating Model, Roles, Permissions and Workflows

Covers: operational model, roles and permissions, workflow architecture, the internal interfaces those require.

Method: define what the business must keep true, then the responsibilities that keep it true, then who holds them, then the screens they need. Dashboards come last.

---

## 1. What the operation must keep true

1. **Supply is real.** Every live listing is a real property, offered by someone entitled to offer it, at the stated price.
2. **Supply is current.** Live listings were confirmed available recently. Let units disappear quickly.
3. **Supply is dense enough** in the areas seekers want, at the prices they can pay.
4. **Bad actors are removed fast.** Scams, bait listings and abusive listers.
5. **Money owed is correct.** Whatever the revenue model, the ledger reflects real outcomes.

The current model (Admin → Manager → Agent) is organised around **who may edit what** (campus scope). It has nothing that maintains 2, little for 4, and 5 is driven by clicks. The restructure organises around **work queues that maintain these five truths**.

---

## 2. Current model, assessed

| Current element | What it does | Verdict |
|---|---|---|
| Admin | Everything | **Keep**, smaller: platform configuration, staff, money, policy |
| Manager (campus/region scope) | Branding, zones, tour prices, agent approvals, listing edits, requests, announcements | **Replace** with Market lead. Branding and per-campus hero text are configuration, not a job. Approvals become a verification queue |
| Agent (approved via application with ID number and "relationship to hostel") | Creates listings, gets click commissions | **Split** into Lister (anyone with supply) and Scout (Rumia's field contributors) |
| `is_owner`, `is_support`, `is_founder`, `is_featured` flags on agents | Mixed: identity, marketing, team page | **Remove** as roles. `featured` becomes a curation decision on listings; team page is content |
| Student | Seeker with a required campus | **Replace** with Seeker (optional account, no campus requirement) |
| Agent applications | Gate before anyone can list | **Replace** with open lister signup + contact verification + first-listing review |
| Transfers between agents | Moves a listing to another agent | **Replace** with membership changes in a lister organisation |
| Announcements per campus | Banner messages | **Postpone**. A single site banner owned by admin covers it |
| Campus settings (hero, colour, WhatsApp, fees) | Per-campus landing customisation | **Move** to market configuration, edited rarely by admin |

---

## 3. Recommended structure

```
                         Admin (platform)
                              │
         ┌────────────────────┼─────────────────────┐
     Market: Nyeri       Market: (next)         Market: …
         │
   Market lead ──► owns supply truth + density in the market
         │
   Reviewers (optional, per volume) ──► clear queues
   Scouts ──► bring supply, paid per listing that goes live and stays fresh
         │
   Lister organisations (owners, caretakers, managers, independent agents)
         │
   Properties → units → offers
```

### 3.1 Identity vs capability

**[REC]** A user is one identity. What they can do comes from **memberships**:

- `org_membership(user, lister_org, role ∈ {owner, manager, agent})`: acting for a lister organisation.
- `staff_assignment(user, market | *, role ∈ {admin, market_lead, reviewer, scout})`: acting for Rumia.

Everyone else is a seeker. One person can be a seeker, a member of two lister orgs and a scout at the same time without role conflicts. This removes the `profiles.role` single-value field, which forces today's "promote to manager, downgrade to agent" dance (`manager/service.py:446-461`).

### 3.2 Lister organisations

**Problem.** Today a listing has exactly one agent. Real supply has an owner, often a caretaker on site, sometimes a property manager and one or more agents. "Transfers" exist because ownership is modelled as one person.

**Recommendation.** Properties belong to a **lister organisation** (can be a single person). Members have roles: `owner` (full control, can add members), `manager` (edit, respond), `agent` (create and edit listings they're assigned). Inquiries route to whoever the org designates as the contact for that property.

**Trade-off.** One more table and an invite flow. Worth it: it also handles owners claiming listings scouts created (§5.2).

### 3.3 Roles and permissions

Permissions are named, checked in the backend, and grouped into roles. Scope is market or org.

| Permission | Seeker | Lister agent | Lister manager | Lister owner | Scout | Reviewer | Market lead | Admin |
|---|---|---|---|---|---|---|---|---|
| Browse, contact, save, alerts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report a listing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create draft listing | | org | org | org | market (on behalf) | | market | all |
| Edit listing content | | assigned | org | org | own drafts | | market | all |
| Confirm availability / mark let | | assigned | org | org | | | market | all |
| Submit for review | | org | org | org | ✓ | | | |
| Approve / reject publication | | | | | | market | market | all |
| Pause / remove live listing | | | org (own) | org (own) | | market | market | all |
| Record verification evidence (visit, docs) | | | | | market | market | market | all |
| Resolve reports | | | | | | market | market | all |
| Manage org members | | | | ✓ | | | | all |
| Suspend lister org or user | | | | | | | market | all |
| Assign staff, manage markets, edit policy | | | | | | | | ✓ |
| View/adjust ledger, payouts | | own org | own org | own org | own | | market (read) | ✓ |

**[REC]** Implement as `require(permission, scope)` in FastAPI dependencies, with the scope resolved from the resource (listing → org, market). Replaces `require_roles(...)` string checks and the "admin passes everything" shortcut, and makes every authorisation decision testable.

---

## 4. Listing lifecycle

**[FACT]** Today: `is_active` boolean, `is_full` boolean. No review state, no freshness.

**[REC]** An explicit state machine on the listing (offer):

```
draft ──submit──► in_review ──approve──► live ──(no confirmation 14d)──► stale ──(no confirmation 7 more days)──► paused
  ▲                  │                    │  ▲                             │
  └────reject────────┘                    │  └──────confirm available──────┘
                                          ├──mark let──► let ──(relist)──► live (via confirm)
                                          ├──pause──► paused ──resume (confirm)──► live
                                          └──remove (moderation)──► removed
archived: terminal, from any non-live state after 90 days, or on request
```

Rules:

- **First listing from a new lister org goes to review.** Later listings from an org in good standing publish directly and are spot-checked (sampling rate set by policy). This keeps review volume proportional to risk.
- **Freshness is time-based and automatic.** `last_confirmed_at` drives `live → stale → paused`. Stale listings rank lower and show "Not confirmed recently"; paused ones are hidden from search but their page still resolves (shared links don't break; they show "No longer available. Here are similar places nearby").
- **Price changes** by a lister are applied immediately but logged; large jumps (e.g. > 30%) enter a review queue.
- **Every transition is an event** with actor and reason (audit log + analytics).

---

## 5. Core workflows

### 5.1 Lister onboarding (replaces agent applications)

1. Sign in (Google today; phone OTP later, `06-architecture.md` §6).
2. Verify a phone number (OTP via SMS or WhatsApp). This is the contact seekers will reach.
3. Create or join an org (owner invites caretaker/agent by phone).
4. Create first listing (media first) → `in_review`.
5. Reviewer checks: media plausibility, duplicate detection (same photos/phone/location as another listing), price sanity, contact verified. Approve, request changes, or reject with reason.

No ID numbers collected up front. Collect stronger evidence only when a trust level needs it (§7).

### 5.2 Scout-created supply and owner claims

The original model (agents find and post hostels) is a real supply engine in a town like Nyeri, where owners are not online. Keep it, pointed at the right incentive.

1. Scout visits the property, captures media and details on the phone, records the owner's phone.
2. Listing created under a **provisional org** for that owner; scout recorded as `sourced_by`.
3. Rumia sends the owner a WhatsApp/SMS: "Your property is on Rumia: [link]. Reply YES to confirm details are correct." Confirmation marks the contact verified.
4. The owner can later **claim** the org (verify the same phone) and manage it themselves.
5. The scout is paid per listing that **goes live and is still fresh after N days** (e.g. 30), not per click.

### 5.3 Freshness reconfirmation

1. Daily job selects listings whose `last_confirmed_at` is older than the market's interval (e.g. 10 days).
2. Sends the designated contact a message with one-tap actions: *Still available* · *Let / full* · *Update price*.
3. Response updates the listing; no response → `stale` at 14 days, `paused` at 21.
4. Repeated non-response from an org → its market lead gets a queue item ("Org X: 6 listings stale, contact owner").

This replaces "inactive agents" handling. Inactivity shows up as staleness, which is what actually matters, and is handled per listing rather than by suspending people.

### 5.4 Reports and moderation

1. Anyone can report from the property page: *Not available* · *Wrong price* · *Fake / scam* · *Wrong location* · *Other*.
2. "Not available" from 2+ distinct reporters → listing moves to `stale` immediately and a reconfirmation is sent.
3. "Fake / scam" → `in_review` hold if the reporter is a known user or 2+ reports; queue item with priority.
4. Reviewer resolves: dismiss, edit, remove listing, suspend org. Reporter gets an outcome message where possible.
5. SLA per priority (e.g. scam reports within 24 h).

### 5.5 Inquiry routing (replaces "owner vs Rumia agent")

1. Seeker taps *WhatsApp* or *Call*.
2. Rumia generates a reference code (e.g. `R7K2`) bound to listing, session, channel and time, logs `contact_initiated`, and opens WhatsApp with a pre-filled message: "Hi, I found *Kamakwa Heights* (1-bedroom, KSh 14,000) on Rumia, ref R7K2. Is it still available?"
3. The message goes to the org's designated contact for that property. If the listing is `let` or `paused`, the page offers similar listings instead of a contact.
4. If the seeker has an account, the inquiry appears in their history; otherwise it is attached to the anonymous device id.

Rumia stops making the user choose a channel or agent. If the business keeps a paid "help me find a place" service, it is offered as its own, clearly priced option, not inside a property's contact flow (§6).

### 5.6 Verification visit

1. Market lead or scout schedules visits from a queue (prioritised by traffic and lack of verification).
2. On site: geotagged photos, check unit types and prices, confirm contact person.
3. Records a `verification_evidence` item; listing earns "Visited by Rumia on {date}". Evidence expires (e.g. 12 months) and is re-queued.

---

## 6. Money and services

**[FACT]** Today: click-based commissions (10%, min KSh 1,000), consultation fees, hostel-finding fees (KSh 100 default), tour fees by zone. All collected manually.

**[OBS]** Whatever Rumia charges for, the ledger must be driven by outcomes that both sides confirm. A click is not one.

**[REC]**, conditional on your revenue decision (open question Q1):

- **Separate attribution from money.** Inquiries (with reference codes) are attribution data. Money is recorded only on **confirmed outcomes**: a move-in confirmed by the lister (and optionally the seeker), a paid listing upgrade, or a paid service delivered.
- **Consolidate seeker-paid services** ("find me a hostel", tours, consultation) into one "Rumia Assist" request with a single clear price, handled by the market team from a queue. Or stop them, if they don't pay for the ops time they consume. Production data on volumes would settle this.
- **No payment integration yet.** When volume justifies it, M-Pesa (Daraja STK push) for listing upgrades or Assist fees is the natural first integration.
- Migrate existing commission rows as historical; stop accruing on clicks the day the reference-code flow ships.

---

## 7. Trust levels

Explicit, shown publicly in plain language, each backed by stored evidence.

| Level | Evidence | Public wording |
|---|---|---|
| 0 | Lister signed up | (no badge) |
| 1 | Lister phone verified by OTP | "Contact verified" |
| 2 | Availability confirmed ≤ 14 days | "Available, confirmed N days ago" |
| 3 | Rumia visit ≤ 12 months, or official register match | "Visited by Rumia on {date}" / "In DeKUT's official register" |
| 4 | Ownership documented (optional, premium supply) | "Owner verified by Rumia" |

DeKUT's official register (`dekut_official_hostels`, `verification.py`) becomes one **evidence source** among others, generalised as `external_registry` so other institutions' registers can be added.

---

## 8. Interfaces this requires

Only surfaces with an owner and a decision.

| Surface | Who | Decisions it supports | Replaces |
|---|---|---|---|
| **My Rumia** (seeker) | Seekers | What did I save? What changed? What did I contact? Manage alerts | `/account` tabs, `/saved` |
| **Lister workspace** (mobile-first) | Lister org members, scouts | What needs my attention (stale, changes requested, new inquiries)? Create/update listings. Confirm availability | 13 `/dashboard` pages incl. separate BnB section |
| **Ops console** | Reviewers, market leads, admins | What's in my queues? Approve/reject, resolve reports, schedule visits, act on stale orgs. Is my market healthy? | 11 `/manager` + most of 22 `/admin` pages |
| **Admin settings** (part of ops console, permission-gated) | Admins | Markets, places, landmarks, staff, policy values, ledger | Remaining admin pages |

### 8.1 Ops console layout

- **Home = queues, not charts.** Review queue, reports, stale orgs, verification visits, price-change flags, each with counts, age of oldest item, and SLA status.
- **Market health** (one page per market): fresh listings by neighbourhood and price band vs demand (searches/intents in that band), response rates, scam reports. This tells the market lead where to send scouts.
- **Search everything**: a single search for listing, org, user, phone, reference code.
- **Entity pages**: listing, org, user, each with timeline (events and actions) and available actions.

Charts and analytics beyond market health live in PostHog/Metabase, not in custom screens.

### 8.2 What is deliberately not built

- Per-agent "earnings" and "analytics" dashboards with charts. A lister needs one line per listing (views, contacts this week) and a ledger list.
- Campus branding editors, per-campus hero text, announcements management.
- Separate admin and manager apps.
- Leaderboards or gamification for scouts until there are enough scouts to compare.

---

## 9. Automation vs human judgement

| Automate | Escalate to a human |
|---|---|
| Freshness reminders, stale/paused transitions | Scam reports, disputed outcomes |
| Duplicate detection (same phone, same images, nearby coordinates + similar title) → flag | Deciding whether a flagged duplicate is fraud |
| Price sanity (outside market band for type) → flag | Approving a first listing from a new org |
| Auto-publish for orgs in good standing, with sampling | Removing a listing that has active inquiries |
| Derived fields: tier, distance to landmarks, quality score | Changing a trust level above 2 |
| Demotion in ranking for slow responders | Suspending an org |
