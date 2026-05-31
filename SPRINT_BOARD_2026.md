# Dine OS POS - Sprint Board 2026

Scope:
- Roadmap delivery excluding permission-system redesign
- Reuse and extend existing pages/tabs only
- Real-time dashboard features must have normal-refresh fallback

## Planning Assumptions

- Sprint length: 2 weeks
- Team: 1 full-stack pod (frontend + tauri/rust + migration)
- Estimation scale: Fibonacci story points (1, 2, 3, 5, 8, 13)
- Definition of done:
  - Backend command/API implemented
  - Frontend integrated into existing page/tab
  - Migration/backfill complete where needed
  - QA checklist passed

## Existing Surface Reuse Map

Use these existing views instead of adding parallel modules:
- Super admin operations: src/app/super-admin/page.tsx
- Super admin releases/settings context: src/app/super-admin/releases
- Business dashboard shell and tabs: src/app/management/page.tsx and src/app/management/views
- Analytics/history/reporting: src/app/management/analytics, src/app/history/page.tsx
- Table visibility: src/app/management/tables and existing table/session data
- Close flow/report outputs: existing orders/history/report functions and print/report helpers
- Downloads removal target: src/components/layout/SidebarNav.tsx and related downloads route/menu entry points

## Real-Time Fallback Policy

For every feature marked live or real-time:
- Preferred mode: periodic auto-refresh (polling)
- Fallback mode: normal/manual refresh on page load + Refresh button
- UI must indicate last refresh time
- No feature blocks release if event streaming is unavailable

---

## Phase 1 - Super Admin Operations

### Sprint 1 (Target: 28-34 points)

#### Ticket P1-01 - Subscription filter engine and UI chips
- Points: 8
- Dependencies: none
- Page reuse:
  - src/app/super-admin/page.tsx
- Backend work:
  - Add query filters for: 30d, 15d, 7d, today, expired, active
- Frontend work:
  - Filter bar and count chips above existing business list
- Acceptance:
  - Counts and filtered list match exactly
  - Default state shows active subscriptions

#### Ticket P1-02 - Subscription alert cards with badge count
- Points: 5
- Dependencies: P1-01
- Page reuse:
  - src/app/super-admin/page.tsx header/stats area
- Behavior:
  - Auto-refresh every 60-120s when available
  - Manual refresh always available
- Acceptance:
  - 30/15/7/expired alert cards show correct counts
  - Clicking card applies matching filter

#### Ticket P1-03 - Business category field and migration
- Points: 8
- Dependencies: none
- Page reuse:
  - Business create/edit forms in src/app/super-admin/page.tsx
- Data:
  - Add business_category column
  - Backfill legacy rows to Other
- Acceptance:
  - New and existing businesses display a category
  - Filtering by category works

#### Ticket P1-04 - Additional admin account creation flow
- Points: 8
- Dependencies: none
- Page reuse:
  - Existing user/admin modals in src/app/super-admin/page.tsx
- Acceptance:
  - Super admin can create multiple admin accounts
  - New admins can login and access required operational tools

#### Ticket P1-05 - Super admin activity log hooks (create/update admin, license update)
- Points: 3
- Dependencies: P1-04
- Page reuse:
  - Backend only now; UI optional in later sprint
- Acceptance:
  - Action records captured for core super admin operations

### Sprint 2 (Target: 24-30 points)

#### Ticket P1-06 - Expiry-follow-up workflow improvements
- Points: 5
- Dependencies: P1-01, P1-02
- Page reuse:
  - src/app/super-admin/page.tsx
- Scope:
  - Quick action from filtered list to open business details and extend license
- Acceptance:
  - Renewal follow-up is <= 3 clicks from dashboard

#### Ticket P1-07 - Category analytics quick breakdown card
- Points: 3
- Dependencies: P1-03
- Page reuse:
  - Super admin stat cards on src/app/super-admin/page.tsx
- Acceptance:
  - Category distribution visible at a glance

#### Ticket P1-08 - QA hardening and date-boundary tests
- Points: 5
- Dependencies: P1-01, P1-02, P1-03
- Scope:
  - Timezone/date edge cases for expiration statuses
- Acceptance:
  - Test checklist passes with no off-by-one-day issues

#### Ticket P1-09 - UI copy and empty-state polish
- Points: 3
- Dependencies: P1-01 to P1-04
- Acceptance:
  - Clear labels for active/expired/expiring states

#### Ticket P1-10 - Performance pass for business list filtering
- Points: 5
- Dependencies: P1-01, P1-03
- Acceptance:
  - Smooth filtering at 1k+ businesses

---

## Phase 2 - Business Admin Dashboard

### Sprint 3 (Target: 26-32 points)

#### Ticket P2-01 - Live revenue dashboard widgets in existing analytics tab
- Points: 8
- Dependencies: none
- Page reuse:
  - src/app/management/analytics
  - src/app/management/views/AnalyticsView.tsx
