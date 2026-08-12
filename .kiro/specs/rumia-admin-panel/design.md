# Design Document: Rumia Admin Panel

## Overview

The Rumia Admin Panel is a multi-page internal dashboard that replaces the existing single-page tab-based admin view (`/admin`) with a proper sidebar-navigated layout spanning six distinct pages. It is exclusively accessible to the platform owner (Paul) and provides operational control over agents, listings, leads, and commissions.

The panel is built entirely on the existing stack: **Next.js 15 App Router**, **Supabase** (PostgreSQL + Auth), **Tailwind CSS**, and the existing Radix UI component library. It sits inside the `(dashboard)` route group and introduces a new nested route group `(admin)` with its own layout that replaces the existing top-nav bar layout with a sidebar layout for all `/admin` routes.

### Key Design Decisions

- **New route group `(admin)`**: Admin pages need a completely different layout (sidebar) from the existing agent dashboard (top navbar). A nested `(admin)` route group with its own `layout.tsx` achieves this without touching the existing `(dashboard)/layout.tsx`.
- **Server Components first**: All data fetching happens in Server Components (page files) using `createClient()`. No client-side data fetching except for optimistic UI updates after mutations.
- **Server Actions for mutations**: All writes (mark paid, suspend agent, create commission) are Server Actions in `src/app/actions/admin.ts`, keeping mutation logic server-side and allowing `revalidatePath` to refresh stale RSC data.
- **Reuse existing UI components**: `Sheet` (slide-over panel), `ConfirmationDialog`, `Badge`, `Button`, `Dialog`, `Table` from `src/components/ui/` are used as-is. No new primitive components are introduced.
- **Client components are wrappers**: Interactive pages receive pre-fetched data as props from their Server Component page file and handle local UI state (filter state, modal open state, optimistic toggles) client-side.

---

## Architecture

### Route Structure

```
src/app/
└── (admin)/                          ← NEW nested route group
    ├── layout.tsx                    ← Admin layout: sidebar + content area
    ├── admin/
    │   └── page.tsx                  ← Overview page  (/admin)
    ├── admin/agents/
    │   ├── page.tsx                  ← Agents list page
    │   └── [id]/
    │       └── page.tsx              ← Agent detail page
    ├── admin/listings/
    │   └── page.tsx                  ← Listings page
    ├── admin/leads/
    │   └── page.tsx                  ← Leads page
    └── admin/commissions/
        └── page.tsx                  ← Commissions page
```

> **Note on route group nesting**: Next.js allows multiple route groups at the same level. The `(admin)` group is a sibling of `(dashboard)` and `(public)` under `src/app/`. The URL path `/admin` is unchanged — route groups are layout-only containers.

### Data Flow

```
Browser Request
    │
    ▼
middleware.ts ──── unauthenticated? ──→ redirect /auth/login
    │
    ▼
(admin)/layout.tsx  ──── non-admin email? ──→ redirect /dashboard
    │                    (Server Component, Supabase auth check)
    ▼
page.tsx (Server Component)
    │  fetchs data via supabase queries
    ▼
<PageClient /> (Client Component)
    │  receives data as props
    │  manages filter state, modal state
    ▼
Server Action called on mutation
    │  revalidatePath('/admin/...')
    ▼
RSC re-renders with fresh data
```

### Authorization Layer

Authorization is enforced at two layers:

1. **Middleware** (`middleware.ts`): Already redirects unauthenticated users away from `/admin`. No changes needed.
2. **Admin layout** (`(admin)/layout.tsx`): Server Component that re-checks `supabase.auth.getUser()` and validates the email against the admin predicate. This is the authoritative check; middleware is defense-in-depth.

The `isAdmin` predicate is extracted into a shared utility:

```typescript
// src/lib/utils/admin.ts
export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower === 'paul@rumia.co.ke' || lower.includes('admin');
}
```

---

## Components and Interfaces

### Admin Layout (`(admin)/layout.tsx`)

Server Component. Fetches the authenticated user, runs the admin check, then renders the sidebar + content shell.

```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
}
```

**Sidebar** (`AdminSidebar`) — client component for active link highlighting using `usePathname()`.

