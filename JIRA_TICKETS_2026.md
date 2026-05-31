# Dine OS POS - Jira Ticket Drafts (Roadmap 2026)

Format:
- Key: Proposed ticket ID
- Type: Story
- Points: Fibonacci estimate
- Dependencies: Upstream tickets
- Scope rule: Reuse existing pages/tabs; do not create duplicate modules
- Real-time rule: If real-time not feasible, ship normal refresh mode

---

## Phase 1 - Super Admin Operations

### P1-01 - Subscription filter engine and UI chips
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - src/app/super-admin/page.tsx
- Description:
  - Implement subscription expiry filter categories in Super Admin business list.
  - Add filter chips with counts: 30 days, 15 days, 7 days, today, expired, active.
- Backend tasks:
  - Add/extend query layer for date-based filter buckets.
- Frontend tasks:
  - Add filter controls and active filter state persistence during list navigation.
- Acceptance criteria:
  - Filters return correct businesses and counts.
  - Active excludes expired businesses.
  - List sort by nearest expiry supported.

### P1-02 - Subscription alert cards with dashboard badge
- Type: Story
- Points: 5
- Dependencies: P1-01
- Affected existing surfaces:
  - src/app/super-admin/page.tsx
- Description:
  - Add alert cards and alert badge count on existing Super Admin dashboard.
- Tasks:
  - Show 30/15/7/expired counts.
  - Clicking card applies matching list filter.
- Refresh mode:
  - Preferred: periodic auto-refresh.
  - Fallback: manual refresh + load-time refresh.
- Acceptance criteria:
  - Counts match filter results exactly.
  - Refresh updates counts without navigation reset.

### P1-03 - Business category field and legacy migration
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - src/app/super-admin/page.tsx (create/edit business forms)
- Description:
  - Add category assignment to business create/edit and enable category filtering.
- Category set:
  - Restaurant, Cafe, Bakery, Mart, Convenience Store, Bar, Hotel, Other
- Data tasks:
  - Add business_category field migration.
  - Backfill existing records as Other.
- Acceptance criteria:
  - New businesses require/select category.
  - Existing businesses show Other after migration.
  - Category filter works in list.

### P1-04 - Additional admin account creation flow
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - src/app/super-admin/page.tsx (existing admin/user modal flows)
- Description:
  - Enable creation of multiple admin accounts from Super Admin UI.
- Tasks:
  - Extend current create-user flow for admin role creation.
  - Keep all changes inside existing super-admin user management views.
- Acceptance criteria:
  - Multiple admin users can be created.
  - Created admin can sign in and access operational tools.

### P1-05 - Super Admin activity log hooks
- Type: Story
- Points: 3
- Dependencies: P1-04
- Affected existing surfaces:
  - Backend command layer only
- Description:
  - Add backend audit hooks for admin create/update/license updates.
- Acceptance criteria:
  - Audit records written for all targeted operations.

### P1-06 - Renewal follow-up quick workflow
- Type: Story
- Points: 5
- Dependencies: P1-01, P1-02
- Affected existing surfaces:
  - src/app/super-admin/page.tsx
- Description:
  - Provide direct follow-up action path from alert/filter result to business license update.
- Acceptance criteria:
  - Renewal action path in <= 3 clicks.

### P1-07 - Category distribution summary card
- Type: Story
- Points: 3
- Dependencies: P1-03
- Affected existing surfaces:
  - src/app/super-admin/page.tsx stats section
- Description:
  - Add category distribution insight card using existing dashboard card area.
- Acceptance criteria:
  - Displays counts by category with accurate totals.

### P1-08 - Expiry date boundary test pass
- Type: Story
- Points: 5
- Dependencies: P1-01, P1-02, P1-03
- Affected surfaces:
  - Backend + Super Admin UI
- Description:
  - Validate timezone and date-boundary behavior for all expiry filters and alerts.
- Acceptance criteria:
  - No off-by-one day mismatches in tested scenarios.

### P1-09 - UX copy and empty state polish
- Type: Story
- Points: 3
- Dependencies: P1-01 to P1-04
- Affected surfaces:
  - src/app/super-admin/page.tsx
- Description:
  - Improve labels/tooltips/empty states for subscription and category features.
- Acceptance criteria:
  - All new states have clear copy and no dead-end UX.

### P1-10 - Business list performance pass
- Type: Story
- Points: 5
- Dependencies: P1-01, P1-03
- Affected surfaces:
  - Super Admin business list data access
- Description:
  - Optimize filtering/sorting performance for larger business counts.
- Acceptance criteria:
  - Acceptable interaction speed at 1k+ businesses.

---

## Phase 2 - Business Admin Dashboard

### P2-01 - Revenue widgets in existing analytics tab
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - src/app/management/analytics
  - src/app/management/views/AnalyticsView.tsx
- Description:
  - Add dashboard widgets: today revenue, current revenue, transactions, orders, performance summary.
