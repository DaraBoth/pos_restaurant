# /coder-report

Generate a structured activity report of completed coder tasks for a given period and file it to ORBIT for code-reviewer to review.

## Usage
```
/coder-report
/coder-report daily
/coder-report weekly
/coder-report 2026-06-01..2026-06-29
```

- No argument → defaults to the last 24 hours (same as `daily`).
- `daily` → last 24 hours.
- `weekly` → last 7 days.
- `<from>..<to>` → explicit ISO-date range (inclusive).

## What this does
1. Parses the date window from `$ARGUMENTS`.
2. Queries ORBIT `tasks.list` for completed `project:dineos` tasks in the window.
3. Filters to tasks that were coder-owned (tagged `wf:coder-task`, `wf:bug`, `wf:ux-bug`, `wf:change-request`, or `wf:error-fix`).
4. Builds a structured markdown report.
5. Files the report as an ORBIT task tagged `assign:code-reviewer` + `wf:report` + `project:dineos`.

## Invocation
When you run this command, execute the following steps inline:

### Step 1 — Resolve the date window
Parse `$ARGUMENTS`:
- Empty or `daily` → `date_from` = (today − 1 day), `date_to` = today (ISO strings `YYYY-MM-DD`)
- `weekly` → `date_from` = (today − 7 days), `date_to` = today
- `YYYY-MM-DD..YYYY-MM-DD` → split on `..` to get `date_from` and `date_to`

### Step 2 — Pull completed tasks in the window

```bash
ORBIT_KEY=$(grep ORBIT_API_KEY .env | cut -d= -f2 | tr -d '\r')
ORBIT_URL="https://dailygoalmap.vercel.app/api/mcp"

curl -s -X POST "$ORBIT_URL" -H "Content-Type: application/json" -H "X-Project-Api-Key: $ORBIT_KEY" \
  -d "{\"tool\":\"tasks.list\",\"input\":{\"tags\":[\"project:dineos\"],\"completed\":true,\"date_from\":\"<date_from>\",\"date_to\":\"<date_to>\",\"limit\":100}}"
```

### Step 3 — Filter coder tasks
From the result, keep tasks whose `tags` array contains ANY of:
`wf:coder-task`, `wf:bug`, `wf:ux-bug`, `wf:change-request`, `wf:error-fix`, `assign:coder`

### Step 4 — Pull open follow-ups (change-requests / blocked)

```bash
curl -s -X POST "$ORBIT_URL" -H "Content-Type: application/json" -H "X-Project-Api-Key: $ORBIT_KEY" \
  -d '{"tool":"tasks.list","input":{"tags":["project:dineos","assign:coder"],"completed":false,"limit":50}}'
```

### Step 5 — Build the report

Produce a markdown body in this structure:

```
## Coder Activity Report — <date_from> to <date_to>

### Tasks Completed (<N>)

| # | Task ID | Title | Tags |
|---|---------|-------|------|
| 1 | <short_id> | <title> | <tags> |
...

### Per-Task Notes
For each completed task, one line: what the task was and what was changed (infer from title + tags).

### Open Follow-ups (<N>)
List any open `assign:coder` tasks that are pending (change-requests, blocked, etc.).

### Summary
One paragraph summarising the period's work.
```

### Step 6 — File the report

```bash
curl -s -X POST "$ORBIT_URL" -H "Content-Type: application/json" -H "X-Project-Api-Key: $ORBIT_KEY" \
  -d "{\"tool\":\"tasks.create\",\"input\":{\"title\":\"[coder-report] <daily|weekly|date-range> report — <date_from> to <date_to>\",\"description\":\"<the markdown report body>\",\"tags\":[\"wf:report\",\"assign:code-reviewer\",\"project:dineos\"]}}"
```

Print the filed task ID and a brief confirmation to the user.