```
┌─────────────────────────────────────────────────────┐
│  ┌──────┐  │                                         │
│  │ Logo │  │         Main Content Area               │
│  └──────┘  │         (flex-1, p-8)                   │
│            │                                         │
│  Overview  │                                         │
│  Agents    │                                         │
│  Listings  │                                         │
│  Leads     │                                         │
│  Commiss.. │                                         │
│            │                                         │
│  ──────    │                                         │
│  Paul      │                                         │
│  [Logout]  │                                         │
└─────────────────────────────────────────────────────┘
  240px fixed    flex-1
```

### Page Components

Each admin page follows the same pattern:

| File | Type | Responsibility |
|---|---|---|
| `page.tsx` | Server Component | Auth guard, data fetch, passes props |
| `*-client.tsx` | Client Component | Filter state, modal state, optimistic mutations |

#### Overview Page Components

- `OverviewPage` (Server) → fetches stat data + recent leads + top agents
- `StatCard` — pure presentational, accepts `{ label, value, icon, trend? }`
- `RecentLeadsTable` — client, navigates on row click
- `TopAgentsTable` — pure presentational, renders relative bar indicator

#### Agents Page Components

- `AgentsPage` (Server) → fetches agents with computed metrics
- `AgentsTableClient` (Client) → handles suspend/activate actions, "Add Agent" sheet open state
- `AddAgentSheet` (Client) → wraps existing `Sheet` component, form fields, calls `createAgentAction`

#### Agent Detail Page Components

- `AgentDetailPage` (Server) → fetches agent profile, listings, leads, commissions
- `AgentDetailClient` (Client) → manages confirmation dialog state, calls mutation actions

#### Listings Page Components

- `ListingsPage` (Server) → fetches listings + agents list for filter dropdown
- `ListingsTableClient` (Client) → manages filter state (agent, status, location), load-more cursor, confirmation dialogs

#### Leads Page Components

- `LeadsPage` (Server) → fetches leads + agents + listings for filter dropdowns
- `LeadsTableClient` (Client) → manages filter state, "Create Commission" modal open state
- `CreateCommissionModal` — wraps existing `Dialog`, pre-fills agent/listing, amount input

#### Commissions Page Components

- `CommissionsPage` (Server) → fetches commissions + summary totals + agents for filter
- `CommissionsTableClient` (Client) → manages filter state, calls `markCommissionPaidAction`

### Server Actions (`src/app/actions/admin.ts`)

All admin mutations live in a single `'use server'` file:

```typescript
// Agent actions
createAgentAction(data: CreateAgentInput): Promise<ActionResult>
updateAgentStatusAction(agentId: string, status: 'active' | 'suspended'): Promise<ActionResult>

// Listing actions
updateListingActiveAction(listingId: string, isActive: boolean): Promise<ActionResult>
deleteListingAction(listingId: string): Promise<ActionResult>

// Commission actions
createCommissionAction(data: CreateCommissionInput): Promise<ActionResult>
markCommissionPaidAction(commissionId: string): Promise<ActionResult>

// Auth guard: every action re-checks isAdmin before executing
type ActionResult = { success: true } | { success: false; error: string }
```

Every Server Action:
1. Calls `supabase.auth.getUser()` and validates `isAdminEmail(user.email)`
2. Performs the mutation
3. Calls `revalidatePath` on the relevant admin route(s)

---

## Data Models

The admin panel reads from and writes to the existing Supabase tables. No schema changes are required. Below are the relevant columns per table:

### `agents`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Display name |
| `phone` | `text` | |
| `whatsapp` | `text` | |
| `commission_balance` | `numeric` | Running pending KES balance |
| `status` | `text` | `'active'` \| `'suspended'` |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `created_at` | `timestamptz` | Join date |

### `listings`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | |
| `title` | `text` | |
| `location` | `text` | |
| `price` | `numeric` | Monthly price KES |
| `is_active` | `boolean` | |
| `agent_id` | `uuid` | FK → `agents.id` |
| `created_at` | `timestamptz` | |

### `leads`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | |
| `listing_id` | `uuid` | FK → `listings.id` |
| `agent_id` | `uuid` | FK → `agents.id` |
| `clicked_at` | `timestamptz` | WhatsApp click timestamp |
| `ip_hash` | `text` | SHA-256 hashed client IP |

### `commissions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | |
| `agent_id` | `uuid` | FK → `agents.id` |
| `listing_id` | `uuid` | FK → `listings.id` |
| `amount` | `numeric` | KES |
| `status` | `text` | `'pending'` \| `'paid'` |
| `created_at` | `timestamptz` | |
| `paid_at` | `timestamptz` \| `null` | Set when marked paid |

