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

_No active issues._

---

## Completed Issues

> Brief closure record. Full bodies of completed issues stay below (or are findable in git via `git log --grep="#N"`). Move new issues here on transition to `Done`.

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

**Status:** Done
**Priority:** High
**Created:** 2026-05-02
**Closed:** 2026-05-03
**Updated:** 2026-05-03 — closed; uniform `</dev/null` discipline shipped across 19 sites in `.claude/commands/*.md`; regression-guard lint dropped per operator direction; commits `5656ba2`, `b879c7d`, `d029f54` on branch `worktree-issue-2`

### Description

When `/implement` (or other QRSPI commands) launches a `codex … exec` or `claude -p …` child process under the harness's `run_in_background: true` mode (or any long-running call the harness may auto-background — see 2026-05-02 update in `tasks/design-decision.md:9-14`), the child inherits a stdin pipe whose writer-side fd is held open by the harness. Codex (v0.125.0, also reproduced under v0.128.0) then blocks indefinitely on its `Reading additional input from stdin...` step, silently stalling the whole run. The harness implementation isn't in this repo, but POSIX `pipe(7)` semantics — `read()` blocks while any writer is open — match the observed behavior, and the fix at the call site is reliable.

Original backgrounded failure surface (before this fix — 7 mandatory sites originally enumerated):

- `.claude/commands/implement.md:75-99` — `codex … exec` (Step 6: Run Codex code review).
- `.claude/commands/implement.md:141` — `claude -p …` (Step 8: Apply fixes via child process).
- `.claude/commands/issue-implement.md:83-109` — `codex … exec` (Step 6, mirror of `implement.md`).
- `.claude/commands/issue-implement.md:154-159` — `claude -p …` (Step 8, mirror of `implement.md`).
- `.claude/commands/auto-issues.md:33` — `claude -p …` (Phase 1 Research, header at `:30`).
- `.claude/commands/auto-issues.md:45` — `claude -p …` (Phase 2 Plan, header at `:42`).
- `.claude/commands/auto-issues.md:57` — `claude -p …` (Phase 3 Implement, header at `:54`).

The shipped fix covers a broader 19-site uniform-coverage list — see Acceptance Criteria below and the site map in `tasks/plan.md:33-71`. The 7 sites above remained the empirically-confirmed hang sites; the additional 12 were added once the 2026-05-02 finding falsified the "foreground is safe" premise.

Symptoms observed:
- Intermittent — happens sometimes, not always. High priority because when it hits, it silently stalls the run with no error.
- **Worktree correlation ruled out (2026-05-02):** live repro occurred in the main repo (not a worktree) during the second-opinion review for this issue itself. The first `codex exec` call (no `</dev/null`) hung indefinitely; the second call (with `</dev/null`) completed in normal time. Worktree state is not load-bearing.
- Manifests as a stuck "still running" background task that never produces its expected artifact (e.g. `tasks/codex-code-review.tmp` or the corresponding `tasks/logs/…log`).

### Acceptance Criteria

- [x] Apply `</dev/null` to every long-running `codex exec` and `claude -p` invocation in `.claude/commands/*.md` (19 sites total: 7 originally-mandatory backgrounded + 12 added by uniform coverage).
- [x] **Placement rule** — for chained lines like `mkdir -p tasks/logs && TIMESTAMP=… && claude -p …`, the redirect attaches to the `claude -p` simple command (between `--dangerously-skip-permissions` and `> tasks/logs/…log 2>&1`), never the front of the chain.
- [x] **Verification** — operator-monitored smoke test: at least one representative backgrounded `codex exec` invocation completes and produces its expected output artifact. Live repro on 2026-05-02 confirmed the underlying bug fires in the main repo and that `</dev/null` resolves it. **If a run still hangs after the fix, do not assume `</dev/null` is at fault** — it only addresses fd-0 reads (`/dev/tty`, permission prompts, model timeouts, lock contention may all hang independently).
- [x] **Regression guard deferred** — no automated lint shipping with this hotfix. Operator monitors backgrounded runs; if discipline rots, file a follow-up to add a lint or build a centralized wrapper (per `tasks/research-codebase.md:110`).

### Notes

**2026-05-03 — Closed.** Uniform `</dev/null` shipped on every long-running `codex exec` / `claude -p` call across 9 files in `.claude/commands/` (19 sites). Branch `worktree-issue-2`; commits `5656ba2` (fix), `b879c7d` (issue board update), `d029f54` (Codex review revisions). The Step 6 Codex review during implementation served as the operator-monitored smoke test — it ran backgrounded against the post-fix tree and completed normally, empirically confirming the fix on the most-trafficked site (`implement.md:76`). Regression-guard lint dropped on operator direction; if discipline rots, file a follow-up.

**2026-05-02 — Scope broadened, lint dropped.** During the design phase Claude observed the harness auto-background a foreground `codex exec` call (`.claude/commands/design.md:87`), which then hung indefinitely (had to be killed; exit 144). That falsified the original "foreground sites are safe" premise — the harness can choose to background any long-running call independently of how the spec is written. Scope therefore expanded from 7 mandatory + 2 defensive sites to 19 uniform sites covering every long-running `codex exec` / `claude -p` invocation in `.claude/commands/*.md` (see `tasks/design-decision.md:9-14`). The regression-guard half of the design (a marker-free lint script) was dropped on operator direction — backgrounded runs are monitored manually instead. If discipline rots, file a follow-up issue for either a lint or a centralized wrapper (Axis 2=B, deferred per `tasks/research-codebase.md:110`).

**Live repro on 2026-05-02:** During the second-opinion review for this issue, the first `codex exec` call (without `</dev/null`) hung indefinitely in the main repo. The same call with `</dev/null` appended completed in normal time. End-to-end confirmation that the fix mechanism works and that worktree state is not part of the trigger.

**Centralization deferred — but tracked.** Per-call-site patches are the lowest-blast-radius option for now. Longer term, this should move to either (a) a harness-level fix that closes stdin for `run_in_background`, or (b) a repo wrapper / shell function for non-interactive `claude -p` and `codex exec`. The originally proposed regression-guard lint was dropped on operator direction (see the 2026-05-02 note above) — backgrounded runs are monitored manually instead. With 19 duplicated invocations and no automated check, the regression risk is real; if discipline rots, file a follow-up to add a lint or accelerate the centralized wrapper.

**Scope of the fix.** `</dev/null` only addresses fd-0 reads. If the child is blocked on `/dev/tty`, a permission prompt, model/network response, lock contention, or a sub-child, this fix won't help. The current symptom text (`Reading additional input from stdin...`) points squarely at fd 0, so this is the right fix for the reported bug — but verification should treat any post-fix hang as a separate issue, not as evidence the redirect failed.

Root cause is in the harness/runner that launches the backgrounded process, not in codex itself — codex behaves correctly given a closed stdin. Codex CLI flags are not a clear substitute because the prompt is already passed as an argv string, not via stdin.

### Impacts

**Task 11** (`tasks/todo.md`) — Task 11 will rewrite `auto-issues.md` Phases 4-5 and `issue-implement.md`'s background sites as part of restructuring the commit/cleanup model. Task 11 must preserve the `</dev/null` discipline on every long-running `codex exec` / `claude -p` invocation it produces. With no automated lint shipping, Task 11's reviewer is responsible for verifying the discipline was carried forward (spot-check edits + smoke run of one backgrounded site).
