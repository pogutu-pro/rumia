# Implementation Plan: Rumia Admin Panel

## Overview

Replace the existing single-page tab-based admin view with a multi-page sidebar-navigated admin panel under `/admin`. The implementation follows the Server Component-first pattern, introduces a new `(admin)` route group with its own layout, and consolidates all admin mutations into a single Server Actions file. Pure utility functions for aggregation and filtering are extracted first so they can be property-tested in parallel with the UI work.

## Tasks

- [x] 1. Extract and test admin utility functions
  - Create `src/lib/utils/admin.ts` with the `isAdminEmail` predicate
  - Create `src/lib/utils/admin-stats.ts` with pure aggregation helpers: `countActiveListings`, `countMonthlyLeads`, `sumPendingCommissions`, `countActiveAgents`
  - Create `src/lib/utils/admin-filters.ts` with pure filter functions: `filterListings`, `filterLeads`, `filterCommissions`
  - Create `src/lib/utils/admin-rankings.ts` with `rankAgentsByLeads` and `computeAgentCommissionOwed`
  - _Requirements: 1.3, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 9.3, 9.4, 10.5, 10.6, 11.5, 11.6_

  - [ ] 1.1 Write property test for `isAdminEmail` predicate
    - **Property 1: isAdminEmail — admin predicate is exact**
    - **Validates: Requirements 1.2, 1.3**
    - Tag: `// Feature: rumia-admin-panel, Property 1: isAdminEmail admin predicate is exact`
    - Use `fc.emailAddress()` and `fc.string()` arbitraries
    - Assert `true` iff lowercased input equals `"paul@rumia.co.ke"` or contains `"admin"`

  - [ ] 1.2 Write property test for active listings count
    - **Property 2: Active listings count is accurate**
    - **Validates: Requirements 3.2**
    - Tag: `// Feature: rumia-admin-panel, Property 2: Active listings count is accurate`
    - Use `fc.array(fc.record({ is_active: fc.boolean() }))` arbitrary

  - [ ] 1.3 Write property test for pending commissions sum
    - **Property 3: Pending commissions sum is accurate**
    - **Validates: Requirements 3.4, 11.3**
    - Tag: `// Feature: rumia-admin-panel, Property 3: Pending commissions sum is accurate`
    - Use `fc.array(fc.record({ amount: fc.float({ min: 0 }), status: fc.constantFrom('pending','paid') }))` arbitrary

  - [ ] 1.4 Write property test for active agents count
    - **Property 4: Active agents count is accurate**
    - **Validates: Requirements 3.5**
    - Tag: `// Feature: rumia-admin-panel, Property 4: Active agents count is accurate`
    - Use `fc.array(fc.record({ status: fc.constantFrom('active','suspended') }))` arbitrary

  - [ ] 1.5 Write property test for monthly leads filter
    - **Property 5: Monthly leads filter is accurate**
    - **Validates: Requirements 3.3**
    - Tag: `// Feature: rumia-admin-panel, Property 5: Monthly leads filter is accurate`
    - Use `fc.array(fc.record({ clicked_at: fc.date() }))` and `fc.date()` for reference date

  - [ ] 1.6 Write property test for top agents ranking
    - **Property 6: Top agents ranking is sorted descending by lead count**
    - **Validates: Requirements 5.1**
    - Tag: `// Feature: rumia-admin-panel, Property 6: Top agents ranking is sorted descending by lead count`
    - Use agent and lead arbitraries; verify result array is non-increasing by lead count

  - [ ] 1.7 Write property test for per-agent commission owed
    - **Property 7: Per-agent commission owed is accurate**
    - **Validates: Requirements 5.2**
    - Tag: `// Feature: rumia-admin-panel, Property 7: Per-agent commission owed is accurate`
    - Use `fc.uuid()` for agent ID and a commission array arbitrary

  - [ ] 1.8 Write property test for listings multi-filter
    - **Property 8: Listings filter matches all active criteria**
    - **Validates: Requirements 9.3, 9.4**
    - Tag: `// Feature: rumia-admin-panel, Property 8: Listings filter matches all active criteria`
    - Use `fc.array(listingArb)` and `fc.record(listingFiltersArb)`; verify AND-filter semantics

  - [ ] 1.9 Write property test for leads multi-filter
    - **Property 9: Leads filter matches all active criteria**
    - **Validates: Requirements 10.5, 10.6**
    - Tag: `// Feature: rumia-admin-panel, Property 9: Leads filter matches all active criteria`
    - Use `fc.array(leadArb)` and `fc.record(leadsFiltersArb)`; verify AND-filter semantics

  - [ ] 1.10 Write property test for commissions multi-filter
    - **Property 10: Commissions filter matches all active criteria**
    - **Validates: Requirements 11.5, 11.6**
    - Tag: `// Feature: rumia-admin-panel, Property 10: Commissions filter matches all active criteria`
    - Use `fc.array(commissionArb)` and `fc.record(commissionsFiltersArb)`; verify AND-filter semantics

