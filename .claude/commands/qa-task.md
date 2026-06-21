# /qa-task

Exercise DineOS features using the qa-agent and file bug tasks in ORBIT.

## Usage
```
/qa-task <task-id>
```
Or without an ID to pick up the next `assign:qa-agent` task:
```
/qa-task
```

## What this does
1. Loads the **qa-agent** subagent (`.claude/agents/qa-agent.md`).
2. The agent reads the specified QA task (or the next `assign:qa-agent` task) from ORBIT.
3. Starts the DineOS desktop app (`pnpm tauri:dev`) if needed.
4. Exercises the flows specified in the task, or the standard flow matrix if unspecified.
5. For each bug found, files a `wf:bug` task in ORBIT with full repro steps, assigned to `assign:coder`.
6. Marks the QA task `wf:done`.

## Arguments
- `$ARGUMENTS` — the ORBIT task ID specifying which feature area to QA. If omitted, agent picks the next `assign:qa-agent` task.

## Note on app startup
The qa-agent will run `pnpm tauri:dev` — this opens the DineOS desktop window. Ensure you have a local `.env` with valid Turso credentials or the app will start in offline-only mode (still testable for most flows).

## Invocation
When you run this command, use the qa-agent subagent:

```
Use the qa-agent. Task ID: $ARGUMENTS (if blank, pull the next assign:qa-agent task from ORBIT). Follow the full loop defined in .claude/agents/qa-agent.md.
```
