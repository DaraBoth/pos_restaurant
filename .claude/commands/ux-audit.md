# /ux-audit

Audit DineOS UI/UX page-by-page using the ux-agent and file well-specced fix tasks in ORBIT for the coder.

## Usage
```
/ux-audit <task-id>
```
Or without an ID to run the default full-page sweep:
```
/ux-audit
```

## What this does
1. Loads the **ux-agent** subagent (`.claude/agents/ux-agent.md`).
2. The agent reads the specified ux task (or picks the next `assign:ux-agent` task) from ORBIT.
3. If no tasks are queued, runs the **default audit scope**: sweeps all pages in priority order (POS → Tables → Kitchen → History → Management → Login → …).
4. For each page: reads source files, applies all UI/UX checklists, optionally runs Playwright screenshots against http://localhost:3000.
5. Files one `wf:coder-task` ORBIT task per distinct issue found, assigned to `assign:coder`.
6. Marks the audit task `wf:done`.

## Arguments
- `$ARGUMENTS` — an ORBIT task ID for a specific ux audit area. If omitted, agent picks the next `assign:ux-agent` task, or runs the full default sweep.

## Audit priority order
Pages are audited largest-impact first:
1. `/pos` — main cashier screen
2. `/pos/tables` — table management
3. `/pos/kitchen` — kitchen display
4. `/history` — order history
5. `/management` — admin dashboard
6. `/management/products` — product catalog
7. `/management/orders` — order management
8. `/management/analytics` — analytics/reports
9. `/management/inventory` — inventory
10. `/login` — first impression
11. All remaining management sub-pages

## Output
Each issue becomes an ORBIT task with:
- Page and component file reference
- Concrete description of what is broken
- Expected correct behavior
- Specific fix guidance for the coder
- Acceptance criteria checklist
- Severity rating (critical / high / medium / low)

## Invocation
When you run this command, use the ux-agent subagent:

```
Use the ux-agent. Task ID: $ARGUMENTS (if blank, pull the next assign:ux-agent task from ORBIT, or run the default full audit sweep). Follow the full loop defined in .claude/agents/ux-agent.md.
```
