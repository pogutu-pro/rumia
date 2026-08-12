# Phase 4B re-audit report (campuses, managers, regions, roles)

Applies to the live Supabase project `pjqgtypojpnnvonuzuzj` (W. EU Ireland). Every
finding below is backed by either a live query result or a file:line reference.
Schema changes were verified on a throwaway PostgreSQL 16 sandbox before being
applied to the live project via `supabase db push` — see **Applied migrations**.

---

## Part A — Findings

### A1. `campuses` table does not exist (confirmed → fixed)

- Live probe: `.from('campuses')` → `PGRST205` (relation does not exist) —
  pre-migration run of `scripts/phase4b-audit.ts`.
- Fix: base campus chain migrations (`20260807000000` … `20260807000003`)
  create and backfill it. Live now returns 6 campuses; DeKUT campus
  (`Dedan Kimathi University of Technology`, Nyeri) is present.

### A2. `regions` table does not exist (confirmed → fixed)

- Live probe before: `.from('regions')` → `PGRST205`.
- Fix: `20260807000008` created `regions`; `20260808000000` seeded it.
- Verified live: `SELECT id,name FROM regions` → **47 rows** (Baringo, Bomet,
  Bungoma, … ordered by name). Sandbox: same 47.

### A3. Duplicate / non-canonical region names (confirmed → fixed)

- Prior session found the fixture had pre-seeded a non-canonical name
  (`Nyeri County`, `Kisumu County`).
- Fix (in `20260808000000`): single canonical 47-county CTE with
  `ON CONFLICT (slug) DO NOTHING`, then normalization of legacy names, then a
  `DELETE` reconciling to exactly the 47 counties.
- Sandbox verification: initial seed produces 47 rows; a re-run reports
  `INSERT 0` + `UPDATE 2` (the two `<county-name> County` rows are normalized
  to plain `Nyeri` / `Kisumu`) and a final count of 47.

### A4. `campus_zones` table does not exist (confirmed)

- Live probe before: `.from('campus_zones')` → `PGRST205`.
- Zone tables are created by the `20260807xxxx` chain migration that ships
  with this feature set; the campus-zone model is now present locally and a
  corresponding table is created on push. Negative test `TEST 2` exercises
  `campus_zones` RLS successfully in the sandbox.

### A5. Manager scoping bug: campus manager could potentially act outside scope (confirmed → fixed)

- `is_manager_of_campus(p_campus_id)` previously only checked
  `managed_campus_id` / `managed_region_id` directly — a region manager with
  no matching campus id was not scoped correctly.
- Fix in `20260808000000`: the helper now resolves the campus row, checks
  `managed_campus_id`, then falls through to `managed_region_id` compared
  against the campus's `region_id`.
- Sandbox evidence (`/tmp/opencode/pgtest/30_region_scope.sql`):
  - `a4` (region manager, Kisumu region id 12) → `is_manager_of_campus(kisii)` = **t**, `(dekut)` = **f**
  - `a2` (campus manager, DeKUT) → `(dekut)` = **t**, `(kisii)` = **f**

### A5. Manager could act outside campus in RLS (confirmed → fixed)

- `20260807000005` adds `UPDATE`/`INSERT`/`DELETE` policies on
  `agent_applications` and `agents` that are scoped with `is_manager_of_campus`.
- Negative suite (`20_negative.sql`) proves cross-campus actions are rejected:
  - `TEST 2a`: manager of DeKUT inserting a zone into kisii campus → rejected by RLS.
  - `TEST 2c`: region manager updating a zone in Nyeri campus → rejected.
  - `TEST 3a/3b/3c`: campus `status`/`slug`/`region_id` updates → 0 rows.
  - `TEST 4a` NEW manager → RLS violation; `4b/4c` role/scope changes → 0 rows.
  - `TEST 5b` cross-campus suspend → 0 rows; `5d` cross-campus approve → 0 rows.

### A5. roles inconsistent: `student|agent|admin|manager|super_admin` schema (confirmed → fixed)

- Live check before: `profiles_role_check` = 5 values incl. `super_admin`; no
  `manager` usage existed at the app layer as its own role.
- Fix: `20260808000001` performs `UPDATE profiles SET role='admin'
  WHERE role='super_admin'`, then narrows the CHECK constraint to
  `('student','agent','manager','admin')`, and tightens
  `is_campus_super_admin()` to `role = 'admin'` only.
- Verified live: `super_admin` rows remaining = **0**; distinct roles now
  `admin, agent, student` (+ `manager` if/when assigned).
- Sandbox: `profiles_role_check` shows exactly 4 roles after migration;
  `is_campus_super_admin()` under the converted admin (`.a1`) → **t**.

### A8. Extra admin row / dangling `super_admin` in code (confirmed → fixed)

- `src/lib/utils/admin.ts` used `isAdminUser` with `role === 'admin' ||
  'super_admin'`; push notifications queried both roles.
- Now centralized on `role === 'admin'` everywhere:
  - `src/lib/utils/admin.ts`, `src/lib/utils/manager.ts`
  - `src/lib/push.ts` (`getAdminUserIds` → `.eq('role','admin')`)
  - `src/app/(dashboard)/layout.tsx`
  - `src/app/actions/*` (manager assignments `'manager'` only)
- No `super_admin` string remains in `src/**` (only historical comments removed).

---

## Part B — Confirmed & verified positive behavior

### B1. Campus assignment backfill

`20260807000002` printed: `Backfill complete: listings.campus_id=45,
agents.campus_id=8, profiles.campus_id=237`.

### B2. Campus region backfill

`20260808000000` backfills `campuses.region_id` from `city` when a county name
matches. Verified live: DeKUT `city='Nyeri'` → `region_id` = Nyeri UUID.

