# DineOS ORBIT Workflow

## Tag state machine

```
                         ┌──────────────────────────────────────┐
  human / advisor        │                                      │
  creates task           │   wf:coder-task                      │
  ───────────────────► assign:coder                             │
                         │                                      │
                         ▼                                      │
                    [ coder agent ]                             │
                    implements to                               │
                    acceptance criteria                         │
                    runs pnpm lint                              │
                    runs pnpm build (tsc)                       │
                         │                                      │
                         │ tasks.complete(wf:done)              │
                         ▼                                      │
                    wf:done                                     │
                    assign:code-reviewer                        │
                         │                                      │
                         ▼                                      │
                [ code-reviewer agent ]                         │
                reads diff vs criteria                          │
                checks conventions                              │
                checks security/perf                            │
                    /          \                                │
                PASS            FAIL                            │
                  │               │                             │
                  ▼               ▼                             │
             wf:approved    wf:change-request                   │
                  │         assign:coder ──────────────────────►┘
                  │
                  ▼
         [ human reviews diff ]
         git diff HEAD~1 HEAD
              │
              ▼
         [ human deploys ]
         ./release.ps1
         CI: tauri-action → GitHub Release
```

## Parallel tracks

```
  qa-agent exercises app
       │
       │ files wf:bug tasks
       ▼
  assign:coder
       │
       ▼
  [ coder fixes bug ]
       │
       ▼
  assign:code-reviewer
       │  (same review flow as above)
```

```
  runtime / CI failure
       │
       │ auto-filed wf:error task
       ▼
  assign:code-reviewer
       │
       ▼
  [ code-reviewer analyzes error ]
  [ appends rule to .claude/docs/coder-lessons.md ]
       │
       │ files wf:coder-task fix spec
       ▼
  assign:coder
       │
       ▼
  [ coder reads coder-lessons.md ]
  [ implements fix ]
       │
       ▼
  assign:code-reviewer
       │  (same review flow as above)
```

```
  advisor prioritizes backlog
       │
       │ creates wf:coder-task
       ▼
  assign:coder
  (enters main flow above)
```

```
  ux-agent audits pages (1 page per cycle)
       │
       │ files wf:ux-bug / wf:coder-task
       ▼
  assign:coder
       │
       ▼
  [ coder fixes UI issue ]
       │
       ▼
  assign:code-reviewer
       │  (same review flow as above)
```

## Escalation (any agent)

```
  any agent hits a blocker
       │
       │ tasks.create([NEEDS-HUMAN])
       ▼
  wf:needs-human (+ wf:blocked if blocking a parent)
       │
       ▼
  [ human resolves ]
       │
       ▼
  tasks.update → remove wf:needs-human / wf:blocked
  re-assign to appropriate agent
```

## Tag reference

| Tag | Set by | Cleared by | Meaning |
|-----|--------|-----------|---------|
| `project:dineos` | All agents | Never | Scope filter — required on every task |
| `wf:coder-task` | advisor / human / ux-agent | (preserved on complete) | Ready for coder |
| `assign:coder` | advisor / reviewer / ux-agent / human | coder (on complete) | Queued for coder |
| `wf:done` | coder | reviewer | Implementation complete |
| `assign:code-reviewer` | coder | reviewer (on complete) | Queued for reviewer |
| `wf:approved` | code-reviewer | Never | Approved; human can deploy |
| `wf:change-request` | code-reviewer | coder (on re-complete) | Needs fixes |
| `wf:bug` | qa-agent | coder (on complete) | Bug report |
| `wf:ux-bug` | ux-agent / pos-customer | coder (on complete) | UI/UX issue filed by audit agent |
| `wf:ux-task` | human / advisor | ux-agent (on complete) | UX audit task queued for ux-agent |
| `assign:ux-agent` | human / advisor | ux-agent (on complete) | Queued for ux-agent |
| `wf:i18n` | ux-agent | coder (on complete) | Bilingual/translation gap |
| `wf:money-critical` | ux-agent / pos-customer | coder (on complete) | Wrong money display — financial risk |
| `wf:needs-human` | Any agent | Human | Human decision required |
| `wf:blocked` | Any agent | Human | Blocks a parent task |
| `wf:error` | error ingestion pipeline | code-reviewer (on complete) | Runtime or CI failure auto-filed for root-cause analysis |
| `wf:report` | coder (/coder-report command) | code-reviewer (on complete) | Periodic activity report filed for review |

## Agent capabilities matrix

| Capability | coder | code-reviewer | qa-agent | advisor | ux-agent |
|-----------|-------|--------------|---------|---------|---------|
| Edit source files | YES | NO | NO | NO | NO |
| Create ORBIT tasks | YES (escalation only) | YES (change-request) | YES (bugs) | YES (specced tasks) | YES (ux fix tasks) |
| Run `pnpm lint` | YES | NO | NO | NO | NO |
| Run `pnpm build` (typecheck) | YES — **required before done** | NO | NO | NO | NO |
| Run `pnpm tauri:dev` | NO | NO | YES | NO | NO |
| Run Playwright screenshots | NO | NO | NO | NO | YES (read-only) |
| Push / deploy | NO | NO | NO | NO | NO |
| Read source | YES | YES | YES | YES | YES |

## Slash commands

| Command | Agent | Description |
|---------|-------|-------------|
| `/implement [task-id\|all]` | coder | Pick up and implement the next (or specified) `assign:coder` task |
| `/review-before-pr [task-id]` | code-reviewer | Review a completed implementation before human deploys |
| `/qa-task [task-id]` | qa-agent | Exercise the running app and file bug tasks |
| `/ux-audit [task-id]` | ux-agent | Audit UI pages and file ux-bug / coder-task tasks |
| `/sync-agent-task [agent]` | any | Show current ORBIT queue for all or one agent |
| `/coder-report [daily\|weekly\|<date-range>]` | coder | Summarise completed coder work and file `wf:report` task to code-reviewer |

## Token discipline
- Agents lean on `.claude/docs/project-context.md` rather than re-reading the entire repo each cycle.
- `tasks.next` is the primary loop call — cheap, ordered, one task at a time.
- Idle cycles stop immediately when `tasks.next` returns no tasks.
- Agents keep working context small: read only the files needed for the current task.