- Refresh mode:
  - Preferred: auto-refresh polling.
  - Fallback: manual refresh button and load-time refresh.
- Acceptance criteria:
  - Accurate values without requiring real-time infrastructure.

### P2-02 - Active table monitoring in existing tables tab
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - src/app/management/tables
- Description:
  - Add monitoring details: table number, bill amount, check-in, duration, status.
- Refresh mode:
  - Preferred: periodic updates.
  - Fallback: manual refresh.
- Acceptance criteria:
  - Data reflects table/session/order state accurately.

### P2-03 - Last-updated timestamp and refresh controls
- Type: Story
- Points: 3
- Dependencies: P2-01, P2-02
- Affected existing surfaces:
  - management analytics and tables screens
- Description:
  - Standardize refresh UX and last-updated display.
- Acceptance criteria:
  - Every live widget has visible refresh/updated state.

### P2-04 - Dashboard reconciliation check
- Type: Story
- Points: 5
- Dependencies: P2-01
- Description:
  - Verify dashboard aggregates reconcile with order/report source of truth.
- Acceptance criteria:
  - Signed-off reconciliation report.

### P2-05 - Historical report center using current history/report pages
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - src/app/history/page.tsx
  - src/app/management/orders
- Description:
  - Add daily/weekly/monthly slices, revenue/sales history filters and summaries.
- Acceptance criteria:
  - Reliable historical views with matching export totals.

### P2-06 - Aggregate APIs and indexing for weekly/monthly history
- Type: Story
- Points: 8
- Dependencies: P2-05
- Description:
  - Build/optimize backend queries for period summaries.
- Acceptance criteria:
  - Query latency acceptable for expected dataset size.

### P2-07 - Export consistency pass
- Type: Story
- Points: 3
- Dependencies: P2-05
- Description:
  - Ensure exported files match filtered screen totals and date ranges.
- Acceptance criteria:
  - No mismatch between UI and export outputs.

---

## Phase 3 - Cashier And Daily Operations

### P3-01 - Expense entry table in close-report workflow
- Type: Story
- Points: 13
- Dependencies: None
- Affected existing surfaces:
  - Existing report/close flow, history/report components
- Description:
  - Add Excel-style expense entry rows before report closing.
- Required columns:
  - Date, Description, Amount
- Behaviors:
  - Unlimited row add/edit/remove before final submit.
- Acceptance criteria:
  - Validation and row interactions fully functional.

### P3-02 - Net revenue review summary before finish
- Type: Story
- Points: 8
- Dependencies: P3-01
- Description:
  - Add pre-submit summary: total sales, total expenses, net revenue.
- Acceptance criteria:
  - Net formula and persisted report values match exactly.

### P3-03 - Printable close report enhancement
- Type: Story
- Points: 5
- Dependencies: P3-02
- Description:
  - Update printable close report to include sales/expenses/net/date/cashier.
- Acceptance criteria:
  - Printed report equals saved report data.

---

## Phase 4 - Maintenance And Data Accuracy

### P4-01 - Duplicate report cleanup with soft-delete
- Type: Story
- Points: 8
- Dependencies: None
- Affected existing surfaces:
  - Existing history/report maintenance actions
- Description:
  - Add duplicate cleanup and correction path using soft-delete and notes.
- Acceptance criteria:
  - Corrected reports excluded from normal totals and retained for audit.

### P4-02 - Void receipt handling in revenue calculations
- Type: Story
- Points: 8
- Dependencies: None
- Description:
  - Ensure voided receipts are excluded from revenue totals while retained for auditing.
- Acceptance criteria:
  - Daily/monthly totals unaffected by voids.

### P4-03 - Paid-only receipt history default
- Type: Story
- Points: 5
- Dependencies: P4-02
- Affected existing surfaces:
  - src/app/history/page.tsx and receipt print history flows
- Description:
  - Default receipt history to paid records only.
  - Exclude pending/cancelled/voided.
- Acceptance criteria:
  - Paid history list is clean and accurate.

### P4-04 - Remove Downloads UI section safely
- Type: Story
- Points: 3
- Dependencies: None
- Affected existing surfaces:
  - src/components/layout/SidebarNav.tsx
  - related downloads entry points/routes
- Description:
  - Remove downloads menu/button after verifying no active process dependency.
- Acceptance criteria:
  - No broken links; update process still accessible via intended path.

---

## Epic Grouping (Optional)

- EPIC-A: Super Admin Subscription Control (P1-01 to P1-10)
- EPIC-B: Business Monitoring Dashboard (P2-01 to P2-07)
- EPIC-C: Close Report Accounting (P3-01 to P3-03)
- EPIC-D: Data Integrity Maintenance (P4-01 to P4-04)

## Suggested Labels

- module:super-admin
- module:management
- module:history
- module:reporting
- module:dashboard
- module:migrations
- quality:financial-integrity
- mode:fallback-refresh
