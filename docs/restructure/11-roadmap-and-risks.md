# 11 · Roadmap, Risks and Trade-offs

Covers: implementation roadmap, risks and trade-offs, what not to build.

Durations assume **two full-time engineers and part-time design/product** (open question Q4). Scale them to your team. Phases overlap where noted; each ends with a measurable exit criterion, not a date.

---

## 1. Roadmap

### Phase 0 · Stabilise and make visible (2–3 weeks)

Goal: no known S1 defects, and failures are visible.

| Item | Ref |
|---|---|
| Fix listing attribution for staff without agent rows (arbitrary agent, placeholder phone); audit existing listings for `+254700000000` and misattribution | `01` D3 |
| Client IP trust chain (Cloudflare → nginx → web → API) and per-real-IP limits | D5 |
| Single worker process for cron/retries; `SKIP LOCKED` claiming | D11 |
| CD gated on CI; images tagged by SHA; rollback; backend Dockerfile uses `uv.lock` | D12, D13 |
| Alembic baseline from live; drift reconciled; admin-by-email trigger gone from every build path | D4, D10 |
| Real-Postgres integration tests in CI for auth, listings feed, leads | D14 |
| Sentry on every auth and contact failure branch with cause tags; off-box logs; uptime checks | `06` §5 |
| Fail-closed role resolution; suspended-user enforcement; remove Supabase verification path | D21, D22 |
| In-app browser detection on sign-in with "Open in browser" | `05` §4 |
| Remove `/public/verify-candidates` bulk endpoint | D30 |
| Move SSH key and passphrase out of the repo directory | D28 |
| **Decide the revenue model** (Q1) and stop accruing commission on clicks if it changes | `04` §6 |

**Exit:** a week with zero unexplained 5xx on critical paths; sign-in completion measured; deploys roll back automatically on failed health.

### Phase 1 · Foundations (5–7 weeks, can start week 2 of Phase 0)

Goal: the new domain exists and is populated; contact no longer needs an account.

| Item | Ref |
|---|---|
| Event ingestion (`/events`, partitioned table, PostHog forwarding) and the event schema in §`08` 3, instrumented on current pages first | `08` §3 |
| **Contact without sign-in**: ref codes, `inquiries`, WhatsApp pre-fill, "Did they reply?" follow-up, on the current property page | `04` §5.5 |
| Anonymous device id; saves without account | `06` §2.2 |
| `markets`/`places`/`landmarks`; DeKUT defaults removed from code paths (73 web files, 14 backend) | `07` §2.3 |
| `users`/`auth_identities`/`staff_assignments`/`org_members`; permission-based authorisation | `04` §3 |
| `lister_orgs`/`properties`/`property_units`/media tables; idempotent backfill; old write endpoints become adapters | `07`, `10` §2.2 |
| Lifecycle state machine + `last_confirmed_at`; reconfirmation job (SMS/WhatsApp provider chosen) | `04` §4, §5.3 |
| Direct-to-R2 uploads + worker image processing | `09` §2 |
| Design system tokens and core components (in parallel, design-led; see `13-design-brief.md`) | `05` §6 |

**Exit:** 100% of live listings exist in the new model with counts matching; inquiries with ref codes ≥ 95% of contacts; reconfirmation running for Nyeri; the event funnel visible in PostHog.

### Phase 2 · New experience (6–8 weeks)

Goal: seekers, listers and ops use the new surfaces; old ones deleted.

| Order | Surface |
|---|---|
| 1 | Property page `/p/{slug}` + OG images + share kit + redirects |
| 2 | Search (server-side, chips, list/map, cursor paging), place and landmark landings |
| 3 | Home (intent card, continue-search, fresh this week) |
| 4 | Saved / My Rumia (saves, compare, saved searches + alerts, history, outcome capture) |
| 5 | Lister workspace (Today, editor, inquiries, org members) |
| 6 | Ops console (queues, market health, entity pages, admin settings) |
| 7 | Delete `(admin)`, `(manager)`, `(dashboard)`, `/bnb`, `/hostels`, `/videos`, `/compare`, `/verify/*` old pages |

**Exit:** old route groups deleted; north-star and seeker-effort metrics baselined; lister create flow median < 5 min.

### Phase 3 · Intelligence and content (ongoing, from Phase 2 week 4)

