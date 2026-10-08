# 12 · Final Recommendation

The decisions this package asks you to approve. Each answer points to the detailed reasoning.

---

### What should Rumia become?

**The trusted way to find somewhere to live or stay in a Kenyan town**, starting with Nyeri. Every property is real, current and shown honestly on one excellent shareable page, and Rumia remembers what you're looking for and tells you when it appears.

Not a nationwide listings portal, not a TikTok for houses, not a booking engine. An **episodic search product with memory**, built on supply that is kept true by an operating loop. (`02` §1–2)

### What should we keep?

- FastAPI modular monolith, async SQLAlchemy, Postgres 17, own auth (refresh-token rotation and reuse detection), commit-before-response sessions.
- Next.js + Tailwind + shadcn/ui; Sentry; PostHog; R2 image variants and blur placeholders.
- Backups and restore drills; CI contract guards.
- The scout model of supply acquisition (renamed and re-incentivised).
- DeKUT official-register verification, generalised as one evidence source.
- One VM + Cloudflare for now.

(`01` §2, `06` §1)

### What should we remove?

- **Sign-in, phone capture, channel choice and fee steps from contact.**
- **Commission accrued per click.**
- The profile completion modal and the required campus on users.
- `profiles.role` single-value roles and the `is_owner`/`is_support`/`is_founder`/`super_admin` flags as authorisation.
- Separate admin and manager consoles, and the 13-page agent dashboard.
- The separate BnB API, forms and pages.
- DeKUT/Nyeri defaults in code; `/hostels/...` URLs.
- Campus branding management, per-campus announcements, transfers, agent applications with ID numbers.
- Supabase remnants; Axios; three.js; extra icon and chart libraries; Cypress; client-side search over 1,000 downloaded listings; the bulk public verification endpoint.

(`04` §2, `05` §7, `06` §2.2)

### What should we rebuild?

- **The domain model**: lister orgs → properties → units, with a lifecycle and freshness; markets → places → landmarks; trust evidence; inquiries with reference codes; outcome-based ledger. Built additively and backfilled. (`07`)
- **Authorisation**: permissions with market and org scope. (`04` §3.3)
- **Seeker experience**: Discover, Search, Saved, Property page. (`05` §1–2)
- **Lister workspace** and **ops console**, replacing three consoles. (`04` §8)
- **Search and ranking** in Postgres with explainable scoring. (`08` §4)
- **Media pipeline** (direct upload, worker processing, native video). (`09`)
- **Delivery**: gated CD, tagged images, rollback, migrations in deploy, staging. (`06` §5.3)

### What should we postpone?

ML recommendations and inferred-intent features until data thresholds; Watch mode as a primary surface; phone OTP until after contact is ungated; native app work; booking/payments; reviews investment; second market; multi-language. (`11` §4)

### What should the operational structure become?

Organised around **work queues that keep supply true**, not around who may edit which campus.

- **Admin** (platform, few people).
- **Market lead** per market: accountable for density and truth; works queues and directs scouts.
- **Reviewer**: clears review and report queues (the market lead at small scale).
- **Scout**: brings supply; paid per listing that goes live and stays fresh.
- **Lister organisations**: owners, caretakers, managers and agents as members with roles.
- **Seekers**: no role at all.

Freshness reconfirmation, staleness, duplicate and price-sanity flags are automated; humans handle first listings, scams and disputes. (`04`)

### What roles and dashboards are actually necessary?

Roles: **admin, market lead, reviewer, scout** (staff); **owner, manager, agent** (within a lister org); everyone else is a seeker.

Surfaces: **My Rumia** (seeker), **Lister workspace**, **Ops console** (with admin settings inside it). Three surfaces instead of four apps and 46 internal pages. (`04` §8)

### What should the user experience become?

- Arrive on a property from a shared link → see it fast → WhatsApp the owner in one tap, no account.
- Land on one Explore screen that is both home and search: a single box that understands plain words, a monthly/nightly switch, three filters, real places ranked by freshness and fit (full spec in `ux/`).
- Search in plain words; see honest counts and why things are ranked.
- Come back to "Continue your search: 4 new since Tuesday".
- Get a WhatsApp alert when a match appears.
- Listers add a property from their phone in ~3 minutes, starting with the photos they already have, and keep it current by answering "Still available?" with one tap.

(`05`, `03`)

### What should the technical architecture become?

The same stack, made coherent: Next.js (public SSR/ISR + BFF) and FastAPI (modular monolith with domain modules) plus **one worker process** with a Postgres job queue and transactional outbox; Postgres 17 with PostGIS and pg_trgm; R2 + Cloudflare Stream; Cloudflare edge caching; Sentry, off-box logs and first-party events. Alembic migrations from a live baseline. Typed clients generated from OpenAPI. No new infrastructure categories. (`06`)

### What should we build first?

In order:

1. **Phase 0 stabilisation** (2–3 weeks): the S1 defects, worker process, gated CD with rollback, Alembic baseline, real-DB tests, failure visibility. And **decide the revenue model**.
2. **Contact without sign-in, with reference codes and event tracking**, on the current property page. Highest impact per unit of work in this package, and it starts the data collection everything else needs.
3. The new domain model and backfill; lifecycle and reconfirmation.
4. Then the new property page and share kit, search, home, saved, lister workspace, ops console, in that order.

(`11` §1)

### What should we explicitly NOT build yet?

ML recommender, embeddings or vector search; booking/payments; in-app chat; native app features; Elasticsearch, Redis, Kafka, Kubernetes, microservices, GraphQL; a second market; custom analytics dashboards; gamification; a video-first home. (`11` §4)

### What are the largest risks?

1. **Listers won't keep listings current**, and freshness rules demote most supply. This is the operational heart of the plan.
2. **The revenue model is undecided**, and changing click commissions affects the agents who supply listings today.
3. **The team is spread too thin** across web, native, consoles and a migration.
4. **Personal data obligations** grow with behavioural data.

(`11` §2)

### What would prevent this architecture from scaling?

- Skipping the domain rebuild and adding more columns and side tables to `listings`.
- Keeping humans in the loop for every listing instead of queues with automated triage.
- Running background work inside web workers.
- Shipping without first-party events, so ranking can never learn.
- Hard-coding a market, campus or category anywhere in code.
- Deploying migrations by hand without a baseline.
- Opening markets before they have density.

### What would make Rumia genuinely difficult for competitors to copy?

Not the UI and not the algorithm. Both are copyable in months.

1. **A freshness-and-truth record**: years of confirmed availability, visits, registry matches and outcomes per property and lister. It only exists by running the ops loop.
2. **Owner distribution**: thousands of properties whose owners share Rumia links as their default way to advertise.
3. **Local density and ground operations** in each town (scouts, market leads, owner relationships, institution registers).
4. **Outcome data** on what Kenyan renters actually choose at what price and distance, which makes ranking, pricing guidance and market selection better than anyone starting from listings alone.

---

## Decision checklist for approval

- [ ] Positioning (`02` §1) and the challenges in `02` §2
- [ ] Contact without sign-in, with reference codes (`04` §5.5)
- [ ] Revenue model direction (`04` §6) — needs your input (Q1)
- [ ] Roles and surfaces (`04` §3, §8)
- [ ] Domain model and additive migration (`07`, `10`)
- [ ] Freeze native app development (`06` §2.4)
- [ ] Phase 0 scope (`11` §1)
- [ ] Design direction (`05`, `13`) — can be prototyped in Claude Design before build
