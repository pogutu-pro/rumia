# Test Seed Guide

This document explains how to populate your Supabase database with realistic test data so you can verify the admin panel end-to-end.

## What Gets Created

- **3 test agents** (active, active, suspended) with Auth accounts
- **6 listings** (2 per agent, mix of active/inactive) with images
- **24 leads** spread across the current month (simulating WhatsApp clicks)
- **6 commissions** (mix of pending and paid, with `paid_at` timestamps)

All data is idempotent — running the script twice won't duplicate records.

---

## Prerequisites

Make sure your `.env.local` has both keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://pjqgtypojpnnvonuzuzj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Also run the `paid_at` migration in the Supabase SQL Editor if you haven't already:

```sql
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS paid_at timestamptz;
```

Also add a `status` column to agents if it doesn't exist yet:

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
```

---

## Run the Seed

```bash
pnpm exec tsx scripts/seed-test-data.ts
```

If `tsx` isn't installed:

```bash
pnpm add -D tsx
pnpm exec tsx scripts/seed-test-data.ts
```

---

## Test Accounts Created

| Name | Email | Password | Status |
|---|---|---|---|
| James Kariuki | agent1@rumia.co.ke | password123 | Active |
| Amina Odhiambo | agent2@rumia.co.ke | password123 | Active |
| Brian Mutua | agent3@rumia.co.ke | password123 | Suspended |

---

## Admin Login

Paul's admin account must already exist in Supabase Auth. If it doesn't:

1. Go to Supabase Dashboard → **Authentication → Users**
2. Click **Add user → Create new user**
3. Email: `paul@rumia.co.ke`, Password: `admin123`
4. Click **Auto Confirm User**

Then visit `/auth/login`, log in as `paul@rumia.co.ke`, and go to `/admin`.

---

## What You Should See in the Admin Panel

### Overview
- 4+ active listings
- 10+ leads this month
- KES figures in the commissions pending card
- All 3 agents listed in Top Agents (James and Amina will have leads)

### Agents page
- 3 agents with lead counts, commission balances, and status badges
- Brian shows as "Suspended"

### Listings page
- 6 listings across agents, one inactive listing (to test the inactive filter)

### Leads page
- 24 rows of click events across multiple listings and agents
- Each row has a "Create Commission" button

### Commissions page
- 6 commission records
- 4 pending (amber), 2 paid (green)
- Summary totals at top right

---

## Cleanup (Optional)

To remove test data, run in the Supabase SQL Editor:

```sql
-- Remove test leads, commissions, listings, agents (cascade order)
DELETE FROM leads WHERE agent_id IN (
  SELECT id FROM agents WHERE phone LIKE '+25470000000%'
);
DELETE FROM commissions WHERE agent_id IN (
  SELECT id FROM agents WHERE phone LIKE '+25470000000%'
);
DELETE FROM listing_images WHERE listing_id IN (
  SELECT id FROM listings WHERE agent_id IN (
    SELECT id FROM agents WHERE phone LIKE '+25470000000%'
  )
);
DELETE FROM listing_room_types WHERE listing_id IN (
  SELECT id FROM listings WHERE agent_id IN (
    SELECT id FROM agents WHERE phone LIKE '+25470000000%'
  )
);
DELETE FROM listings WHERE agent_id IN (
  SELECT id FROM agents WHERE phone LIKE '+25470000000%'
);
DELETE FROM agents WHERE phone LIKE '+25470000000%';
-- Then manually delete the 3 auth users from Authentication → Users in the dashboard
```
