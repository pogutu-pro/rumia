# Requirements Document

## Introduction

The Rumia Admin Panel is a private internal dashboard accessible exclusively to Paul, the platform owner. It provides a comprehensive interface for managing agents, listings, leads, and commissions on the Rumia platform. The panel is built on the existing Next.js 16 App Router stack with Supabase for database and authentication, and Tailwind CSS for styling. It replaces the current single-page tab-based admin view with a proper multi-page sidebar layout that mirrors a clean, modern SaaS dashboard aesthetic (similar to Linear or Vercel).

All admin routes live under `/admin`. The design is desktop-first, internal-facing, and focused entirely on operational efficiency for the platform owner.

## Glossary

- **Admin_Panel**: The complete set of pages and components accessible under the `/admin` route, exclusively available to the authenticated administrator account.
- **Admin_Layout**: The persistent sidebar layout rendered by `/admin/layout.tsx` that wraps all admin pages.
- **Sidebar**: The 240px fixed left-side navigation component inside the Admin_Layout containing the Rumia logo, navigation links, and the account/logout section.
- **Overview_Page**: The dashboard home page at `/admin`, displaying summary stats and recent activity.
- **Agents_Page**: The page at `/admin/agents` displaying all registered agents in a table.
- **Agent_Detail_Page**: The page at `/admin/agents/[id]` showing a single agent's full profile, listings, leads, and commissions.
- **Listings_Page**: The page at `/admin/listings` displaying all platform listings in a filterable table.
- **Leads_Page**: The page at `/admin/leads` displaying the full log of WhatsApp click events.
- **Commissions_Page**: The page at `/admin/commissions` displaying all commission records.
- **Add_Agent_Panel**: The slide-over panel (not a separate page) opened from the Agents_Page for creating a new agent.
- **Create_Commission_Modal**: The modal dialog opened from the Leads_Page for manually creating a commission record from a lead.
- **Stat_Card**: A summary widget on the Overview_Page displaying a single key metric.
- **Status_Badge**: A colored pill label indicating the state of an entity (Active, Inactive, Pending, Paid, Suspended).
- **Server_Component**: A Next.js React Server Component that fetches data directly on the server without a client-side fetch.
- **Server_Action**: A Next.js server-side function called from client components or forms to perform mutations.
- **Supabase_Auth**: The authentication system provided by Supabase used to identify and authorize the administrator.
- **Agent**: A registered platform user who manages listings and earns commissions from leads.
- **Listing**: A hostel property record associated with an Agent.
- **Lead**: A recorded WhatsApp button click event attributed to a Listing and Agent.
- **Commission**: A payment record linking an Agent to a Listing with an amount and payment status.

---

## Requirements

### Requirement 1: Admin Route Protection

**User Story:** As Paul (the platform owner), I want all `/admin` routes to be exclusively accessible to my administrator account, so that no other user can view or modify platform data through the admin panel.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any route under `/admin`, THE Admin_Panel SHALL redirect the user to `/auth/login`.
2. WHEN an authenticated non-admin user navigates to any route under `/admin`, THE Admin_Panel SHALL redirect the user to `/dashboard`.
3. THE Admin_Panel SHALL determine administrator status by checking if the authenticated user's email matches `paul@rumia.co.ke` or contains `admin`.
4. WHEN the Supabase_Auth session cannot be verified, THE Admin_Panel SHALL treat the request as unauthenticated and redirect to `/auth/login`.

---

### Requirement 2: Admin Layout and Sidebar Navigation

**User Story:** As Paul, I want a persistent sidebar layout across all admin pages, so that I can navigate between sections without losing context.

#### Acceptance Criteria

1. THE Admin_Layout SHALL render a fixed 240px-wide sidebar on the left side of every page under `/admin`.
2. THE Sidebar SHALL display the Rumia logo at the top.
3. THE Sidebar SHALL contain navigation links for: Overview (`/admin`), Agents (`/admin/agents`), Listings (`/admin/listings`), Leads (`/admin/leads`), and Commissions (`/admin/commissions`).
4. WHEN a navigation link corresponds to the currently active route, THE Sidebar SHALL render that link with a highlighted active state.
5. THE Sidebar SHALL display Paul's account name and a logout button at the bottom.
6. WHEN the logout button is clicked, THE Admin_Layout SHALL sign the user out via Supabase_Auth and redirect to `/auth/login`.
7. THE Admin_Layout SHALL render a main content area to the right of the Sidebar that fills the remaining viewport width with 32px padding.
8. THE Admin_Layout SHALL use Server_Components for data fetching where possible and Server_Actions for mutations.

---

### Requirement 3: Overview Page — Summary Statistics

**User Story:** As Paul, I want to see key platform metrics at a glance on the overview page, so that I can quickly assess platform health without navigating to individual sections.

#### Acceptance Criteria

1. THE Overview_Page SHALL display four Stat_Cards in a horizontal row at the top of the page.
2. THE first Stat_Card SHALL display the total count of listings where `is_active = true`.
3. THE second Stat_Card SHALL display the total count of Leads recorded within the current calendar month.
4. THE third Stat_Card SHALL display the total sum of Commission amounts where `status = 'pending'`, formatted in KES.
5. THE fourth Stat_Card SHALL display the total count of Agents where `status = 'active'`.
6. THE Overview_Page SHALL render all Stat_Card data using Server_Components fetching from Supabase.

