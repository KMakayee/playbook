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

## #2 — `/implement` hangs in `run_in_background` mode (codex + claude -p stdin)

**Status:** Draft
**Priority:** High
**Created:** 2026-05-02
**Updated:** 2026-05-02 — refined acceptance criteria after second Codex review (live repro confirmed bug, foreground calls covered defensively, regression guard scoped narrowly, chained-line placement clarified)

### Description

When `/implement` (or other QRSPI commands) launches a `codex … exec` or `claude -p …` child process under the harness's `run_in_background: true` mode, the child appears to inherit an open stdin pipe with no writer. Codex (v0.125.0, also reproduced under v0.128.0) then blocks indefinitely on its `Reading additional input from stdin...` step, silently stalling the whole run. The harness implementation isn't in this repo, so the "open pipe, no writer" wording is observed behavior, not fully established — but the repro and the fix at the call site are reliable.

Failure surface (call sites missing stdin redirection):

- `.claude/commands/implement.md:75-99` — `codex … exec` (Step 6: Run Codex code review).
- `.claude/commands/implement.md:141` — `claude -p …` (Step 8: Apply fixes via child process).
- `.claude/commands/issue-implement.md:83-109` — `codex … exec` (Step 6, mirror of `implement.md`).
- `.claude/commands/issue-implement.md:154-159` — `claude -p …` (Step 8, mirror of `implement.md`).
- `.claude/commands/auto-issues.md:33` — `claude -p …` (Phase 1 Research, header at `:30`).
- `.claude/commands/auto-issues.md:45` — `claude -p …` (Phase 2 Plan, header at `:42`).
- `.claude/commands/auto-issues.md:57` — `claude -p …` (Phase 3 Implement, header at `:54`).

Symptoms observed:
- Intermittent — happens sometimes, not always. High priority because when it hits, it silently stalls the run with no error.
- **Worktree correlation ruled out (2026-05-02):** live repro occurred in the main repo (not a worktree) during the second-opinion review for this issue itself. The first `codex exec` call (no `</dev/null`) hung indefinitely; the second call (with `</dev/null`) completed in normal time. Worktree state is not load-bearing.
- Manifests as a stuck "still running" background task that never produces its expected artifact (e.g. `tasks/codex-code-review.tmp` or the corresponding `tasks/logs/…log`).

### Acceptance Criteria

- [ ] Append `</dev/null` to the `codex … exec` invocation in `.claude/commands/implement.md:75-99`.
- [ ] Append `</dev/null` to the `claude -p …` invocation at `.claude/commands/implement.md:141`. **Placement note:** in chained lines like `mkdir -p tasks/logs && TIMESTAMP=… && claude -p …`, the redirect must attach to the `claude -p` simple command — not the front of the chain. Correct: `… --dangerously-skip-permissions </dev/null > tasks/logs/…log 2>&1`. Wrong: `</dev/null mkdir -p … && …` (would apply to `mkdir`, not `claude -p`).
- [ ] Apply the same `</dev/null` redirect to the `codex … exec` invocation in `.claude/commands/issue-implement.md:83-109`.
- [ ] Apply the same `</dev/null` redirect to the `claude -p …` invocation at `.claude/commands/issue-implement.md:154-159` (same chained-line placement rule applies).
- [ ] Apply the same `</dev/null` redirect to all three `claude -p …` invocations in `.claude/commands/auto-issues.md` (lines 33, 45, 57 — the ones explicitly marked `run_in_background`).
- [ ] **Defensive coverage:** also apply `</dev/null` to the foreground `claude -p` invocations in `.claude/commands/auto-issues.md:69` (Phase 4 Update) and `:81` (Phase 5 Commit & Push). They aren't vulnerable today (timeout-only, not `run_in_background`), but uniform application keeps the pattern hang-proof if either is later switched to backgrounded mode.
- [ ] **Regression guard:** add a smoke check (script or doc note) that greps for any **backgrounded** `codex … exec` or `claude -p …` snippet in `.claude/commands/*.md` lacking `</dev/null`. Scope the check to call sites associated with `run_in_background` — flagging every `claude -p` regardless of context creates false-positive noise that erodes trust in the guard.
- [ ] **Verification:** the live repro on 2026-05-02 already confirmed the bug fires in the main repo and that `</dev/null` resolves it (worktree comparison no longer required). After applying the fix, re-run a representative `run_in_background` `codex exec` call and confirm completion plus the expected output artifact. **If a run still hangs after the fix, do not assume `</dev/null` is at fault** — it only addresses fd-0 reads. Inspect logs/process state for other blockers (`/dev/tty`, permission prompts, model timeouts, lock contention).

### Notes

**Live repro on 2026-05-02:** During the second-opinion review for this issue, the first `codex exec` call (without `</dev/null`) hung indefinitely in the main repo. The same call with `</dev/null` appended completed in normal time. End-to-end confirmation that the fix mechanism works and that worktree state is not part of the trigger.

**Centralization deferred — but tracked.** Per-call-site patches are the lowest-blast-radius option for now. Longer term, this should move to either (a) a harness-level fix that closes stdin for `run_in_background`, or (b) a repo wrapper / shell function for non-interactive `claude -p` and `codex exec`. The regression guard is the minimum acceptable substitute until centralization lands; with seven duplicated invocations, the regression risk is real if the guard is dropped.

**Scope of the fix.** `</dev/null` only addresses fd-0 reads. If the child is blocked on `/dev/tty`, a permission prompt, model/network response, lock contention, or a sub-child, this fix won't help. The current symptom text (`Reading additional input from stdin...`) points squarely at fd 0, so this is the right fix for the reported bug — but verification should treat any post-fix hang as a separate issue, not as evidence the redirect failed.

Root cause is in the harness/runner that launches the backgrounded process, not in codex itself — codex behaves correctly given a closed stdin. Codex CLI flags are not a clear substitute because the prompt is already passed as an argv string, not via stdin.

### Impacts

_None yet._
