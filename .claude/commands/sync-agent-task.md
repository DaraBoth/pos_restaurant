# /sync-agent-task

Show the current ORBIT task queue for all DineOS agents, then pull the next task for a given agent.

## Usage
```
/sync-agent-task
/sync-agent-task coder
/sync-agent-task code-reviewer
/sync-agent-task qa-agent
/sync-agent-task advisor
```

## What this does
1. Reads `ORBIT_API_KEY` from `.env`.
2. Calls `tasks.list` filtered to `project:dineos` to show all open tasks.
3. If an agent name is given (`$ARGUMENTS`), also calls `tasks.next` for `assign:<agent>` to show what that agent would pick up next.
4. Prints a summary table: task ID · title · tags · assigned agent.

## Invocation
When you run this command:

```bash
ORBIT_KEY=$(grep ORBIT_API_KEY .env | cut -d= -f2 | tr -d '\r')
ORBIT_URL="https://dailygoalmap.vercel.app/api/mcp"

# List all open DineOS tasks
curl -s -X POST "$ORBIT_URL" \
  -H "Content-Type: application/json" \
  -H "X-Project-Api-Key: $ORBIT_KEY" \
  -d '{"tool":"tasks.list","input":{"tags":["project:dineos"],"completed":false}}'
```

If `$ARGUMENTS` is one of `coder`, `code-reviewer`, `qa-agent`, `advisor`, also run:
```bash
curl -s -X POST "$ORBIT_URL" \
  -H "Content-Type: application/json" \
  -H "X-Project-Api-Key: $ORBIT_KEY" \
  -d "{\"tool\":\"tasks.next\",\"input\":{\"agent_tag\":\"assign:$ARGUMENTS\"}}"
```

Format the output as a readable table grouped by `assign:` tag. Show task IDs in full so the human can pass them directly to `/implement`, `/review-before-pr`, or `/qa-task`.

## Tag reference
| Tag | Meaning |
|-----|---------|
| `wf:coder-task` | Ready for coder to implement |
| `wf:done` | Coder finished; awaiting review |
| `wf:approved` | Reviewer approved; ready for human to deploy |
| `wf:change-request` | Reviewer sent back to coder with fixes |
| `wf:bug` | Bug filed by qa-agent; awaiting coder fix |
| `wf:needs-human` | Blocked — human decision required |
| `assign:coder` | Queued for coder agent |
| `assign:code-reviewer` | Queued for code-reviewer agent |
| `assign:qa-agent` | Queued for qa-agent |
| `assign:advisor` | Queued for advisor agent |
| `project:dineos` | Belongs to this project |
