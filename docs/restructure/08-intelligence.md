# 08 · Analytics, Event Model, Personalization and Discovery

Covers: analytics and event model, personalization strategy, discovery and ranking strategy.

Order of operations: **collect the right signals → measure the funnel → rank with explainable rules → learn only when data supports it.**

---

## 0. Rumia Brain

The system in this document has a name and a single job: **match people to places.** It is the evolution of the original "understand the user like Spotify does" vision, re-aimed at an episodic, high-stakes search rather than endless consumption.

| Stage | Built from | Section |
|---|---|---|
| **Intent** | Query, filters, mode, starting points, alert definitions | §3 `intent_set`, `search_performed` |
| **Context** | Market, mode, entry surface, referrer, device, season | §3 envelope |
| **Preferences** | Session interest → active search profile → long-term taste | §5.1 |
| **Ranking** | Hard filters + explainable score | §4.1–4.3 |
| **Recommendations** | Continue your search, similar to saved, similar nearby, fresh matches | §4.4–4.5 |
| **Alerts** | Saved searches matched against new or changed supply | §4.5, `engagement` module |

Design rule: every Brain output must be explainable in one sentence to the user and editable by them. What Rumia can know at each visitor stage on the web is specified in `ux/06-personalization-web.md`.

---

## 1. Current state

**[FACT]**

- PostHog client events: `listing_viewed`, `hostel_wishlisted`/`unwishlisted`, `contact_whatsapp_opened`, `fee_disclosure_accepted`, `tour_booked`, `google_sign_in_initiated`, `profile_completion_*`, `listing_created`/`updated`, `user_signed_out`, `$pageview`. About 11 custom events.
- Server: `listing_views` rows (per view, IP hash) rolled up daily; `leads` rows per contact click.
- Nothing for searches, filters, impressions, gallery/video engagement, shares, reports, returns, outcomes.
- Ranking: admin `sort_position` + shuffle, or all-time views, or newest.

**[OBS]** The data needed to answer "is search working?", "which listings convert?", "does video help?" and "do shared links bring new seekers?" is not collected. That is the first gap to close, before any ranking work.

---

## 2. Data principles

1. **Collect a signal only if a named decision or feature uses it.** Each event below lists its consumer.
2. **First-party for product logic, PostHog for analysis.** Events are written to Rumia's own `events` table (needed at request time for ranking, alerts and ops) and forwarded to PostHog for funnels and dashboards.
3. **Pseudonymous by default.** Events carry `device_id` and, when signed in, `user_id`. No names, phones or free text in events. IPs not stored; country/region derived at ingest and dropped.
4. **Consent and notice.** A plain privacy notice explaining that browsing behaviour is used to improve results, with a setting to turn off personalization and to delete history. Personalization off → ranking falls back to market-level signals. Check the exact consent model with a data protection adviser (`06` §6).
5. **Retention.** Raw events 13 months; aggregates kept.

---

## 3. Event model

Common envelope: `event_id` (client-generated UUID for dedupe), `name`, `occurred_at`, `device_id`, `user_id?`, `session_id`, `market_id`, `surface` (`home`/`search`/`property`/`saved`/`watch`/`share_landing`), `referrer_kind` (`whatsapp`/`instagram`/`tiktok`/`google`/`direct`/`internal`), `app_version`, `request_id?`.

Batched from the client (`POST /events`, up to 50 per call, `sendBeacon` on page hide). Server-side events emitted from the outbox for anything the server is the authority on.

| Event | Key properties | Consumer |
|---|---|---|
| `session_started` | entry path, referrer_kind, in_app_browser | Distribution loop, in-app browser share |
| `intent_set` | intent fields, source (`card`/`search`/`inferred_accepted`) | Personalization, demand map for ops |
| `search_performed` | parsed filters, raw query (truncated, no PII patterns), result_count, sort | Search quality, zero-result analysis, demand |
| `results_impression` | list of property ids with positions, ranking version | Ranking evaluation (CTR by position), skip detection |
| `property_opened` | property_id, position, from surface | Popularity, ranking labels |
| `media_engaged` | property_id, kind (`gallery`/`video`), depth (images seen) or video quartile (25/50/75/95) | Media quality score, video value |
| `property_dwell` | property_id, visible seconds (bucketed) | Interest strength |
| `save_toggled` | property_id, unit_id, on/off | Strong positive signal |
| `share_clicked` | property_id, channel | Distribution loop |
| `contact_initiated` (server) | property_id, unit_id, channel, ref_code | North star, ranking label, lister analytics |
| `contact_followup_answered` | ref_code, replied yes/no/not yet | Lister responsiveness |
| `outcome_reported` | ref_code, outcome, source | Real outcome, ledger |
| `directions_opened` | property_id | Late-funnel signal |
| `report_submitted` (server) | property_id, reason | Trust ops |
| `not_interested` | property_id, reason (optional) | Negative signal, explicit |
| `alert_created` / `alert_delivered` / `alert_opened` | saved_search_id, channel | Retention loop |
| `listing_state_changed` (server) | property_id, from, to, actor_kind | Supply health |
| `reconfirmation_sent` / `reconfirmation_answered` (server) | property_id, answer, latency | Freshness ops |

Deliberately **not** collected: mouse movement, scroll position beyond dwell, hover, keystrokes, contacts' content, precise location of seekers (use place-level from intent; device geolocation only when the user taps "Near me", not stored raw).