- Stage 1 ranking with explanations; similarity lists; alerts tuned.
- Native video (Cloudflare Stream) and Watch mode.
- Phone OTP sign-in.
- Verification visits queue and evidence; registry generalisation.
- P1 inferred intent chips after 3 months of event data.

### Phase 4 · Second market (when Nyeri meets the threshold in `02` §4.2)

- Market setup is data: boundary, places, landmarks, config, staff.
- Scouts recruited and trained with the Nyeri playbook.
- Waitlist intents converted to alerts at launch.

### Contract phase (after Phase 2 + 30 days)

Drop old tables after export; remove adapters; remove `auth` shim schema; remove Supabase remnants; update README and env examples.

---

## 2. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Listers don't reconfirm**, so freshness demotes most supply | Medium | High | Make it one tap over WhatsApp/SMS; show the contact uplift; scouts call non-responders; tune intervals per market |
| **Revenue model unresolved**; removing click commissions demotivates agents | High | High | Decide in Phase 0; scout bounties for live-and-fresh supply replace click incentives; communicate with a date |
| **Team overload**: web + PWA + native + two internal surfaces + migration | High | High | Freeze native; delete old surfaces as new ones ship; no parallel UIs beyond one release |
| **Losing attribution** when contact no longer requires sign-in | Medium | Medium | Ref codes in pre-filled messages; "Did they reply?" follow-up; outcome capture |
| **WhatsApp dependence**: contact leaves the platform, outcomes invisible | High | Medium | Accept for now; ref codes + follow-ups; consider WhatsApp Business API for listers later |
| **Migration bugs corrupt listings** | Medium | High | Idempotent backfills keyed by legacy id, count/diff reports, anonymised snapshot rehearsals, old tables untouched until contract |
| **SEO dip from URL change** | High | Medium | Permanent 301 map; place pages; Search Console; accept a short dip |
| **Data protection non-compliance** as behavioural data grows | Medium | High | Notice and settings at launch of event collection; adviser review; retention limits |
| **Single VM failure** | Low–Medium | High | Off-box backups exist; add PITR; documented restore drill; Cloudflare caching keeps public pages up briefly |
| **Video costs** grow with usage | Medium | Low–Medium | Duration caps, per-property limits, poster-first playback |
| **Scams adapt** to verification | Medium | High | Evidence-based trust levels, perceptual hash dupe detection, fast report handling, visible trust explanations |
| **Personalization built too early** | Medium | Medium | Stage gates in `08` §5.2 |

---

## 3. Trade-offs made deliberately

| Chosen | Over | Why | Revisit when |
|---|---|---|---|
| Modular monolith | Microservices | One team, one deploy, strong consistency | Separate teams own separate domains with conflicting release cadences |
| Postgres FTS + trigram + PostGIS | Elasticsearch/OpenSearch/Typesense | One datastore; enough for 100k+ properties | p95 search > 300 ms after tuning, or > ~200k live offers, or faceting needs exceed SQL |
| Postgres job table | Redis + Celery/RQ | Fewer systems; transactional outbox | Sustained > ~100 jobs/s or sub-second scheduling needs |
| Rule-based ranking | ML recommender | Not enough labelled outcomes; explainability | Thresholds in `08` §5.2 |
| No booking/payments | Short-stay booking engine | Focus on long-term rental PMF | Nyeri long-term metrics hit targets and short-stay demand is proven |
| Web/PWA first | Native app investment | Links are the distribution | Repeat use (listers daily, seekers via alerts) justifies home-screen presence |
| Contact without account | Gated contact for identity | The gate breaks the main channel | Never, for contact |
| Single VM + Cloudflare | Managed cloud / multi-node | Cost and simplicity at current load | Sustained CPU > 60%, or uptime needs beyond what PITR + quick restore give |
| Additive new tables + backfill | In-place migration of `listings` | Lower risk, clean contract | — |

---

## 4. Explicitly not now

- A recommendation/ML service, embeddings, vector database.
- Booking calendar, instant book, payments escrow, M-Pesa integration (until a paid product exists).
- Native app features.
- In-app chat (WhatsApp is where people already talk).
- Reviews expansion, ratings on listers.
- Multi-language UI (prepare strings; don't translate yet).
- A second market before Nyeri passes the threshold.
- Custom analytics dashboards in the ops console beyond market health.
- Redis, Kafka, Kubernetes, Elasticsearch, GraphQL, CQRS.
- Gamification for scouts or seekers.