- Widgets:
  - Today revenue, current revenue, transactions, orders, performance summary
- Real-time fallback:
  - Auto-refresh preferred; manual refresh + load-time refresh always supported
- Acceptance:
  - Dashboard is usable without real-time events

#### Ticket P2-02 - Active table monitoring panel in existing tables tab
- Points: 8
- Dependencies: none
- Page reuse:
  - src/app/management/tables
- Fields:
  - Table number, bill amount, check-in, duration, status
- Real-time fallback:
  - Auto-refresh preferred; fallback to periodic polling/manual refresh
- Acceptance:
  - Panel updates correctly and does not require cashier actions page

#### Ticket P2-03 - Last-updated timestamp and refresh controls standard
- Points: 3
- Dependencies: P2-01, P2-02
- Page reuse:
  - Management analytics/tables views
- Acceptance:
  - All live widgets show last updated time and refresh control

#### Ticket P2-04 - Dashboard reconciliation checks
- Points: 5
- Dependencies: P2-01
- Acceptance:
  - Widget totals reconcile with report/order data

### Sprint 4 (Target: 24-30 points)

#### Ticket P2-05 - Historical report center in existing history/report surfaces
- Points: 8
- Dependencies: none
- Page reuse:
  - src/app/history/page.tsx
  - src/app/management/orders
- Views:
  - Daily, weekly, monthly summaries
  - Revenue history and sales history filters
- Acceptance:
  - Filtered history exports and render time within acceptable target

#### Ticket P2-06 - Weekly/monthly aggregate APIs and indexes
- Points: 8
- Dependencies: P2-05
- Acceptance:
  - Aggregation performance stable on larger datasets

#### Ticket P2-07 - Export consistency pass
- Points: 3
- Dependencies: P2-05
- Acceptance:
  - Exported totals match displayed totals

---

## Phase 3 - Cashier And Daily Operations

### Sprint 5 (Target: 28-34 points)

#### Ticket P3-01 - Expense entry table in report close flow
- Points: 13
- Dependencies: none
- Page reuse:
  - Existing close/report flow (orders/history/report print helpers)
- UI requirements:
  - Excel-style rows with add/edit/remove before submission
- Columns:
  - Date, description, amount
- Acceptance:
  - Unlimited rows supported
  - Validation blocks malformed entries

#### Ticket P3-02 - Closing summary with net revenue calculation
- Points: 8
- Dependencies: P3-01
- Formula:
  - Net revenue = total sales - total expenses
- Acceptance:
  - Summary and stored report are identical

#### Ticket P3-03 - Printable close report enhancement
- Points: 5
- Dependencies: P3-02
- Must include:
  - Total sales, total expenses, net revenue, report date, cashier info
- Acceptance:
  - Printed output matches on-screen close summary

---

## Phase 4 - Data Accuracy And Maintenance

### Sprint 6 (Target: 24-30 points)

#### Ticket P4-01 - Duplicate report cleanup (soft-delete)
- Points: 8
- Dependencies: none
- Page reuse:
  - Existing history/report admin surfaces
- Acceptance:
  - Duplicate cleanup hides from normal totals but retains audit trace

#### Ticket P4-02 - Void receipt management in revenue logic
- Points: 8
- Dependencies: none
- Acceptance:
  - Voided transactions excluded from revenue calculations
  - Voids remain visible in audit trail

#### Ticket P4-03 - Paid-only receipt history filter default
- Points: 5
- Dependencies: P4-02
- Page reuse:
  - src/app/history/page.tsx and existing receipt print history flow
- Acceptance:
  - Pending/cancelled/voided excluded by default

#### Ticket P4-04 - Remove Downloads section safely
- Points: 3
- Dependencies: none
- Page reuse:
  - Remove button/menu from existing navigation components
- Acceptance:
  - No broken route links; no hidden dependency remains

---

## Dependency Summary

Critical path:
- P1-01 -> P1-02 -> P1-06
- P1-03 -> category filters and super-admin organization
- P3-01 -> P3-02 -> P3-03

Parallelizable:
- P1-03 and P1-04 can run in parallel with P1-01
- P2-01 and P2-02 can run in parallel
- P4 tickets mostly parallel, except P4-03 depends on P4-02

## Release Gates

Gate A (after Sprint 2):
- Subscription operations complete (monitoring + alerts + categories + extra admins)

Gate B (after Sprint 4):
- Business owner monitoring and historical center complete
- Real-time fallback behavior validated

Gate C (after Sprint 5):
- Expense-inclusive close workflow and printable financial summary complete

Gate D (after Sprint 6):
- Maintenance and data integrity hardening complete
- Downloads surface removed safely

## Backlog Parking Lot (Post-v1)

- Push notifications/email for expiration alerts
- Admin activity log viewer UI
- Advanced anomaly detection for duplicate reports
- Scheduled report exports
