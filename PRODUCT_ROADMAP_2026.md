# Dine OS POS - Product Roadmap 2026

Scope: This roadmap excludes role/permission redesign and focuses on feature delivery.

Execution constraints:
- Reuse or extend existing app pages/tabs/components whenever possible. Avoid creating duplicate modules for the same function.
- If full real-time implementation is not feasible, deliver a normal dashboard mode with load-time data, manual refresh, and optional polling refresh.

## 1. Vision And Delivery Strategy

Primary outcomes:
- Improve subscription control for platform operations
- Improve business-owner visibility without cashier workflow dependency
- Improve daily accounting accuracy
- Improve report and receipt integrity
- Remove unused navigation/feature clutter

Delivery model:
- Phase-based rollout with feature flags where needed
- Backward-compatible schema migrations
- Soft-delete + audit-first for corrective actions
- Measurable KPIs per phase

## 2. Phase Plan (Recommended Order)

### Phase 1 - Super Admin Operations (Priority 1)

#### 1. Subscription Expiration Monitoring
Feature goal:
- Fast filtering for renewal follow-up

Deliverables:
- Super Admin filter bar for:
  - Expiring within 30 days
  - Expiring within 15 days
  - Expiring within 7 days
  - Expiring today
  - Already expired
  - Active subscriptions
- Filter chips with counts
- Table/list sorting by expiry date ascending

Data/model changes:
- Ensure business record has:
  - license_expires_at (already exists)
  - optional subscription_status cache (derived or materialized)

Acceptance criteria:
- Each filter returns correct and non-overlapping set (except Active which excludes expired)
- Timezone-safe calculation using local business date logic
- Query performance remains acceptable with 1k+ businesses

#### 2. Subscription Alert System
Feature goal:
- Proactive alerts on dashboard

Deliverables:
- Alert cards:
  - 30-day expiry
  - 15-day expiry
  - 7-day expiry
  - expired accounts
- Alert badge count in Super Admin header/dashboard
- Click-through to pre-filtered list

System behavior:
- Compute alerts on dashboard load and periodic refresh
- Optional daily digest event for future notifications

Acceptance criteria:
- Counts match monitoring filters exactly
- Dashboard auto-refresh updates counts without full reload

#### 3. Business Category Management
Feature goal:
- Better customer account segmentation

Deliverables:
- Category field during business registration
- Category edit in business details
- Category filter in super admin business listing

Category list v1:
- Restaurant
- Cafe
- Bakery
- Mart
- Convenience Store
- Bar
- Hotel
- Other

Data/model changes:
- Add business_category column (string enum-like) to businesses
- Default to Other for legacy businesses

Acceptance criteria:
- Existing businesses migrate to Other
- Category can be changed and reflected immediately in list filters

#### 4. Additional Admin Account Creation
Feature goal:
- Reduce dependency on one platform account

Deliverables:
- Super Admin can create additional Admin users
- Admin users can access operational super-admin tools required for customer/account maintenance

Data/model changes:
- Reuse users table with admin role
- Add optional admin metadata: created_by, is_active

Acceptance criteria:
- New admin can authenticate and perform required account tasks
- Action logs capture who created/updated admin users

Phase 1 KPIs:
- 100% businesses categorized
- 0 missed renewals caused by visibility gap
- < 3 clicks to reach any expiring account segment

---

### Phase 2 - Business Admin Dashboard (Priority 2)

#### 5. Live Revenue Dashboard
Feature goal:
- Real-time business monitoring

Dashboard widgets:
- Today Revenue
- Current Revenue
- Number of Transactions
- Number of Orders
- Business performance summary

Deliverables:
- Auto-refresh dashboard (polling or event-driven)
- Date range toggle (Today default)
- Currency-safe display (USD/KHR support)
- Fallback mode: normal dashboard refresh on load + manual refresh button

Acceptance criteria:
- Values update automatically without page reload
- Revenue calculations match completed/paid transaction logic
- If auto-refresh is unavailable, manual refresh mode still provides complete and accurate dashboard values

#### 6. Active Table Monitoring
Feature goal:
- Operational visibility for owners/managers

Display fields:
- Table number
- Current bill amount
- Check-in time
- Duration of stay
- Current status

Deliverables:
- Monitoring panel separated from cashier action controls
- Real-time table status updates

Acceptance criteria:
- Duration updates continuously/periodically
- Table state stays consistent with active session/order records

#### 7. Historical Report Center
Feature goal:
- Structured access to past performance

Deliverables:
- Daily reports
- Weekly reports
- Monthly reports
- Revenue history
- Sales history
- Filter/export options (CSV/XLSX/PDF as available)

Acceptance criteria:
- Historical totals reconcile with operational orders and adjustments
- Large date ranges remain performant

