# Rumia Restructuring Plan

Status: **proposal for review. Nothing in the application has been changed.**
Date: 2026-10-08. Based on the repository at `ed5394d` and the production evidence in `docs/PRODUCTION_READINESS_AUDIT.md`.

## Read in this order

| File | Covers |
|---|---|
| [12-recommendation.md](12-recommendation.md) | **Start here.** The decisions, answering every question in the brief |
| [01-current-state.md](01-current-state.md) | Current-state assessment, journeys traced through code, technical debt register |
| [02-product-vision.md](02-product-vision.md) | Vision, principles, where I disagree with the brief, geographic strategy, success metrics |
| [03-users-and-behavior.md](03-users-and-behavior.md) | Actors, seeker modes, why journeys fail, when to ask vs infer |
| [04-operating-model.md](04-operating-model.md) | Operating model, roles and permissions, lifecycle, workflows, money, trust levels, internal surfaces |
| [05-experience.md](05-experience.md) | Information architecture, URL scheme, seeker/lister/ops UX, states, design system |
| [06-architecture.md](06-architecture.md) | Frontend, backend, API, reliability and observability, security |
| [07-domain-and-data.md](07-domain-and-data.md) | Domain model, tables, derived data, database strategy, mapping from today |
| [08-intelligence.md](08-intelligence.md) | Event model, ranking, personalization stages |
| [09-media-and-content.md](09-media-and-content.md) | Photos, video, the share loop, content |
| [10-quality-and-migration.md](10-quality-and-migration.md) | Testing strategy, migration strategy |
| [11-roadmap-and-risks.md](11-roadmap-and-risks.md) | Phased roadmap, risks, deliberate trade-offs, what not to build |
| [13-design-brief.md](13-design-brief.md) | Brief for producing the designs in Claude Design |
| [ux/](ux/README.md) | **Public web UX redesign**: audit, research, principles, IA, screen specs, design system, Rumia Brain on the web, rebuild decisions |

Evidence tags: **[FACT]** read in code or production evidence · **[OBS]** interpretation · **[ASSUMPTION]** unverified · **[REC]** recommendation.

## The plan in eight lines

1. The engineering foundation is sound; **don't rewrite the stack**.
2. The **domain model** is the real constraint: rebuild it additively (orgs → properties → units, markets → places → landmarks, lifecycle and freshness, trust evidence).
3. **Contact must not require sign-in.** Google OAuth fails in the WhatsApp/Instagram in-app browsers that Rumia's shared links open in. Use reference codes for attribution.
4. **Stop accruing commission on clicks**; record money only on confirmed outcomes.
5. Replace Admin → Manager → Agent with **queues that keep supply true**: admin, market lead, reviewer, scout, and lister organisations. Three surfaces instead of 46 internal pages.
6. "Spotify for property" is the wrong model for an episodic, high-stakes search. **Intent + memory + alerts + explainable ranking** first; ML only past data thresholds.
7. **Native video and a shareable property page** are the growth loop to test; a video-first home waits for video coverage.
8. Stabilise (2–3 weeks), lay foundations (5–7), ship the new experience (6–8), then intelligence, then a second market when Nyeri passes a density threshold.

## Open questions

These change the plan and cannot be answered from the code.

| # | Question | What it changes |
|---|---|---|
| Q1 | **How should Rumia make money?** Lister-paid (per move-in, subscription, featured placement), seeker-paid (Assist/finding fees), or not yet? What do the current commissions, consultation fees, tours and "find me a hostel" actually earn per month? | Ledger design, scout incentives, whether Assist survives, what replaces click commissions (`04` §6) |
| Q2 | **Supply facts**: how many live listings, how many agents have at least one, what share have video, how many leads per month, how many listings do you believe are currently accurate? (Production reads were declined in this session; the query is below.) | Reconfirmation intervals, review capacity, whether video-first is realistic, migration size |
| Q3 | Who are the current agents in practice: independent agents, caretakers, owners, or Rumia's own field people? Are they paid by Rumia, by owners, or only by commissions? | Scout vs lister split and the transition message |
| Q4 | **Team size and roles** for the next six months (engineers, design, ops in Nyeri)? | Roadmap durations and how much runs in parallel |
| Q5 | Is the native app used? Installs, weekly actives, and whether anyone depends on it (e.g. listers)? | Whether freezing it is safe |
| Q6 | Which Nyeri institutions and neighbourhoods do you want in the first market definition, and is the "coming soon" campus list based on real demand? | Market seeding, landmark list, choice of market 2 |
| Q7 | Do you have a WhatsApp Business API account or an SMS provider (e.g. Africa's Talking) in place? Budget per month for messaging? | Reconfirmation and alert channels |
| Q8 | Are you registered with Kenya's ODPC as a data controller, and do you have a privacy notice covering analytics? | Event collection launch requirements |

### Query for Q2 (run on the server, read-only)

```sql
select 'listings active/total', count(*) filter (where is_active), count(*) from listings
union all select 'type:'||coalesce(property_type,'null'), count(*) filter (where is_active), count(*) from listings group by property_type
union all select 'active with video', count(*) filter (where is_active and youtube_id is not null), 0 from listings
union all select 'active not updated 90d', count(*) filter (where is_active and coalesce(updated_at, created_at) < now() - interval '90 days'), 0 from listings
union all select 'active full', count(*) filter (where is_active and is_full), 0 from listings
union all select 'agents with active listing', count(distinct agent_id), 0 from listings where is_active
union all select 'agents linked to a user', count(*) filter (where user_id is not null), count(*) from agents
union all select 'placeholder phone agents', count(*), 0 from agents where phone = '+254700000000'
union all select 'leads 30d', count(*), count(distinct listing_id) from leads where clicked_at > now() - interval '30 days'
union all select 'commissions:'||status, count(*), coalesce(sum(amount),0)::int from commissions group by status
union all select 'tours:'||status, count(*), 0 from tour_bookings group by status
union all select 'hostel_requests:'||status, count(*), 0 from hostel_requests group by status
union all select 'views 30d / distinct viewers', count(*), count(distinct coalesce(user_id::text, ip_hash)) from listing_views where viewed_at > now() - interval '30 days';
```

## Using Claude Design

`13-design-brief.md` is written to be handed to Claude Design. Once the direction in `05-experience.md` is approved, the property page, home, search, saved, lister "Today"/editor and ops queue screens can be prototyped there before any frontend code is written, which is cheaper than iterating in React.
