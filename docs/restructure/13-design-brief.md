# 13 · Design Brief (for Claude Design)

A self-contained brief for producing the visual design and prototypes in Claude Design once the plan is approved. It restates only what a designer needs; reasoning lives in `03` and `05`.

---

## 1. Product in one paragraph

Rumia helps people find somewhere to live or stay in a Kenyan town, starting with Nyeri. Users are students (often arriving from a WhatsApp link a friend or landlord shared), parents checking a place, and young workers. Most use a mid-range Android phone on mobile data. The product's promise: every place shown is real, current and honestly priced, and Rumia remembers what you're looking for.

## 2. Personality

Calm, clear, local, trustworthy. Closer to a well-made banking or transport app than a glossy property portal or a party-student brand. Photos and video carry the emotion; the interface stays quiet. Premium properties get more space and better media, not a different style.

## 3. Constraints

- Mobile first (360–412 px wide), then desktop.
- Light and dark themes.
- Large tap targets (≥ 44 px), WCAG 2.2 AA contrast.
- Prices are the most-read text: tabular numerals, KSh formatting, period always shown ("KSh 7,500 / month").
- Low data: designs must work with a poster image instead of video and with blurred placeholders while images load.
- Built with Tailwind + shadcn/ui (Radix). One icon set: lucide.

## 4. Screens to design (priority order)

The full seeker specification is in `ux/04-screen-specs.md` and tokens in `ux/05-design-system.md`. Use those as the source; this list is the order to design in.

### Seeker

1. **Property page (mobile)**: media first (video poster or cover, swipe gallery with room tags) → name, type, place → price block (rent/period, move-in total, "Included: water · Wi-Fi") → dated fact lines ("Available, confirmed by the owner 3 days ago", "Visited by Rumia on 12 Sep", "Contact verified") → unit table if several unit types → location (walking minutes to DeKUT/CBD, static map) → about, what's here, good to know → one-line safety note → listed by → similar nearby. Sticky bottom bar: **WhatsApp {name}** (primary), Call. Save and Share over the media. States: available, stale ("Not confirmed in 3 weeks. Ask before you visit."), let ("Let on 3 Oct", similar places below).
2. **Property page (desktop)**: two columns; media mosaic left, sticky price/facts/contact card right; WhatsApp Web with number + QR fallback.
3. **Explore, new visitor (home and search in one)**: one-line statement ("Places to rent in Nyeri, confirmed by owners."), one search box, Rent monthly · Stay a few nights switch, four data-driven starting points, filter row (Area · Price · Type · More), count + sort, results grid, Show more.
4. **Explore, returning visitor**: "Continue: Bedsitter · Kamakwa · ≤ 8k · 3 new" and Recently viewed above the results.
5. **Explore, desktop split view** with map; mobile full-screen map toggle; filter bottom sheet with live "Show 23 places"; few-results and empty states.
6. **Property card** component: grid, compact and map-popover variants. Three lines: price · type / name · area / walk time · freshness.
7. **Saved / My Rumia**: saved properties with live status, compare tray (2–3), saved searches with alert channel, contact history with "Did you move in?".
8. **Contact handoff**: the moment after tapping WhatsApp (pre-filled message preview with ref code), and the return prompt "Did they reply?".
9. **Share**: share sheet content, WhatsApp link preview (OG image: cover, price, place, trust line).
10. **Sign-in sheet**: Google, (later) phone number; in-app browser variant with "Open in browser".

### Lister (mobile)

11. **Today**: attention list (confirm availability, changes requested, new inquiries, drafts).
12. **Create listing**: step flow: media → type → location pin → units and prices → included → contact → preview and checklist. Progress visible; autosave.
13. **Listing detail**: status, freshness, this week's views/contacts, one suggestion, quick actions (still available, mark let, edit price).
14. **Share kit**: link, captions, QR sign, status image.

### Ops (desktop)

15. **Queues home**: review, reports, stale orgs, visits, price flags; counts, oldest age, SLA status.
16. **Review item**: listing preview beside checks (media, duplicates, price band, contact verification) and actions (approve, request changes, reject with reason).
17. **Market health**: supply vs demand by neighbourhood × price band; freshness and response rates.
18. **Entity page** (listing / org / user) with timeline.

## 5. Components and tokens to define

Tokens: semantic colours (`surface`, `surface-raised`, `text`, `text-muted`, `accent`, `positive`, `warning`, `danger`, `trust`), type scale, spacing, radius, elevation, motion durations.

Components: PropertyCard, PriceBlock, TrustLine, AvailabilityPill, MediaGallery, VideoPlayer (poster-first), IntentCard, FilterChips, ReasonChip, ActionBar, UnitTable, EmptyState, QueueItem, EntityTimeline, StepFlow, Checklist.

## 6. Sample content (use real-feeling Nyeri data)

- "Kamakwa Heights" · Bedsitter · KSh 7,500 / month · deposit KSh 7,500 · Included: water, Wi-Fi · 8 min walk to DeKUT · Available, confirmed 2 days ago · 3 units available.
- "Ruringu Gardens" · 1 bedroom · KSh 14,000 / month · deposit KSh 14,000 · parking · 6 min drive to Nyeri CBD · Visited by Rumia on 12 Sep 2026.
- "Skuta Cottage" · Entire home, 2 guests · KSh 3,500 / night · min 2 nights.
- "Mathari Ladies Hostel" · Shared room (2) · KSh 5,500 / month · women only · 5 min walk to DeKUT gate B.

## 7. What not to design

Splash screens, onboarding carousels, profile completion steps, confetti or celebratory animations, leaderboards, view counters, a TikTok-style full-screen feed as the home page.
