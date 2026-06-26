---
name: ui-quality-gate
description: Shared UI quality guardrails for all DineOS agents. Use this skill whenever a task touches user-facing UI, UX copy, visual design, accessibility, or print layouts. Prevents low-quality "AI-slop" UI changes.
---

# UI Quality Gate (All Agents)

This skill defines the minimum bar for UI work across build, review, QA, and product triage.

## Scope
Apply this skill when a task touches any of the following:
- Frontend pages/components in `src/app` or `src/components`
- Styling (`globals.css`, component CSS, Tailwind utility classes)
- User-visible copy, labels, empty states, error states
- Receipts, print output, reports, and checkout/payment UX
- Navigation, table states, product grids, dialogs, form flows

If no UI surface is touched, this skill is optional.

## Non-negotiables
1. Never ship UI that is unclear, inconsistent, or visually broken at desktop or mobile widths.
2. Never ship user-facing text that is only in one language where bilingual strings are required.
3. Never ship money display that breaks USD/KHR formatting or rounding rules.
4. Never remove important context from cashier workflows (table, totals, payment state, exchange rate).
5. Never introduce generic low-intent layouts ("AI slop"): random spacing, default typography, weak hierarchy, inconsistent buttons.

## DineOS UI standards
- Preserve established DineOS visual language unless task explicitly asks for redesign.
- Keep actions obvious and safe: destructive actions require clear confirmation.
- Use readable hierarchy: primary action visually dominant, secondary actions subdued.
- Support keyboard and touch use cases where practical.
- Maintain accessible contrast and clear focus states.
- Avoid layout shift during async/loading operations.

## Currency and business-critical UX
- USD must render with 2 decimals.
- KHR must render with comma grouping and nearest-100 rounding.
- Payment screen must always make these obvious:
  - Total due
  - Amount received
  - Change due or insufficient amount
- Mixed USD/KHR payment must stay understandable in one glance.

## Bilingual and copy quality
- Add/modify both English and Khmer strings for user-visible text in `src/lib/i18n.ts`.
- Use plain cashier-friendly wording; avoid technical/internal jargon.
- Error messages must say what happened and what user can do next.

## Layout and interaction quality checklist
Before considering UI work done, verify:
- [ ] Desktop and compact/mobile layouts are readable and usable
- [ ] No clipped text, overlapping controls, or horizontal overflow
- [ ] Loading, empty, success, and error states are all handled
- [ ] Primary workflows require minimal clicks/taps
- [ ] Interactive targets are large enough for touch
- [ ] Visual state differences are obvious (selected, disabled, active, error)

## Print and receipt quality checklist
For any print/receipt/report changes, verify:
- [ ] Thermal print width constraints are respected (no column overflow)
- [ ] Money columns align and remain legible
- [ ] USD/KHR symbols and separators are correct
- [ ] No noisy decorative output that wastes paper

## Agent-specific use
- coder:
  - Apply this skill before implementing any UI change.
  - If acceptance criteria are vague, choose the clearer, safer cashier-first UX.
- code-reviewer:
  - Fail review if any checklist item above is violated.
  - Require concrete fix instructions, not generic feedback.
- qa-agent:
  - Validate flows from user behavior, not component internals.
  - File separate bugs for visual breakage, wording confusion, and money-display issues.
- advisor:
  - Write UI tasks with explicit acceptance criteria from this skill.
  - Include desktop + mobile + state handling expectations.
- pos-customer:
  - Prioritize real-world clarity for cashier/owner workflows over developer convenience.

## Definition of done for UI tasks
A UI task is done only if:
1. It satisfies task acceptance criteria.
2. It passes this UI Quality Gate.
3. It does not regress bilingual text, money display, or checkout clarity.