---

### Requirement 4: Overview Page — Recent Leads Table

**User Story:** As Paul, I want to see the most recent lead activity on the overview page, so that I can monitor engagement without navigating to the full leads log.

#### Acceptance Criteria

1. THE Overview_Page SHALL display a Recent Leads table showing the last 10 Lead records ordered by `clicked_at` descending.
2. THE Recent Leads table SHALL include columns: Listing Name, Agent Name, Date, and Time.
3. WHEN a row in the Recent Leads table is clicked, THE Overview_Page SHALL navigate to the full listing page at `/listing/[id]`.

---

### Requirement 5: Overview Page — Top Agents This Month

**User Story:** As Paul, I want to see which agents are generating the most leads this month, so that I can identify top performers and commissions owed.

#### Acceptance Criteria

1. THE Overview_Page SHALL display a Top Agents section showing agents ranked by their Lead count for the current calendar month in descending order.
2. THE Top Agents section SHALL display each agent's name, number of leads for the month, and commission owed (sum of pending Commission amounts for that agent).
3. THE Top Agents section SHALL display a relative bar indicator for each agent showing their lead count relative to the highest-performing agent.
4. THE Overview_Page SHALL render the Top Agents section alongside the Recent Leads table in a two-column side-by-side layout.

---

### Requirement 6: Agents Page — Agent Table

**User Story:** As Paul, I want to view all registered agents in a table with key metrics, so that I can monitor agent activity and manage their accounts.

#### Acceptance Criteria

1. THE Agents_Page SHALL display a table of all agents with columns: Agent Name, Phone/WhatsApp, Active Listings (count), Total Leads (all time count), Commission Pending (KES sum of pending commissions), and Status Badge.
2. THE Status_Badge for agents SHALL render as a green pill for `active` status and a gray pill for `suspended` status.
3. WHEN an agent's name is clicked in the Agents_Page table, THE Agents_Page SHALL navigate to `/admin/agents/[id]`.
4. THE Agents_Page table SHALL include an Actions column with a "View Profile" link and a "Suspend"/"Activate" toggle button per row.
5. WHEN the "Suspend" button is clicked for an active agent, THE Agents_Page SHALL display a confirmation dialog before updating the agent's status to `suspended` in Supabase.
6. WHEN the "Activate" button is clicked for a suspended agent, THE Agents_Page SHALL update the agent's status to `active` in Supabase without requiring confirmation.
7. THE Agents_Page SHALL display an "Add Agent" button in the top-right area of the page.

---

### Requirement 7: Agents Page — Add Agent Slide-Over Panel

**User Story:** As Paul, I want to add new agents from the agents page without leaving it, so that I can quickly register agents and return to the overview.

#### Acceptance Criteria

1. WHEN the "Add Agent" button is clicked on the Agents_Page, THE Add_Agent_Panel SHALL open as a slide-over panel from the right side without navigating to a separate page.
2. THE Add_Agent_Panel SHALL include input fields for: Name, Phone number, and WhatsApp number.
3. WHEN the Add_Agent_Panel form is submitted with valid data, THE Add_Agent_Panel SHALL create a Supabase_Auth user account and an agent record linked via `user_id`.
4. IF the Supabase_Auth user creation fails, THEN THE Add_Agent_Panel SHALL display a descriptive error message and not create an orphaned agent record.
5. WHEN the agent is successfully created, THE Add_Agent_Panel SHALL close, display a success notification, and refresh the agents table.

---

### Requirement 8: Agent Detail Page

**User Story:** As Paul, I want to view a full profile for each agent including their listings, leads, and commissions, so that I can manage individual agent activity from one place.

#### Acceptance Criteria

1. THE Agent_Detail_Page SHALL display the agent's name, phone, WhatsApp number, and join date at the top of the page.
2. THE Agent_Detail_Page SHALL display a grid of the agent's listings, each showing the listing title and an Edit and Deactivate/Activate option.
3. WHEN the Deactivate option is selected on a listing in the Agent_Detail_Page, THE Agent_Detail_Page SHALL display a confirmation dialog before setting `is_active = false` in Supabase.
4. THE Agent_Detail_Page SHALL display a leads table showing all Lead records attributed to that agent, with columns: Date, Time, Listing Name.
5. THE Agent_Detail_Page SHALL display a commissions table showing all Commission records for that agent, with columns: Listing Name, Amount (KES), Status Badge, Date Created.
6. WHEN the "Mark Commission Paid" button is clicked on a pending commission row in the Agent_Detail_Page, THE Agent_Detail_Page SHALL update the commission `status` to `paid` and record the current timestamp as the paid date in Supabase.
7. IF a destructive action is initiated on the Agent_Detail_Page, THEN THE Agent_Detail_Page SHALL display a confirmation dialog before executing the action.

---

### Requirement 9: Listings Page — Filterable Table