- [x] 2. Add TypeScript interfaces and install fast-check
  - Install `fast-check` as a dev dependency: `pnpm add -D fast-check`
  - Add `AdminAgent`, `AdminCommission`, `AdminLead`, `CreateAgentInput`, `CreateCommissionInput` interfaces to `src/types/index.ts` (or create `src/types/admin.ts`)
  - _Requirements: 12.7, 12.8_

- [x] 3. Create admin Server Actions
  - Create `src/app/actions/admin.ts` with `'use server'` directive
  - Implement `createAgentAction(data: CreateAgentInput)`: calls `supabase.auth.admin.createUser()` first; on failure returns error without inserting agent row; on success inserts agent record with `user_id` and calls `revalidatePath('/admin/agents')`
  - Implement `updateAgentStatusAction(agentId: string, status: 'active' | 'suspended')`: updates `agents.status`; calls `revalidatePath('/admin/agents')` and `revalidatePath('/admin/agents/' + agentId)`
  - Implement `updateListingActiveAction(listingId: string, isActive: boolean)`: updates `listings.is_active`; calls `revalidatePath('/admin/listings')` and `revalidatePath('/admin')`
  - Implement `deleteListingAction(listingId: string)`: deletes listing row; calls `revalidatePath('/admin/listings')`
  - Implement `createCommissionAction(data: CreateCommissionInput)`: inserts commission with `status = 'pending'`; calls `revalidatePath('/admin/commissions')` and `revalidatePath('/admin/leads')`
  - Implement `markCommissionPaidAction(commissionId: string)`: sets `status = 'paid'` and `paid_at = new Date().toISOString()` in a single update; calls `revalidatePath('/admin/commissions')` and `revalidatePath('/admin/agents')`
  - Every action must re-check `isAdminEmail(user.email)` and return `{ success: false, error: 'Unauthorized' }` if not admin
  - _Requirements: 1.1, 1.3, 7.3, 7.4, 8.6, 9.5, 9.6, 10.10, 11.4, 12.8_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create Admin route group layout and sidebar
  - Create `src/app/(admin)/layout.tsx` as a Server Component: fetches authenticated user via `createClient()`, calls `isAdminEmail`, redirects to `/auth/login` if unauthenticated and `/dashboard` if authenticated but not admin; renders the `AdminSidebar` and a `<main>` content area with `flex-1` and `p-8`
  - Create `src/app/(admin)/admin-sidebar.tsx` as a Client Component using `usePathname()` for active link highlighting; renders the Rumia logo, nav links (Overview, Agents, Listings, Leads, Commissions), and an account/logout section at the bottom; sidebar is fixed 240px wide
  - The logout button must call Supabase `signOut()` and redirect to `/auth/login`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 6. Implement Overview Page
  - Create `src/app/(admin)/admin/page.tsx` as a Server Component: query Supabase for stat card data (active listings count, current-month leads count, pending commissions sum, active agents count), last 10 leads ordered by `clicked_at` desc with listing and agent joins, and top-agents-this-month data using the utility functions from Task 1; pass all data as props to `<OverviewClient />`
  - Create `src/app/(admin)/admin/overview-client.tsx` as a Client Component rendering: four `StatCard` components in a horizontal row, a `RecentLeadsTable` (rows navigate to `/listing/[id]` on click), and a `TopAgentsTable` with relative bar indicators; the two tables are side-by-side in a two-column layout
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