> **`paid_at` column**: The requirements specify recording the paid timestamp (Requirements 8.6, 11.4). If this column does not yet exist, a migration `ALTER TABLE commissions ADD COLUMN paid_at timestamptz` is required.

### TypeScript Interfaces (Extended)

The existing `src/types/index.ts` interfaces need the following additions:

```typescript
// Extended Agent with admin-specific fields
export interface AdminAgent extends Agent {
  status: 'active' | 'suspended';
  created_at: string;
  // Computed fields (from joins/aggregations)
  active_listings_count?: number;
  total_leads_count?: number;
  pending_commissions_sum?: number;
}

// Extended Commission with timestamps
export interface AdminCommission extends Commission {
  created_at: string;
  paid_at: string | null;
  // Join fields
  agents?: { name: string; id: string } | null;
  listings?: { title: string; id: string } | null;
}

// Extended Lead with join fields
export interface AdminLead extends Lead {
  listings?: { title: string; id: string } | null;
  agents?: { name: string; id: string } | null;
}

export interface CreateAgentInput {
  name: string;
  phone: string;
  whatsapp: string;
}

export interface CreateCommissionInput {
  agent_id: string;
  listing_id: string;
  amount: number;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature has pure aggregation and filtering functions that operate on in-memory data, and an authorization predicate — all well-suited for property-based testing. The property-based testing library is **fast-check** (`npm install --save-dev fast-check`), which is idiomatic for TypeScript/Jest projects.

### Property 1: isAdminEmail — admin predicate is exact

*For any* email string, `isAdminEmail` returns `true` if and only if the lowercased email equals `"paul@rumia.co.ke"` or contains the substring `"admin"`. All other strings return `false`.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: Active listings count is accurate

*For any* array of listings with arbitrary `is_active` boolean values, the count of active listings computed by the stat card equals the number of items in the array where `is_active === true`.

**Validates: Requirements 3.2**

---

### Property 3: Pending commissions sum is accurate

*For any* array of commissions with arbitrary amounts and statuses, the pending KES total equals the sum of `amount` fields for all commissions where `status === 'pending'`.

**Validates: Requirements 3.4, 11.3**

---

### Property 4: Active agents count is accurate

*For any* array of agents with arbitrary `status` values, the active agent count equals the number of items where `status === 'active'`.

**Validates: Requirements 3.5**

---

### Property 5: Monthly leads filter is accurate

*For any* array of leads with arbitrary `clicked_at` timestamps and any reference date, the monthly leads count equals the number of leads whose `clicked_at` timestamp falls within the same calendar month as the reference date.

**Validates: Requirements 3.3**

---

### Property 6: Top agents ranking is sorted descending by lead count

*For any* array of agents and leads for a given month, the output of the top-agents ranking function produces agents in non-increasing order of their lead count for that month.

**Validates: Requirements 5.1**

---

### Property 7: Per-agent commission owed is accurate

*For any* agent ID and array of commissions, the commission owed for that agent equals the sum of `amount` fields for all commissions where `agent_id` matches and `status === 'pending'`.

**Validates: Requirements 5.2**

---

### Property 8: Listings filter matches all active criteria

*For any* array of listings and any combination of filter values (agent ID, status, location text), the filtered result contains only listings where every non-empty filter criterion is satisfied simultaneously.

**Validates: Requirements 9.3, 9.4**

---

### Property 9: Leads filter matches all active criteria

*For any* array of leads and any combination of filter values (agent ID, start date, end date, listing ID), the filtered result contains only leads where every non-empty filter criterion is satisfied simultaneously.

**Validates: Requirements 10.5, 10.6**

---

### Property 10: Commissions filter matches all active criteria

*For any* array of commissions and any combination of filter values (agent ID, status, start date, end date), the filtered result contains only commissions where every non-empty filter criterion is satisfied simultaneously.

**Validates: Requirements 11.5, 11.6**

---

**Property Reflection:**

- Properties 3 and 7 both test pending commission sums, but at different granularities. Property 3 is the total across all agents; Property 7 is per-agent. They test different aspects of the same aggregation logic and are not redundant.
- Properties 8, 9, and 10 test the same filtering pattern (multi-criterion AND-filter) applied to different entity types. They are structurally similar but test distinct filter schemas and cannot be collapsed without losing traceability to specific requirements.
- Properties 2 and 4 are both count-of-filtered-items patterns on different entities. They remain separate for requirements traceability.

---

## Error Handling

### Authentication / Authorization Errors

| Scenario | Handling |
|---|---|
| No Supabase session in layout | `redirect('/auth/login')` |
| Authenticated but not admin in layout | `redirect('/dashboard')` |
| Non-admin calls a Server Action | Return `{ success: false, error: 'Unauthorized' }` (action re-checks auth) |

### Server Action Errors

- `createAgentAction`: If `supabase.auth.admin.createUser()` fails, return error immediately without inserting the agent row (prevents orphaned records — Requirement 7.4).
- `markCommissionPaidAction`: Set both `status = 'paid'` and `paid_at = new Date().toISOString()` in a single `update` call. If the update fails, return error and do not update local state.
- All actions use try/catch and return typed `ActionResult` objects; client components display `toast.error(result.error)` on failure via `sonner`.

### Data Integrity

- `deleteListingAction` should only delete the listing row. Cascade deletes on `leads.listing_id` and `commissions.listing_id` depend on FK constraints in Supabase. If no cascade is set, leads and commissions referencing the listing will have a null join — the admin UI should handle null join fields gracefully (display "Deleted Listing").
- `commission_balance` on the `agents` table is maintained by the existing `track-lead` API route. The admin `markCommissionPaidAction` does **not** decrement `commission_balance` to avoid double-accounting (the existing tab-based admin code did this, but it is a derived value best kept in sync by the lead creation path only).

### UI Error States

- Tables with no rows render an empty state message (e.g., "No agents registered.").
- Filter combinations that produce no results render "No results match your filters." with a "Clear filters" button.
- Failed Server Actions display `toast.error(...)` via `sonner` (already in the provider stack).

---

## Testing Strategy

### Unit Tests (Jest + Testing Library)

Focused on pure utility functions and data-transformation logic:

- `isAdminEmail(email)` — multiple example inputs (admin email, non-admin email, edge cases)
- `computeStatCardValues(listings, leads, commissions, agents)` — integration of the aggregation helpers
- `filterListings(listings, filters)` — concrete filter examples
- `filterLeads(leads, filters)` — concrete filter examples
- `filterCommissions(commissions, filters)` — concrete filter examples
- `rankAgentsByLeads(agents, leads, month)` — sort order examples

### Property-Based Tests (Jest + fast-check)

Each test runs a minimum of 100 iterations. Tests are tagged with a comment referencing the design property they verify.

**Tag format:** `// Feature: rumia-admin-panel, Property N: <property_text>`