Phase 2 KPIs:
- Business owners can access last 90 days of performance in under 5 seconds
- Daily dashboard usage increases week-over-week after release

---

### Phase 3 - Cashier And Daily Operations (Priority 3)

#### 8. Expense Recording During Report Closing
Feature goal:
- Accurate net revenue during close process

Deliverables:
- Expense entry table (Excel-style):
  - Date
  - Description
  - Amount
- Unlimited add rows
- Edit rows
- Remove rows before submission
- Close flow:
  1) Enter expenses
  2) Review summary
  3) Finish
  4) Generate report
  5) Printable output

Printed report includes:
- Total sales
- Total expenses
- Net revenue
- Report date
- Cashier information

Data/model changes:
- New expenses table tied to closing session/report_id
- Monetary amount as integer cents
- Optional soft-delete flag for correction workflow

Acceptance criteria:
- Net revenue = total sales - total expenses
- Closing report cannot finalize with invalid rows (empty description or negative amount unless explicitly allowed)
- Printable output matches saved report values

Phase 3 KPIs:
- Reduced manual post-closing corrections
- Improved accounting consistency between shift close and owner review

---

### Phase 4 - Admin Maintenance And Data Accuracy (Priority 4)

#### 9. Duplicate Report Cleanup
Feature goal:
- Correct duplicated/incorrect reports safely

Deliverables:
- Duplicate report finder (basic heuristics: same date, same totals, same source)
- Admin cleanup action with soft-delete
- Correction notes field

Acceptance criteria:
- No hard-delete of critical reports
- Cleaned reports excluded from standard business totals but retained for audit

#### 10. Void Receipt Management
Feature goal:
- Prevent void activity from inflating revenue

Deliverables:
- Revenue queries exclude voided transactions
- Voided items visible in audit/report detail section only

Acceptance criteria:
- Daily/monthly totals unaffected by voids
- Auditors can still trace void history

#### 11. Paid Receipt Only Printing History
Feature goal:
- Keep receipt history clean and actionable

Deliverables:
- Receipt history filter defaults to Paid
- Exclude:
  - Pending orders
  - Cancelled orders
  - Voided orders

Acceptance criteria:
- Printed-history list equals successful payment records

#### 12. Remove Downloads Section
Feature goal:
- Remove unused UI and simplify navigation

Deliverables:
- Remove Downloads button/menu
- Remove page/route hooks if unused
- Verify no active process depends on it

Acceptance criteria:
- No broken links/navigation
- Any required release/update process remains accessible via intended admin path

Phase 4 KPIs:
- Fewer reporting disputes
- Cleaner receipt operations and reduced user confusion

---

## 3. Engineering Work Breakdown

### Backend (Tauri/Rust)
- Add and migrate data columns/tables:
  - business_category
  - expenses
  - report cleanup metadata (soft-delete + reason)
- Add dashboard aggregate commands (real-time and historical)
- Add subscription alert aggregate command
- Update report/receipt queries to enforce paid-only and void exclusion
- Add maintenance commands for duplicate cleanup (soft-delete)

### Frontend (Next.js)
- Super Admin dashboard widgets and filters for subscription views
- Business registration/edit forms with category field
- Business dashboard cards + active table monitor
- Historical report center screens + filters/exports
- Expense entry grid in close-report flow
- Remove Downloads UI entry points

### Data And Migration
- Idempotent migrations with rollback plan
- Default category migration to Other
- Backfill/correct status fields where needed

### QA
- Financial reconciliation test pack
- Subscription date boundary tests (timezone/date edges)
- Close-report end-to-end tests
- Soft-delete visibility and audit integrity tests

---

## 4. Release Milestones

Milestone A (End Phase 1):
- Subscription monitoring + alert counters + category management + additional admin creation

Milestone B (End Phase 2):
- Live revenue dashboard + active table monitoring + historical report center

Milestone C (End Phase 3):
- Expense-on-close + printable net revenue summary

Milestone D (End Phase 4):
- Duplicate cleanup + void management + paid-only receipt history + downloads removal

---

## 5. Risk Register

- Financial calculation drift risk:
  - Mitigation: centralize revenue math and reconciliation tests
- Migration risk on existing installs:
  - Mitigation: additive migrations + safe defaults
- Report performance risk on large history:
  - Mitigation: indexes + pagination
- Operational behavior change risk:
  - Mitigation: staged rollout + feature toggles

---

## 6. Immediate Next Sprint (Suggested)

Sprint focus: Phase 1 foundation

Sprint backlog:
1. Add business_category data model + migration + UI fields
2. Implement subscription status filters and counts in super-admin list
3. Build subscription alert summary cards with click-through filters
4. Add additional admin creation flow and basic activity logging

Definition of done for sprint:
- Feature complete in UI + backend
- Migration tested on existing local DB
- Basic reconciliation tests for filter counts
- Demo-ready dashboard with real data
