# ORBIT API Notes

MCP endpoint for DailyGoalMap ORBIT task API.

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

## Tools

### `tasks.next`
Pull the next open task for an agent tag (primary loop call).
```json
{
  "tool": "tasks.next",
  "input": { "agent_tag": "assign:coder" }
}
```
Returns: `{"ok":true,"status":200,"result":{"tasks":[...], ...}}`
Empty queue: `{"result":{"tasks":[]}}`

### `tasks.list`
List tasks with optional filters.
```json
{
  "tool": "tasks.list",
  "input": {
    "tags": ["project:dineos"],
    "completed": false,
    "limit": 20,
    "offset": 0
  }
}
```

### `tasks.create`
Create a new task.
```json
{
  "tool": "tasks.create",
  "input": {
    "title": "...",
    "description": "...",
    "tags": ["project:dineos", "assign:coder", "wf:coder-task"]
  }
}
```
Returns the created task with its `id`.

### `tasks.update`
Update a task (tags, title, description).
```json
{
  "tool": "tasks.update",
  "input": {
    "id": "<task-id>",
    "tags": ["project:dineos", "wf:done", "assign:code-reviewer"],
    "title": "optional new title",
    "description": "optional new description"
  }
}
```
Tag array REPLACES existing tags — always include all desired tags, not just the new ones.

### `tasks.complete`
Mark a task as done (preserves tags, sets completed state).
```json
{
  "tool": "tasks.complete",
  "input": {
    "id": "<task-id>",
    "tags": ["project:dineos", "wf:done", "assign:code-reviewer"]
  }
}
```

### `tasks.move`
Move a task (reorder in the queue).
```json
{
  "tool": "tasks.move",
  "input": { "id": "<task-id>", "position": 0 }
}
```

### `tasks.delete`
Delete a task permanently.
```json
{
  "tool": "tasks.delete",
  "input": { "id": "<task-id>" }
}
```

## Response format
All tools return:
```json
{
  "ok": true,
  "status": 200,
  "result": { ... }
}
```
On error:
```json
{
  "ok": false,
  "status": 4xx,
  "error": "..."
}
```

## Tag naming conventions for DineOS
Always include `project:dineos` on every task. Agent routing via `assign:<agent>`. Workflow state via `wf:<state>`. See `.claude/docs/workflow.md` for the full state machine.

## Security note
Never print or log the API key. Never hardcode it in agent files or commands. Always read from `.env`.
