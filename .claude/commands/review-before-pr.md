# /review-before-pr

Review a completed DineOS implementation using the code-reviewer agent before the human deploys.

## Usage
```
/review-before-pr <task-id>
```
Or without an ID to pick up the next `assign:code-reviewer` task:
```
/review-before-pr
```

## What this does
1. Loads the **code-reviewer** subagent (`.claude/agents/code-reviewer.md`).
2. The reviewer fetches the specified task from ORBIT.
3. Reads the task's acceptance criteria.
4. Checks `git diff HEAD~1 HEAD` against:
   - Acceptance criteria from the task description
   - DineOS conventions (IPC patterns, money types, bilingual strings, etc.)
   - Security (no secrets, parameterized queries, no XSS)
   - Performance (bounded queries, restaurant_id filters)
5. **PASS** → marks `wf:approved`; human can now review diff and deploy via `release.ps1`.
6. **FAIL** → files a `wf:change-request` task routed back to `assign:coder` with exact fixes required.

## Arguments
- `$ARGUMENTS` — the ORBIT task ID to review. If omitted, reviewer picks the next `assign:code-reviewer` task.

## Invocation
When you run this command, use the code-reviewer subagent:

```
Use the code-reviewer agent. Task ID: $ARGUMENTS (if blank, pull the next assign:code-reviewer task from ORBIT). Follow the full loop defined in .claude/agents/code-reviewer.md.
```

## Human deployment (after wf:approved)
The code-reviewer never deploys. After `wf:approved`, the human should:
1. Review the diff: `git diff HEAD~1 HEAD`
2. Run a signed production build: `./build-signed.ps1`
3. Publish the release: `./release.ps1` (bumps version, tags, pushes → CI builds + publishes)