- [x] 7. Implement Agents Page
  - Create `src/app/(admin)/admin/agents/page.tsx` as a Server Component: query all agents and compute per-agent metrics (active listings count, total leads count, pending commissions sum) using Supabase joins/aggregates; pass data as props to `<AgentsTableClient />`
  - Create `src/app/(admin)/admin/agents/agents-table-client.tsx` as a Client Component with: agent table (columns: Name, Phone/WhatsApp, Active Listings, Total Leads, Commission Pending, Status Badge), a "View Profile" link per row navigating to `/admin/agents/[id]`, a "Suspend"/"Activate" toggle button with confirmation dialog for suspend (no confirmation for activate), and an "Add Agent" button in the top-right that opens `<AddAgentSheet />`
  - Create `src/app/(admin)/admin/agents/add-agent-sheet.tsx` wrapping the existing `Sheet` component with form fields for Name, Phone, and WhatsApp; on submit calls `createAgentAction`; on success closes the sheet, shows `toast.success`, and router.refresh; on failure shows `toast.error(result.error)`
  - Status badge: green pill for `active`, gray pill for `suspended`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 12.3_

- [x] 8. Implement Agent Detail Page
  - Create `src/app/(admin)/admin/agents/[id]/page.tsx` as a Server Component: query agent profile by ID; query agent's listings, all leads attributed to the agent ordered by `clicked_at` desc, and all commissions for the agent; redirect to `/admin/agents` if agent not found; pass all data to `<AgentDetailClient />`
  - Create `src/app/(admin)/admin/agents/[id]/agent-detail-client.tsx` as a Client Component with: profile header (name, phone, WhatsApp, join date), listings grid (title + Deactivate/Activate option with confirmation dialog for deactivate), leads table (columns: Date, Time, Listing Name), and commissions table (columns: Listing Name, Amount KES, Status Badge, Date Created) with a "Mark Commission Paid" button on pending rows
  - "Mark Commission Paid" calls `markCommissionPaidAction`; on success shows `toast.success` and router.refresh
  - Deactivate listing calls `updateListingActiveAction(id, false)`; on success shows `toast.success` and router.refresh
  - All destructive actions (deactivate listing) must show `ConfirmationDialog` before executing
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 12.4_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Listings Page
  - Create `src/app/(admin)/admin/listings/page.tsx` as a Server Component: query all listings with agent join for the photo thumbnail, name, location, price, agent name, leads count (aggregate), status, and created date; also query all agents for the filter dropdown; pass data to `<ListingsTableClient />`
  - Create `src/app/(admin)/admin/listings/listings-table-client.tsx` as a Client Component with: filter bar (Agent dropdown, Status dropdown All/Active/Inactive, Location text search), listings table (columns: Photo Thumbnail, Hostel Name, Location, Price, Agent Name, Leads Count, Status Badge, Created Date, Actions), and actions per row ("View Live" link to `/listing/[id]`, "Edit" link to `/dashboard` edit flow, "Deactivate/Activate" with confirmation for deactivate, "Delete" with `ConfirmationDialog variant="danger"`)
  - Filter state is managed client-side using the `filterListings` utility from Task 1
  - When listing count exceeds 20, display a "Load More" button to reveal additional listings
  - Status badge: green pill for `active`, gray pill for `inactive`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 12.2, 12.3, 12.4_

