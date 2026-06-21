# /implement

Implement a DineOS task from ORBIT using the coder agent.

## Usage
```
/implement <task-id>
```
Or without an ID to pick up the next `assign:coder` task automatically:
```
/implement
```

## What this does
1. Loads the **coder** subagent (`.claude/agents/coder.md`).
2. The coder fetches the specified task (or the next `assign:coder` task) from ORBIT.
3. Reads the task's acceptance criteria.
4. Implements changes — the only agent allowed to edit source files.
5. Runs `pnpm lint` — fixes all errors.
6. Marks the task `wf:done` and routes it to `assign:code-reviewer`.
7. Reports what changed in one short paragraph.

## After implementation
Run `/review-before-pr <task-id>` to trigger the code-reviewer agent, or wait — the code-reviewer's autonomous loop will pick it up via `assign:code-reviewer`.

## Arguments
- `$ARGUMENTS` — the ORBIT task ID to implement. If omitted, coder picks the next queued task.

## Invocation
When you run this command, use the coder subagent:

```
Use the coder agent. Task ID: $ARGUMENTS (if blank, pull the next assign:coder task from ORBIT). Follow the full loop defined in .claude/agents/coder.md.
```
