# ORBIT API Notes

MCP endpoint for DailyGoalMap ORBIT task API.  
**Full usage patterns → `.claude/skills/orbit-task-manager.md`** (use that skill file in agent sessions).

## Connection

```
POST https://dailygoalmap.vercel.app/api/mcp
Headers:
  Content-Type: application/json
  X-Project-Api-Key: <ORBIT_API_KEY from .env>
Body: {"tool": "<tool-name>", "input": {...}}
```

Key is stored in `.env` as `ORBIT_API_KEY` (gitignored). Read it:
```bash
ORBIT_KEY=$(grep ORBIT_API_KEY .env | cut -d= -f2 | tr -d '\r')
```

## Tools quick-reference

| Tool | Required input fields | Notes |
|------|-----------------------|-------|
| `tasks.next` | `agent_tag` | Returns `{ idle: true }` when queue empty; check `skill_refresh` flag |
| `tasks.list` | — | Supports `tags`, `match`, `completed`, `date`, `date_from`, `date_to`, `limit`, `offset` |
| `tasks.create` | `title` | Returns created task with `id` |
| `tasks.update` | `task_id` | Tags array **replaces** existing tags entirely |
| `tasks.complete` | `task_id` | Only toggles completion; does not touch tags |
| `tasks.move` | `task_id` | Date/time rescheduling only |
| `tasks.delete` | `task_id` | Permanent |

> All mutation operations use `task_id` (UUID). Never use `id` as the field name.

## Response format

```json
{ "ok": true, "status": 200, "result": { ... } }
```

On error:
```json
{ "ok": false, "error": "description of what went wrong" }
```

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid input |
| 401 | Missing or invalid API key |
| 405 | Method not allowed |
| 500 | Server or database error |

## Security note
Never print or log the API key. Never hardcode it in agent files or commands. Always read from `.env`.
