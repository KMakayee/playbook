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

### Notes

[Accumulates during workflow — research findings, plan decisions, implementation notes. Newest entries first.]

### Impacts

[Filled by `/issue-update` after a related issue completes. Describes how other issues' changes affect this one.]
```

---

## Issues

<!-- Add new issues below. Number sequentially. -->

## #1 — Default `/push-pr` and `/push-pr-light` to `--squash`

**Status:** Done
**Priority:** Low
**Created:** 2026-04-24
**Updated:** 2026-04-25 — re-scoped after Task 8 absorbed the catch-up + artifact-cleanup portions
**Closed:** 2026-04-25

### Description

`/push-pr` and `/push-pr-light` currently default to `gh pr merge --merge` (regular merge commit). For the playbook repo, squash should be the default:

- Clean `main` history — one commit per PR
- `git bisect` reliability — each commit on `main` is a complete, reviewed unit
- Trivial reverts via `git revert <PR-merge-sha>`
- QRSPI noise commits (`fix: apply code review revisions`, smoke-test edits, artifact cleanup) don't pollute the log
- Artifact retrievability is preserved by keeping the work-branch ref around after merge — `git show <feature-sha>:tasks/plan.md` still works from the branch even though intermediate commits aren't reachable from `main`

This issue was originally scoped to also bundle catch-up automation and artifact cleanup, but those moved to **Task 8 (`/catchup` command)** in `tasks/todo.md`. What's left for `/push-pr` is just the merge-strategy default and a small staleness-gate check (which Task 8 will also touch).

### Acceptance Criteria

- [x] `/push-pr` defaults to `gh pr merge --squash`
- [x] `/push-pr-light` does the same
- [x] PR title is pre-set via `gh pr create --title "<descriptive>"` so the squash commit on `main` reads cleanly (not auto-generated from branch name)
- [x] `README.md` and `quickref.md` mention squash as the default
- [x] Existing PR review and conditional-merge logic preserved unchanged

### Notes

Confirmed during 2026-04-24 parallel-PR session (tasks 1/2/3 in `tasks/todo.md`). Squash-default preference is also saved as feedback memory (`feedback_squash_merge_default.md`) so the agent passes the flag manually until this issue lands.

**Co-located with Task 8.** Task 8 (new `/catchup` command) will need to edit `/push-pr` and `/push-pr-light` to add a staleness gate. The squash-default change is small and lives in the same surface — Task 8 should close out this issue alongside that edit rather than running this as a separate work item.

**2026-04-25 — Closed by Task 8.** Task 8's `/catchup` work edited `/push-pr*` for the staleness gate; squash default + `--title` hybrid landed in the same edit.

### Impacts

- **Task 8** (`tasks/todo.md`): co-located. Task 8 will close this issue out as part of its `/push-pr` staleness-gate edit.
