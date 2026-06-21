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
  advisor prioritizes backlog
       │
       │ creates wf:coder-task
       ▼
  assign:coder
  (enters main flow above)
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
| `wf:coder-task` | advisor / human | (preserved on complete) | Ready for coder |
| `assign:coder` | advisor / reviewer / human | coder (on complete) | Queued for coder |
| `wf:done` | coder | reviewer | Implementation complete |
| `assign:code-reviewer` | coder | reviewer (on complete) | Queued for reviewer |
| `wf:approved` | code-reviewer | Never | Approved; human can deploy |
| `wf:change-request` | code-reviewer | coder (on re-complete) | Needs fixes |
| `wf:bug` | qa-agent | coder (on complete) | Bug report |
| `wf:needs-human` | Any agent | Human | Human decision required |
| `wf:blocked` | Any agent | Human | Blocks a parent task |

## Agent capabilities matrix

| Capability | coder | code-reviewer | qa-agent | advisor |
|-----------|-------|--------------|---------|---------|
| Edit source files | YES | NO | NO | NO |
| Create ORBIT tasks | YES (escalation only) | YES (change-request) | YES (bugs) | YES (specced tasks) |
| Run `pnpm lint` | YES | NO | NO | NO |
| Run `pnpm tauri:dev` | NO | NO | YES | NO |
| Push / deploy | NO | NO | NO | NO |
| Read source | YES | YES | YES | YES |

## Token discipline
- Agents lean on `.claude/docs/project-context.md` rather than re-reading the entire repo each cycle.
- `tasks.next` is the primary loop call — cheap, ordered, one task at a time.
- Idle cycles stop immediately when `tasks.next` returns no tasks.
- Agents keep working context small: read only the files needed for the current task.