**Skip** is inferred, not tracked as an event: an impression without an open, in a session where neighbouring items were opened, counts as a weak negative for that item.

---

## 4. Discovery and ranking

### 4.1 Hard filters first

Market, status (`live` only; `stale` allowed but demoted), unit availability, price period, user-set filters. Ranking only orders what passes.

### 4.2 Stage 1 ranking: transparent rules (build now)

```
score = w_fit · intent_fit
      + w_fresh · freshness
      + w_quality · quality_score
      + w_pop · popularity_7d (normalised within market)
      + w_new · newness_boost (first 7 days live)
      − w_seen · already_seen_penalty (opened in last 14 days, unless saved)
      − w_stale · stale_penalty
```

- `intent_fit` (0–1): price within budget (soft edges, e.g. 10% over scores partially), distance to the chosen landmark or place (decays with walking minutes), unit kind match, must-have amenities matched.
- Weights live in config, versioned; every `results_impression` records the ranking version.
- **Diversity pass**: no more than 2 properties from the same org in any 6 consecutive results; mix of places when no place is set.
- **Editorial pinning** (today's `sort_position`) survives only as a capped boost for marked collections, not as the default order.

### 4.3 Explanations

Each result can carry one reason chip computed from the dominant score term: "Within your budget", "8 min walk to DeKUT", "New this week", "Confirmed today", "Popular in Kamakwa". The chip is the same data the ranker used; never a made-up reason.

### 4.4 Similarity ("more like this")

Content-based nearest neighbours on structured features: unit kind, price per period (log), place / distance, amenities, tier. Computed in SQL or in the worker, stored per property (top 20). Used on property pages, empty states and alerts. No embeddings needed at this stage.

### 4.5 Surfaces

| Surface | Candidate source | Ranking |
|---|---|---|
| Home "Fresh this week" | Live, confirmed ≤ 7 days | Stage 1, intent if known |
| Home "Continue your search" | Active intent | Stage 1, new-since-last-visit first |
| Search | Filters + query | Stage 1 with query relevance term |
| Property page "Similar nearby" | Similarity list | Filtered by availability |
| Alerts | New or changed properties matching a saved search | Newest first; at most N per message |
| Watch | Properties with video | Stage 1 + video completion rate |

---

## 5. Personalization strategy

### 5.1 Layers of preference

| Layer | Source | Lifetime | Precedence |
|---|---|---|---|
| **Explicit current intent** | Filters, intent card, search query | Until changed | 1 (highest) |
| **Session interest** | Opens, saves, dwell in the current session | Hours; decays fast | 2 |
| **Active search profile** | Aggregated from the current search episode (since last gap > 21 days) | Weeks | 3 |
| **Long-term taste** | All history (e.g. prefers ensuite, prefers quiet areas) | Months, slow decay | 4 (lowest; tie-breaker) |
| One-off behaviour | A single outlier view (e.g. looked at a premium house once) | Ignored unless repeated | — |

A user's current need overrides history: a student who rented a hostel last year and now searches 2-bedrooms is ranked on the 2-bedroom intent, not last year's hostel views.

### 5.2 Implementation by stage

| Stage | What | Trigger to start |
|---|---|---|
| **P0 (now)** | Explicit intent captured, stored on device and account, resumed on return. Saved searches and alerts. Rule-based ranking with `intent_fit`. "Not interested" | Part of the rebuild |
| **P1** | Inferred intent from session behaviour, offered as editable chips ("Showing 1BR · Kamakwa. Keep?"). Similar-to-saved rail | ≥ 3 months of event data |
| **P2** | Learned re-ranking (gradient-boosted trees, e.g. LightGBM) on logged features, labels = contact (strong), save (medium), open (weak). Offline evaluation vs Stage 1 using logged impressions; then A/B | Roughly ≥ 2,000 contacts/month and ≥ 50,000 impressions/week in a market |
| **P3** | Embeddings for image/text "feel" similarity; session-sequence models | Multiple markets, catalogue ≥ ~20k live properties, P2 gains plateau |

The thresholds are judgement calls; the point is to start learning only when there are enough labelled outcomes to beat good rules, which in a small market may be never, and that is fine.

### 5.3 Making it feel helpful, not intrusive

- Show what Rumia is using, in the user's words, and let them edit or clear it (`03` §4).
- Never use sensitive attributes. Gender policy is a hostel property attribute users filter on, not something inferred about them.
- Notifications reference only explicit actions (saved searches, saved properties), never inferred interest.
- "Reset recommendations" in settings; "Not interested" on every card.

---

## 6. Analytics the team should look at weekly

| Question | Measure |
|---|---|
| Are seekers finding places? | Qualified contacts/week; time and properties viewed to first contact |
| Is search working? | Zero-result rate; search → open rate; open → contact rate by query type |
| Is ranking working? | CTR by position; contact rate of top 5 vs rest; ranking version comparisons |
| Is supply true? | % live confirmed ≤ 14 d; reconfirmation answer rate; "not available" reports per 100 contacts |
| Do listers respond? | "Did they reply?" yes-rate by org; median time to reply when known |
| Does the content loop work? | Sessions from shared property links; properties viewed per such session; share clicks per property view |
| Does video matter? | Contact rate for properties with vs without video (controlled for tier and place) |
| Is demand unmet? | Intents and searches by place × price band vs live supply in that cell, sent to market leads |