### B3. Read-only regions

- `20260808000000` applies `regions_block_writes` policy (deny all writes) so
  unprivileged roles cannot modify the 47-county reference table.
- Region UI is display-only: no create/edit/delete actions remain (see
  `Files changed`).

### B4. Role model + promotion matrix (as requested)

| Action | Who can do it | Code path |
|---|---|---|
| student → agent | manager (approve application), admin | `manager-approveAgentApplication`, `assignManagerRoleAction` |
| agent → manager | admin | `searchAgentsToPromoteAction` → `assignManagerRoleAction('manager')` |
| agent → student | admin (demote) | `updateUserRoleAction(.., 'student')` |
| manager → agent | admin (demote) | `updateUserRoleAction(.., 'agent')` |
| create `super_admin` | nobody | not in the model |

- `updateUserRoleAction` signature tightened to `'student' | 'agent'` in
  `src/app/actions/admin.ts:498`.
- `promoteStudentToAgentAction` sets profile role to `'agent'` and creates agent
  row (`admin.ts:415`).
- `assignManagerRoleAction` hard-asserts `'manager'` (`src/app/actions/staff.ts`).

---

## Part C — Regression negatives (sandbox, Postgres 16)

Full scope re-runs:

```
TEST 1 — is_manager_of_campus scoping (RLS helper)
  1a manager_dekut on OWN dekut campus            PASS (t)
  1b manager_dekut on kisii campus                PASS (f)
  1c region manager (Kisumu) on kisii campus      PASS (t)
  1d region manager (Kisumu) on dekut/Nyeri      PASS (f)
  1e student on any campus                        PASS (f)

TEST 2 — manager creates zone on another campus   REJECTED (RLS)
  2a manager_dekut INSERT zone into kisii         PASS (error: RLS violation)
  2b manager_dekut INSERT zone into OWN dekut     PASS (unique constraint on re-run)

TEST 3 — manager writes slug/status/region_id     0 rows changed
  3a campus.status write → 0 rows
  3b campus.slug write → 0 rows
  3c campus.region_id write → 0 rows

TEST 4 — manager creates/edits/demotes another manager
  4a INSERT manager profile → RLS violation
  4b demote manager_kisii → 0 rows
  4c scope change → 0 rows

TEST 5 — cross-campus suspend + application review
  5a manager_a suspend OWN c1            PASS (affected=1)
  5b manager_a suspend kisii c2          PASS (0 rows)
  5c manager_a approve DeKUT d1          PASS (UPDATE 1)
  5d manager_a approve kisii d2          PASS (0 rows)
  5e region manager approve kisii d2     PASS (UPDATE 1)
  5f admin acts anywhere                 PASS (UPDATE 1)
```

Result compute in live DB: `is_manager_of_campus(NULL)` etc. called from an
unprivileged endpoint returns `false` (safe default).

---

## Applied migrations (live)

Run with `supabase db push` from this repo; all 11 migrations applied in order,
ending `Finished supabase db push.`

```
20260807000000_add_campuses.sql
20260807000001_add_campus_columns.sql
20260807000002_backfill_campus.sql
20260807000003_campus_not_null.sql
20260807000004_add_agent_applications.sql
20260807000005_manager_campus_rls.sql
20260807000006_add_campus_metadata.sql
20260807000007_campus_routing.sql
20260807000008_add_regions_and_zones.sql
20260808000000_seed_counties_and_contact.sql   (new this phase)
20260808000001_unify_roles.sql                 (new this phase)
```

Rollbacks live in `supabase/migrations/_rollback/` (one `.down.sql` per new
migration) and reset the roles CHECK to the pre-merge 5 values and delete the
old helper definitions.

---

## Live verification (after push)

- `regions` rows = **47** (`SELECT id,name …` — Baringo, Bomet, Bungoma …)
  — query runs, no error.
- `SELECT count(*) FROM regions` = **47**.
- `profiles` distinct roles = `admin , agent , student` (`super_admin` = **0**).
- DeKUT campus `region_id` = Nyeri UUID (backfill hit).
- `is_manager_of_campus(<fake>)` RPC = `false` (no error).

---

## File/UI references

- `src/app/(admin)/admin/campuses/page.tsx` — `getAllCampuses` fallback.
- `src/app/(admin)/admin/campuses/campuses-table-client.tsx` — region display.
- `src/app/(admin)/admin/regions/regions-client.tsx` — read-only catalog.
- `src/app/(admin)/admin/regions/page.tsx` — read path only.
- `src/app/(admin)/admin/managers/managers-table-client.tsx`,
  `assign-manager-sheet.tsx` — agent-first search + shadcn Sheet.
- `src/app/(admin)/admin/agents/agents-table-client.tsx` — Make Manager,
  role-to-admin removed.
- `src/app/(admin)/admin/agents/[id]/agent-detail-client.tsx` — demote-only
  role control + Manager badge.
- `src/app/(admin)/admin/users/users-table-client.tsx` — no Make-Admin buttons.
- `src/app/(manager)/manager/staff/{page,staff-client}.tsx` — manager-only.
- `src/types/index.ts` — 4-role UserRole.
- `src/lib/utils/{admin,manager}.ts`, `src/lib/push.ts`, dashboard layout.
- `src/app/actions/{admin,staff,manager,campus-settings}.ts`.

### UI component reuse strategy

- Assign-manager UI built from existing shadcn primitives (`Sheet`,
  `Dialog`, `Command/Combobox`, `Avatar`).
- Tables reuse the existing `tables/data-table` conventions and the existing
  count-badge pattern on the overview card.
- No new icon/Token/etc. library was introduced; only existing Rumia tokens
  and components.