**User Story:** As Paul, I want to browse all platform listings with filtering and inline actions, so that I can efficiently manage listing visibility and accuracy.

#### Acceptance Criteria

1. THE Listings_Page SHALL display a table with columns: Photo Thumbnail, Hostel Name, Location, Price, Agent Name, Leads Count, Status Badge, and Created Date.
2. THE Status_Badge for listings SHALL render as a green pill for `active` status and a gray pill for `inactive` status.
3. THE Listings_Page SHALL provide filter controls at the top of the table for: Agent (dropdown), Status (All / Active / Inactive), and Location (text search).
4. WHEN a filter value changes, THE Listings_Page SHALL update the displayed results to show only listings matching all active filters.
5. THE Listings_Page SHALL include an Actions column per row with: "View Live" (link to `/listing/[id]`), "Edit", "Deactivate/Activate", and "Delete".
6. WHEN the "Delete" action is triggered for a listing, THE Listings_Page SHALL display a confirmation dialog before permanently deleting the record from Supabase.
7. WHEN the "Deactivate" action is triggered for an active listing, THE Listings_Page SHALL display a confirmation dialog before setting `is_active = false`.
8. WHEN the number of listings exceeds 20, THE Listings_Page SHALL display a "Load More" button to reveal additional listings rather than using pagination.

---

### Requirement 10: Leads Page — Lead Log Table

**User Story:** As Paul, I want a full log of all WhatsApp click events with filtering, so that I can verify leads before manually creating commissions.

#### Acceptance Criteria

1. THE Leads_Page SHALL display a table of all Lead records with columns: Date and Time, Listing Name, Agent Name, and IP Hash.
2. THE Listing Name column in the Leads_Page SHALL render as a link to the live listing at `/listing/[id]`.
3. THE Agent Name column in the Leads_Page SHALL render as a link to the agent detail page at `/admin/agents/[id]`.
4. THE Leads_Page SHALL display a note at the top stating that each row represents one WhatsApp button click and that commissions are created manually by the admin after verifying placement.
5. THE Leads_Page SHALL provide filter controls for: Agent (dropdown), Date Range (start date and end date), and Listing (dropdown or text search).
6. WHEN filter values are changed, THE Leads_Page SHALL update the displayed results to show only leads matching all active filters.
7. THE Leads_Page SHALL display a "Create Commission" button per row.
8. WHEN the "Create Commission" button is clicked for a lead row, THE Create_Commission_Modal SHALL open with Agent and Listing fields pre-filled from the lead data.
9. THE Create_Commission_Modal SHALL include an Amount (KES) input field.
10. WHEN the Create_Commission_Modal form is submitted with a valid amount, THE Create_Commission_Modal SHALL insert a new Commission record with `status = 'pending'` into Supabase and display a success notification.

---

### Requirement 11: Commissions Page — Commission Table

**User Story:** As Paul, I want to view all commission records with summary totals and be able to mark commissions as paid, so that I can track and manage agent payouts.

#### Acceptance Criteria

1. THE Commissions_Page SHALL display a table with columns: Agent Name, Listing Name, Amount (KES), Status Badge, Date Created, and Date Paid.
2. THE Status_Badge for commissions SHALL render as a green pill for `paid` status and an amber pill for `pending` status.
3. THE Commissions_Page SHALL display two summary numbers in the top-right area: total pending KES (sum of amounts where `status = 'pending'`) and total paid KES (sum of amounts where `status = 'paid'`).
4. WHEN the "Mark as Paid" button is clicked for a pending commission row, THE Commissions_Page SHALL update the commission `status` to `paid` and record the current timestamp as `paid_at` in Supabase.
5. THE Commissions_Page SHALL provide filter controls for: Agent (dropdown), Status (Pending / Paid), and Date Range.
6. WHEN filter values are changed, THE Commissions_Page SHALL update the displayed results to show only commissions matching all active filters.
7. THE "Mark as Paid" button SHALL only appear on rows where the commission `status` is `pending`.

---

### Requirement 12: Design System and Visual Standards

**User Story:** As Paul, I want the admin panel to have a consistent, professional visual design, so that the interface is clear and efficient to use.

#### Acceptance Criteria

1. THE Admin_Panel SHALL use white surface backgrounds for content areas with no decorative background elements.
2. THE Admin_Panel SHALL apply a light gray background (`hover:bg-gray-50`) on table row hover states.
3. THE Admin_Panel SHALL render Status_Badges as pill-shaped labels: green for Active/Paid, amber for Pending, and gray for Inactive/Suspended.
4. WHEN a destructive action is triggered anywhere in the Admin_Panel, THE Admin_Panel SHALL display a confirmation dialog before executing the action.
5. THE Admin_Panel SHALL use a 24px font size for page titles, 16px for table headers, and 14px for table body text.
6. THE Admin_Panel SHALL be designed for desktop viewport sizes and is not required to support mobile layouts for the MVP.
7. THE Admin_Panel SHALL use Next.js Server_Components for all data-fetching operations where possible.
8. THE Admin_Panel SHALL use Next.js Server_Actions for all data mutation operations.
