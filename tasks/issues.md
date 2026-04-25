# Issue Board

> **Purpose:** Track issues through the playbook workflow. Each issue progresses through statuses as slash commands are run against it.
> **Status flow:** `Draft` → `In Research` → `In Planning` → `In Review` → `In Progress` → `Done` | `Deferred`
> **Commands:** `/issue-research`, `/issue-plan`, `/issue-audit`, `/issue-implement`, `/issue-update`

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

### Notes

[Accumulates during workflow — research findings, plan decisions, implementation notes. Newest entries first.]

### Impacts

[Filled by `/issue-update` after a related issue completes. Describes how other issues' changes affect this one.]
```

---

## Issues

<!-- Add new issues below. Number sequentially. -->

## #1 — Bake parallel-PR safety into `/push-pr` and `/push-pr-light`

**Status:** Draft
**Priority:** Medium
**Created:** 2026-04-24

### Description

When multiple worktrees are worked in parallel (e.g., todo-1 / todo-2 / todo-3 from `tasks/todo.md`) and merged sequentially, the second-and-later branches predictably run into two problems that today require manual fix-up before the PR is mergeable:

1. **Stale branch** — the branch was forked from main before its sibling merged. `git diff main..feature` shows the sibling's files as deletions, which would un-ship completed work if merged as-is.
2. **QRSPI artifacts in diff** — `tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/plan.md` get committed during the workflow and end up in the PR. They're maintainer-only and should not ship to main (see commit `abf2fa4`).

`/push-pr` and `/push-pr-light` should bake this in so parallel work is self-healing and the dev never has to remember the catch-up + cleanup sequence.

Additionally: switch the default merge strategy from `--merge` to `--squash`. Reasons: clean main history (one commit per PR), `git bisect` reliability, trivial reverts, and the QRSPI noise commits (`fix: apply code review revisions`, smoke-test edits, artifact cleanup) don't need to be on main. Artifact retrievability is preserved by keeping the work-branch ref around.

### Acceptance Criteria

- [ ] `/push-pr` and `/push-pr-light` detect when the feature branch is behind `origin/main` and merge main in before pushing (no force-push; squash collapses the merge commit anyway)
- [ ] Both skills detect tracked QRSPI artifacts (`tasks/research-codebase.md`, `tasks/design-decision.md`, `tasks/plan.md`) in the PR diff and add a single cleanup commit removing them before opening the PR
- [ ] Both skills default to `gh pr merge --squash` instead of `--merge`
- [ ] When skipping cleanup or catch-up would be wrong (e.g., diff is empty, branch is up-to-date), the skill is a no-op for that step rather than erroring
- [ ] README and `quickref.md` reflect the new defaults (squash + auto-prep)
- [ ] Existing PR review and conditional-merge logic is preserved unchanged

### Notes

Observed during the todo-1 / todo-2 / todo-3 parallel work session (2026-04-24). PR #15 (todo-2) required manual artifact cleanup; todo-1 and todo-3 still pending the same prep. The pattern will recur every time multiple worktrees are run in parallel.

Worth checking during research: whether the catch-up should be a merge or a rebase. Current preference is merge (no force-push needed, squash erases the merge commit from main's history anyway), but rebase may be cleaner for branches that have not yet been pushed.

### Impacts

[Filled by `/issue-update` after a related issue completes.]