Property tests to implement:

| Test | Property | fast-check Arbitraries |
|---|---|---|
| `isAdminEmail` predicate | Property 1 | `fc.emailAddress()`, `fc.string()` |
| Active listings count | Property 2 | `fc.array(fc.record({ is_active: fc.boolean(), ...listingFields }))` |
| Pending commissions sum | Property 3 | `fc.array(fc.record({ amount: fc.float({ min: 0 }), status: fc.constantFrom('pending','paid') }))` |
| Active agents count | Property 4 | `fc.array(fc.record({ status: fc.constantFrom('active','suspended') }))` |
| Monthly leads filter | Property 5 | `fc.array(fc.record({ clicked_at: fc.date() }))` |
| Top agents ranking | Property 6 | `fc.array(agentArb)`, `fc.array(leadArb)` |
| Per-agent commission owed | Property 7 | `fc.uuid()`, `fc.array(commissionArb)` |
| Listings multi-filter | Property 8 | `fc.array(listingArb)`, `fc.record(listingFiltersArb)` |
| Leads multi-filter | Property 9 | `fc.array(leadArb)`, `fc.record(leadsFiltersArb)` |
| Commissions multi-filter | Property 10 | `fc.array(commissionArb)`, `fc.record(commissionsFiltersArb)` |

### Integration Tests (Cypress E2E)

Smoke-level coverage for the critical path:

- Admin login → overview page renders stat cards
- Agents page → open Add Agent sheet → submit form → success toast
- Commissions page → Mark as Paid → row status updates

### What is NOT tested with PBT

- UI rendering and layout (sidebar 240px, stat card layout) — snapshot tests
- Server Action authorization guard — example-based unit test with mocked Supabase client
- `createAgentAction` Supabase Auth integration — integration test with Supabase test environment