- [x] 11. Implement Leads Page
  - Create `src/app/(admin)/admin/leads/page.tsx` as a Server Component: query all leads with listing and agent joins; query all agents and listings for filter dropdowns; pass data to `<LeadsTableClient />`
  - Create `src/app/(admin)/admin/leads/leads-table-client.tsx` as a Client Component with: informational note at the top about commissions being created manually, filter bar (Agent dropdown, Date Range start/end, Listing dropdown), leads table (columns: Date and Time, Listing Name as link to `/listing/[id]`, Agent Name as link to `/admin/agents/[id]`, IP Hash, Create Commission button per row)
  - Filter state is managed client-side using the `filterLeads` utility from Task 1
  - "Create Commission" button opens `<CreateCommissionModal />` with Agent and Listing pre-filled from the lead row
  - Create `src/app/(admin)/admin/leads/create-commission-modal.tsx` wrapping `Dialog` with Agent (read-only display), Listing (read-only display), and Amount (KES) input; on submit calls `createCommissionAction`; on success closes modal and shows `toast.success`; on failure shows `toast.error(result.error)`
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [x] 12. Implement Commissions Page
  - Create `src/app/(admin)/admin/commissions/page.tsx` as a Server Component: query all commissions with agent and listing joins; compute summary totals (total pending KES, total paid KES) server-side using `sumPendingCommissions`; query all agents for filter dropdown; pass data to `<CommissionsTableClient />`
  - Create `src/app/(admin)/admin/commissions/commissions-table-client.tsx` as a Client Component with: summary numbers in top-right (total pending KES, total paid KES), filter bar (Agent dropdown, Status Pending/Paid, Date Range), commissions table (columns: Agent Name, Listing Name, Amount KES, Status Badge, Date Created, Date Paid, Mark as Paid button)
  - "Mark as Paid" button only appears on rows where `status === 'pending'`; calls `markCommissionPaidAction`; on success shows `toast.success` and router.refresh
  - Filter state is managed client-side using the `filterCommissions` utility from Task 1
  - Status badge: green pill for `paid`, amber pill for `pending`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.3_

- [x] 13. Wire up routing and migrate existing admin page
  - Move the existing `src/app/(dashboard)/admin/` files aside (rename to `src/app/(dashboard)/admin/_old/`) so they no longer conflict with the new route
  - Verify that all new admin routes (`/admin`, `/admin/agents`, `/admin/agents/[id]`, `/admin/listings`, `/admin/leads`, `/admin/commissions`) resolve correctly under the new `(admin)` route group
  - Update the link in `src/app/(dashboard)/layout.tsx` (`href="/admin"`) to confirm it still points to the correct URL (no change needed; route group is transparent in URLs)
  - Confirm the `paid_at` column exists on the `commissions` table; if not, note the required migration: `ALTER TABLE commissions ADD COLUMN paid_at timestamptz;`
  - _Requirements: 1.1, 1.2, 2.1, 2.7, 12.6_

- [x] 14. Apply design system standards and empty states
  - Audit all new admin pages and ensure: white surface backgrounds on content areas, `hover:bg-gray-50` on table row hover states, 24px font for page titles, 16px for table headers, 14px for table body text
  - Add empty state messages to all tables: "No agents registered.", "No listings found.", "No leads recorded.", "No commission records.", and "No results match your filters." with a "Clear filters" button for filtered-empty states
  - Ensure all Status badges render as pill-shaped labels: green for Active/Paid, amber for Pending, gray for Inactive/Suspended
  - Reuse `src/components/ui/status-badge.tsx` or `src/components/ui/status-pill.tsx` if they match the design; otherwise create inline badge components consistent with the existing pattern in `admin-dashboard.tsx`
  - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Run `pnpm test` and verify all property and unit tests pass
  - Run `pnpm typecheck` and resolve any TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `fast-check` must be installed before running property tests (`pnpm add -D fast-check`)
- Property tests run via Jest (`pnpm test`); each property is tagged with `// Feature: rumia-admin-panel, Property N: <text>`
- The `(admin)` route group is a sibling of `(dashboard)` under `src/app/` — URL paths are unchanged
- The `paid_at` column on `commissions` may require a Supabase migration before `markCommissionPaidAction` can set it
- The existing `src/app/(dashboard)/admin/` files must be retired (Task 13) to avoid route conflicts with the new `(admin)` group
- All destructive actions require `ConfirmationDialog` before execution (Requirement 12.4)
- Server Actions must never be called from the admin layout's auth guard — that guard uses plain `redirect()` only
