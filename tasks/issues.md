# Issue Board

> **Purpose:** Track issues through the playbook workflow. Each issue progresses through statuses as slash commands are run against it.
> **Status flow:** `Draft` → `In Research` → `In Planning` → `In Review` → `In Progress` → `Implemented` → `Done` | `Deferred`
> **Commands:** `/issue-research`, `/issue-plan`, `/issue-implement`, `/issue-update`

---

## Issue Format

Each issue uses the structure below. Copy it when adding a new issue.

```
## #N — [Title]

**Status:** Draft
**Priority:** High | Medium | Low
**Created:** YYYY-MM-DD

### Description

[What needs to happen and why. Be specific enough that research can begin without further clarification.]

### Acceptance Criteria

- [ ] [Observable, testable outcome]
- [ ] [Another outcome]

### Constraints

[Optional. Scope boundaries, locked decisions, behavior the implementation must not break. Omit if none.]

### Relevant paths

[Optional. Files, globs, or docs likely relevant — discovery accelerators, not scope. May go stale on the board; omit if unsure.]

### Notes

[Accumulates during workflow — research findings, plan decisions, implementation notes. Newest entries first.]

### Impacts

[Filled by `/issue-update` after a related issue completes. Describes how other issues' changes affect this one.]
```

---

## Issues

<!-- Add new issues below. Number sequentially. -->

_No active issues._

---

## Completed Issues

> Brief closure record. Full bodies findable in git via `git log --grep="#N"`. Move new issues here on transition to `Done`.

### #1 — Default `/push-pr` and `/push-pr-light` to `--squash`
**Status:** Done | **Closed:** 2026-04-25 | **Closed by:** Task 8
`/push-pr` and `/push-pr-light` now default to `gh pr merge --squash` with PR title pre-set via `gh pr create --title` so the squash commit on `main` reads cleanly. README and quickref updated. Landed alongside Task 8's `/catchup` staleness-gate edit.

### #2 — `/implement` hangs in `run_in_background` mode (codex + claude -p stdin)
**Status:** Done | **Closed:** 2026-05-03 | **Branch:** worktree-issue-2 | **Commits:** 5656ba2, b879c7d, d029f54
Backgrounded `codex exec` / `claude -p` children inherited an open stdin pipe and blocked on `Reading additional input from stdin...`. Fix: uniform `</dev/null` redirect on every long-running invocation across 9 files / 19 sites. Scope broadened from the original 7+2 site list on 2026-05-02 after observing the harness auto-background a foreground call. Regression-guard lint dropped on operator direction — manual monitoring instead.
