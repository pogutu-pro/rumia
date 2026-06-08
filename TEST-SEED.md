# Test Seed Guide

Populates Supabase with full end-to-end test data for the admin panel, agent dashboards, public hostel pages, smart hostel search, leads, commissions, SEO slugs, and YouTube video tours.

## What Gets Created

- **3 agents** (2 active, 1 suspended) with refreshed Auth logins and slugs
- **9 DeKUT/Nyeri hostel listings** (3 per agent) with `youtube_id`, `slug`, `county`, `area`, `gender`, `proximity_description`, `room_type_enum`, multiple images, and room types
- **~38 leads** spread across the current month
- **9 commissions** (6 pending, 3 paid)

All operations are idempotent — re-running won't duplicate records. Existing test agents and listings are updated with the latest fields, and old Juja/Nairobi sample listings are removed when they belong to these test agents.

---

## Prerequisites

`.env.local` must have:

```
NEXT_PUBLIC_SUPABASE_URL=https://pjqgtypojpnnvonuzuzj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAILS=admin@rumia.co.ke
```

---

## Run the Seed

```bash
pnpm run seed:test
```

---

## Test Accounts

| Role | Name | Email | Password | Status | Public agent page |
|---|---|---|---|---|---|
| Admin | Seed Admin | admin@rumia.co.ke | password123 | Active | - |
| Agent | James Kariuki | agent1@rumia.co.ke | password123 | Active | `/agents/james-kariuki` |
| Agent | Amina Odhiambo | agent2@rumia.co.ke | password123 | Active | `/agents/amina-odhiambo` |
| Agent | Brian Mutua | agent3@rumia.co.ke | password123 | Suspended | `/agents/brian-mutua` |

---

## Listings per Agent

### James Kariuki (agent1)
| Title | Price | Active | Public path | YouTube tour |
|---|---:|---|---|---|
| Kariuki Gardens — Self Contained | 12,000 | Yes | `/hostels/nyeri/dekut/kariuki-gardens-self-contained-dekut` | https://www.youtube.com/watch?v=qL0Z3sGXBas |
| Sunrise Bedsitter — Nyaribo | 7,500 | Yes | `/hostels/nyeri/dekut/sunrise-bedsitter-nyaribo-dekut` | https://www.youtube.com/watch?v=DczLkNIRgFE |
| Kariuki Annex — Single Rooms | 5,000 | Yes | `/hostels/nyeri/dekut/kariuki-annex-single-rooms-dekut` | https://www.youtube.com/watch?v=K4TOrB7at0Y |

### Amina Odhiambo (agent2)
| Title | Price | Active | Public path | YouTube tour |
|---|---:|---|---|---|
| Amina Court — Studio Apartment | 18,000 | Yes | `/hostels/nyeri/dekut/amina-court-studio-apartment-dekut` | https://www.youtube.com/watch?v=LXb3EKWsInQ |
| Nyeri View Heights — 1 Bedroom | 20,000 | No | `/hostels/nyeri/dekut/nyeri-view-heights-1-bedroom-dekut` | https://www.youtube.com/watch?v=rO9bMQxmV2E |
| Amina Ladies Hostel — Nyaribo | 6,500 | Yes | `/hostels/nyeri/dekut/amina-ladies-hostel-nyaribo-dekut` | https://www.youtube.com/watch?v=qL0Z3sGXBas |

### Brian Mutua (agent3 — suspended)
| Title | Price | Active | Public path | YouTube tour |
|---|---:|---|---|---|
| Mutua Annexe — Single Room | 4,500 | Yes | `/hostels/nyeri/dekut/mutua-annexe-single-room-dekut` | https://www.youtube.com/watch?v=DczLkNIRgFE |
| Eastern View — Bedsitter | 5,500 | Yes | `/hostels/nyeri/dekut/eastern-view-bedsitter-dekut` | https://www.youtube.com/watch?v=K4TOrB7at0Y |
| Mutua Guestrooms — Shared Double | 3,000 | Yes | `/hostels/nyeri/dekut/mutua-guestrooms-shared-double-dekut` | https://www.youtube.com/watch?v=LXb3EKWsInQ |

---

## End-to-End Checks

- Public hostel index: `/hostels`
- DeKUT landing page: `/hostels/nyeri/dekut`
- Listing detail pages: confirm "More places to stay nearby" shows other active seeded hostels from the same area
- Agent dashboard: `/dashboard`
- Admin overview: `/admin`
- Admin agents: `/admin/agents`
- Admin listings: `/admin/listings`
- Admin leads: `/admin/leads`
- Admin commissions: `/admin/commissions`

---

## Admin Login

```
URL:      http://localhost:3000/auth/login
Email:    admin@rumia.co.ke
Password: password123
```

---

## Cleanup

Remove all seeded test agents, listings, leads, commissions, room types, listing images, and seeded Auth users with one command:

```bash
pnpm run seed:test:cleanup
```
