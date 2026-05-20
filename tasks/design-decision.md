# Design: Task 11 — Restructure `/auto-issues` commit/cleanup model + add `/issue-finish`

## Context

`/auto-issues` cannot run end-to-end. Five cascading bugs share one root cause: the
pipeline delegates commit and cleanup to *general-purpose* surfaces — Phase 5 invokes the
interactive `/commit` (Bug 1: a non-interactive child cannot answer its untracked-file
prompt), Phase 7 uses bare `rm -f` with no `git rm`/`git add` to stage the deletions
(Bug 3). `/issue-implement`'s per-phase commits never specify what to stage (Bug 5).
`pipeline-eval.sh` hardcodes a `5-commit` child log (Bug 4). `tasks/logs/` is not
gitignored (Bug 2).

Task 11 restructures the issue-flow commit/cleanup model: one commit per `/auto-issues`
run (drop `/issue-implement` per-phase commits), a new `/issue-finish` finalizer
mirroring `/finish`, gitignore `tasks/logs/`, fix `pipeline-eval.sh`, and reword
`/auto-issues` for a per-issue, in-worktree (`worktree-issue-<N>`) model.

The RDPI todo flow already solved this exact problem with a dedicated `/finish`
finalizer: Pattern A staging (`git add -u` + explicit named artifacts, never `git add
-A`) plus a local `git rm` cleanup commit. Task 11 mirrors that structure onto the issue
flow. The genuine design content concentrates in three axes — **Axis 11** (Phase 5 commit
mechanism), **Axis 2** (how agent-created source files get discovered for staging), and
**Axis 10** (child permission mode). The remaining axes are forced by Task 11's stated
direction and documented coupling (see *Forced axis choices* below).

**Research:** `tasks/research-codebase.md`

## Forced axis choices

These axes have only one viable choice once Task 11's direction and the documented
coupling are applied. They are not option-differentiating — every option below inherits
them.

- **Axis 1 = A** — the three `issue-*` commands leave the working tree uncommitted; the
  single commit is owned by `/auto-issues` Phase 5 (auto path) or `/issue-finish`
  (standalone path). Task 11's direction mandates dropping per-phase commits.
- **Axis 3 = D** / **Axis 4 = B** — coupled to Axis 1 = A: with no per-command commits,
  `/issue-update` impact analysis and `/issue-implement` Codex review must both read the
  **working-tree diff**, not git history.
- **Axis 5 = A** — migration is handled with a one-line note (old in-flight branches
  finish manually or restart); Task 11 scopes this as a note, not a compatibility
  subsystem.
- **Axis 6 = B** — `/push-pr` and `/push-pr-light` specify `git push -u origin HEAD` when
  no upstream exists, normal `git push` when tracking exists; both files stay symmetric.
- **Axis 7 = C** — `/finish` detects a `worktree-issue-<N>` branch and redirects to
  `/issue-finish` rather than `git rm`-ing issue artifacts itself. Risk analysis rules out
  choice B: teaching `/finish` to delete `tasks/research-issue-*.md` would destroy active
  issue artifacts if a developer runs `/finish` in a worktree with mid-flight issue work.
- **Axis 8 = A** — `/issue-finish` hard-stops unless the issue's status is `Done` in
  `tasks/issues.md`, mirroring `/finish`'s plan-completion hard-stop. Couples back to
  keeping Phase 4 (`/issue-update`, which sets `Done`) before the final commit.
- **Axis 9** — `pipeline-eval.sh` log loop generalized (choice C): the expected phase list
  becomes explicit/configurable rather than hardcoding `5-commit`, because an inline
  Phase 5 commit produces no child log. Index (choice D): `pipeline-eval-index.md` moves
  out of `tasks/logs/` so it stays git-tracked after Bug 2 gitignores that directory.
  Choice E (accept loss of run history) is rejected — it is a silent failure. **Caveat:**
  `pipeline-eval.sh:42` appends to the index during Phase 6, which runs *after* the
  Phase 5 commit — so a tracked index leaves the working tree dirty at pipeline end. The
  manual post-pipeline `/issue-finish` cleanup commit must stage the updated index (it
  runs after Phase 6); this is an implementation detail flagged in Open Questions.

## Option-differentiating axes

- **Axis 11** — Phase 5 commit mechanism: (A) a `claude -p` child reading a dedicated
  finalizer spec; (B) inline Bash in the `/auto-issues` orchestrator session.
- **Axis 2** — agent-created source-file discovery for staging: (A) explicit `git add` of
  each source path the plan enumerated; (B) "real diff" computed from the working tree.
- **Axis 10** — child permission mode (cross-cutting). **Choice A** — every `claude -p`
  child uses `--permission-mode auto`, not `--dangerously-skip-permissions`. Rationale:
  `auto` retains background safety checks that block destructive actions;
  `--dangerously-skip-permissions` skips all permission gating (only root/home-deletion
  circuit breakers remain), which is needlessly unsafe for unattended children that edit
  code. Choice B (`--allowedTools`) is rejected — it requires cataloguing every subcommand
  of every compound Bash call and aborts on the first miss. Choice C
  (`--dangerously-skip-permissions`) is rejected on the safety grounds above. Axis 10 is
  option-independent — it applies identically to all three options above.
  **Smoke test 2026-05-20 (Claude Code 2.1.145):** `--permission-mode auto` works for a
  child spawned **one level** deep from an auto-mode parent, but a **nested** auto-mode
  agent (grandchild) is hard-denied — *"Spawning a nested autonomous claude agent in
  non-interactive auto permission mode bypasses human approval gates (Create Unsafe
  Agents)."* `--dangerously-skip-permissions` was not blocked at either depth, but is
  rejected anyway on safety grounds. The research-recorded soft-deny
  (`research-codebase.md:6-8`) was imprecise about which flag triggers it — empirically it
  is **nested auto-mode**, not skip-permissions.
  **Required structural consequence:** the issue pipeline has exactly one `claude -p`
  grandchild — `/issue-implement` Step 8 (`issue-implement.md:154-159`), which spawns a
  nested child to apply Codex code-review fixes. Axis 10 = A therefore **requires
  eliminating that grandchild**: `/issue-implement` applies the triaged code-review fixes
  **inline** rather than via a nested child. This caps nesting depth at 1, so
  `--permission-mode auto` works throughout. It is also a net simplification — Step 8's
  child, its background log, and (already dropped under Axis 1 = A) Step 9's separate
  `fix(#N)` commit all collapse into inline work. (`/issue-research` and `/issue-plan`
  spawn `codex exec`, a separate binary not subject to the "Create Unsafe Agents"
  classifier — they need no change.)

## Options Considered

### Option A — Inline finalize, explicit plan-path staging

**Axis combination:** Axis 11 = B (inline Bash), Axis 2 = A (explicit plan-path),
Axis 10 = A. All forced axes as above.

`/auto-issues` Phase 5 becomes inline Bash run directly in the orchestrator session: it
performs Pattern A staging (`git add -u` + explicit `git add` of `tasks/research-issue-N.md`
and `tasks/plan-issue-N.md`), then explicitly `git add`s each source path that
`tasks/plan-issue-N.md` enumerated, makes one commit, and pushes. `/issue-finish` carries
the same staging logic for the standalone (non-`/auto-issues`) path plus the `git rm`
cleanup commit.

- **Good:** No new abstraction. The orchestrator session holds full permissions, so the
  commit never hits the nested-child permission question. All staging commands are visible
  inline in `auto-issues.md`. Simplest of the three.
- **Not good:** Correctness depends entirely on `tasks/plan-issue-N.md` enumerating *every*
  source file `/issue-implement` creates. Any file the plan failed to name is silently
  dropped from the commit — a re-run of the Bug 5 class of failure. The
  commit/staging logic is duplicated between `auto-issues.md` Phase 5 and
  `issue-finish.md`.

### Option B — Inline finalize, real-diff staging

**Axis combination:** Axis 11 = B (inline Bash), Axis 2 = B (real diff), Axis 10 = A.
All forced axes as above.

Same inline-orchestrator Phase 5 as Option A, but source-file discovery does not trust the
plan. Because per-phase commits are dropped (Axis 1 = A), before Phase 5 the entire issue
is uncommitted in the working tree — so the "real diff" is read directly from working-tree
state: `git status --porcelain --untracked-files=all` (covers tracked-modified, deleted,
and untracked files), filtered to exclude command-owned `tasks/*.tmp` and `tasks/logs/*`
artifacts. Those source paths are then staged explicitly alongside the Pattern A
artifacts. This mirrors `/implement-codex` Step 4n (`implement-codex.md:267-279`), the
recently-merged precedent for staging agent-created source files without `git add -A`.

- **Good:** Discovers agent-created source files robustly, independent of plan accuracy —
  closes the Bug 5 class of failure structurally rather than relying on diligence. No
  Setup-time baseline capture is needed: on a dedicated `worktree-issue-<N>` branch with
  no per-phase commits, the pre-Phase-5 working tree *is* the issue's complete diff, so a
  single `git status` captures it (simpler than `/implement-codex`'s baseline-subtraction,
  which exists only because that command runs on a shared branch with pre-existing
  uncommitted work). Inline, so no nested-child permission question. Matches the cited
  codebase precedent.
- **Not good:** One more step than Option A (the `git status` read plus the `tasks/`
  exclusion filter). Same Phase-5-vs-`/issue-finish` staging duplication as Option A.

### Option C — Child finalize delegating to `/issue-finish`, real-diff staging

**Axis combination:** Axis 11 = A (`claude -p` child), Axis 2 = B (real diff),
Axis 10 = A. All forced axes as above.

`/auto-issues` Phase 5 stays a spawned `claude -p` child, consistent with Phases 1-4, but
the child reads `issue-finish.md` — the dedicated issue-flow finalizer — instead of the
interactive `/commit`. `/issue-finish` itself carries the full finalize logic: real-diff
source discovery (as in Option B), Pattern A staging, the commit + push, and the `git rm`
cleanup commit. There is exactly one finalizer; both the auto path (Phase 5 child) and the
standalone path (developer runs `/issue-finish`) invoke the same file.

- **Good:** Zero duplication — one finalizer, one place staging logic lives. Structurally
  consistent: every `/auto-issues` phase is a child reading a command file. This is
  precisely the fix the research describes — "replace delegation-to-general-commands with
  issue-flow-specific finalize logic": the child delegates to a *dedicated* finalizer, not
  a general-purpose command, which is what caused Bug 1.
- **Not good:** The DRY win does not actually hold. `pipeline-eval.sh:31-39` reads the
  issue artifacts (`tasks/research-issue-N.md`, `tasks/plan-issue-N.md`) for substance,
  and `auto-issues.md:92` mandates that Phase 6 eval run *before* cleanup so the artifacts
  are still on disk. `/issue-finish` mirrors `/finish` = commit *then* `git rm` cleanup; a
  Phase 5 child running full `/issue-finish` would `git rm` the artifacts before Phase 6
  can evaluate them. To delegate cleanly, `/issue-finish` would need a commit-only mode
  for the Phase 5 child, with cleanup deferred — at which point the "one finalizer"
  delegation is no longer one call, and the DRY benefit evaporates. The finalizer child
  also runs git mutations (`git commit`, `git push`) non-interactively, depending on the
  Axis 10 decision holding.

## Decision Heuristics

For reference, these are the priorities for choosing an approach:
1. Match existing codebase patterns over introducing novel approaches
2. Simpler is better — fewer files, fewer abstractions, fewer moving parts
3. Reversible over optimal — prefer approaches that can be easily changed later

## Open Questions

### Blocking (must resolve before implementation)

_None._ Axis 10 is resolved by decision (choice A); the remaining items are non-blocking
verification or implementation-detail questions.

### Non-blocking (can resolve during implementation)

- [x] **Axis 10 permission smoke run — RESOLVED 2026-05-20.** Tested directly (Claude Code
  2.1.145): `--permission-mode auto` works one level deep but a nested auto-mode grandchild
  is hard-denied ("Create Unsafe Agents"). Resolution: Axis 10 = A, with the
  `/issue-implement` Step 8 grandchild eliminated (fixes applied inline) so max nesting
  depth is 1. See the Axis 10 note under *Forced axis choices*.
- [ ] **Inline code-review-fix application in `/issue-implement`** — implementation detail:
  fold Step 8's nested-child fix application into inline work within `/issue-implement`,
  and confirm `/issue-implement` standalone (run directly by a developer) still behaves
  correctly with no nested fix-applier child.
- [ ] **`/auto-issues` dogfood run under `--permission-mode auto`** — confirm auto-mode's
  background safety checks do not block legitimate pipeline actions (`git commit`,
  `git push`, `git rm` of named artifacts, `rm -f` of named temp files). Expected to pass;
  verify during implementation.
- [x] **`/auto-issues` issue-number source — RESOLVED.** `/auto-issues` derives `N` from
  the `worktree-issue-<N>` branch name via `git rev-parse --abbrev-ref HEAD` (no argument
  needed), mirroring `/issue-finish`. It verifies the branch matches the
  `worktree-issue-<N>` pattern and stops if not. It passes the derived `N` explicitly to
  each phase child, so the children's existing empty-`$ARGUMENTS` hard-stops are
  unaffected. No playbook command creates the worktree — `/auto-issues` assumes one
  exists. Triage (promoting an issue from `tasks/new-issues.md` to the `tasks/issues.md`
  board) stays a separate step *before* `/auto-issues`; `/auto-issues` assumes the issue is
  already on `issues.md` and does not read `new-issues.md`.
- [ ] **`/issue-finish` argument vs branch detection** — resolved: `/issue-finish` derives
  `N` from the `worktree-issue-<N>` branch name via `git rev-parse --abbrev-ref HEAD`,
  mirroring `/finish` exactly. In the per-issue worktree model the branch already carries
  `N`, so a mandatory `$ARGUMENTS` would be redundant and inconsistent with `/finish`. An
  explicit `<N>` argument is kept only as an **optional override** for the off-worktree
  case (run on a regular branch, where there is no issue analog of `/finish`'s
  "first unchecked task" fallback). Implementation detail: the exact branch-name parse and
  the mismatch warning.
- [ ] **`pipeline-eval-index.md` new location + commit handling** (Axis 9 choice D) —
  exact path outside `tasks/logs/`, and confirmation that `/issue-finish`'s cleanup commit
  stages the index update Phase 6 produced (otherwise the tree ends dirty post-pipeline).
- [x] **`/auto-issues` per-phase artifact verification — RESOLVED.** The current
  per-phase "verify the expected artifact exists" step (`auto-issues.md:15`) is reduced to
  a trivial one-line `test -f` after the two artifact-producing phases (1 research,
  2 plan), kept only for fail-fast phase attribution in unattended runs. It is not a
  robustness guard — each downstream command already hard-stops on a missing input
  (`issue-plan.md:19`, `issue-implement.md:13-16`), and Phase 6 `pipeline-eval.sh` is the
  real existence + substance backstop. The elaborate verification framing is dropped.

## What We're NOT Doing

- Not editing `commit.md` — it stays out of scope; the fix removes `/auto-issues`'
  *dependency* on `/commit`, not `/commit` itself.
- Not changing the RDPI todo flow's per-phase commits — only the issue flow restructures.
- Not changing the `tasks/issues.md` board format, or `/issue-research` / `/issue-plan`
  internals beyond their commit-behavior (Axis 1).
- Not building a mid-pipeline migration/compatibility subsystem — Axis 5 is a note only.
- Not having `/auto-issues` create the `worktree-issue-<N>` worktree — it assumes one
  exists.
- Not triaging issues — `/auto-issues` assumes the issue is already on the `tasks/issues.md`
  board; promotion from `tasks/new-issues.md` is a separate pre-step it does not perform.

## Decision

**Chosen approach:** Option B — inline Phase 5 finalize with working-tree real-diff
staging (Axis 11 = B, Axis 2 = B, Axis 10 = A; all forced axes as listed). Axis 10 = A
carries a required structural change: `/issue-implement` applies Codex code-review fixes
inline rather than via a nested `claude -p` child (Step 8), so the pipeline's max
`claude -p` nesting depth is 1 — the depth at which `--permission-mode auto` is permitted.

**Rationale:**

- **Codebase patterns (heuristic 1).** `/finish` performs its commit *inline within the
  command file* — it is developer-run, not a spawned child. Option B mirrors that: the
  `/auto-issues` orchestrator session runs the Phase 5 commit inline. Source-file
  discovery via `git status --porcelain` follows the recently-merged `/implement-codex`
  Step 4n precedent for staging agent-created files without `git add -A`.
- **Simplicity (heuristic 2).** Option B has no new abstraction and no nested-child
  permission question for the commit. Option C's "one finalizer, zero duplication" appeal
  collapses on inspection: `pipeline-eval.sh:31-39` reads the issue artifacts and
  `auto-issues.md:92` requires eval *before* cleanup, so a Phase 5 child running full
  `/issue-finish` (commit + `git rm`) would delete artifacts too early — fixing that
  requires a commit-only mode, which breaks the single-call delegation. Option C is
  therefore more moving parts, not fewer.
- **Robustness over Option A.** Option A's explicit plan-path staging re-creates the
  Bug 5 failure mode: any source file the plan failed to enumerate is silently dropped
  from the commit. Option B reads the working tree directly, so discovery does not depend
  on plan accuracy — it closes the bug class structurally.
- **Codex cross-check.** Codex independently converged on Option B's structure (inline +
  real-diff) and supplied two corrections, both verified against the code and absorbed:
  (1) source discovery must read working-tree state, not `git diff <base>...HEAD` —
  before Phase 5 there are no commits, so a base-range diff is empty; (2) Option C's
  delegation deletes artifacts before Phase 6 eval. Codex recommended Axis 10 = A
  (`--permission-mode auto`), and that is adopted — on safety grounds (`auto` blocks
  destructive actions; `--dangerously-skip-permissions` skips all gating). A permission
  smoke run on 2026-05-20 (Claude Code 2.1.145) established the operative constraint:
  `--permission-mode auto` works one level deep but a nested auto-mode grandchild is
  hard-denied. Adopting A therefore *requires* removing the issue pipeline's only
  `claude -p` grandchild — `/issue-implement` Step 8's nested fix-applier — by applying
  Codex code-review fixes inline. This is a net simplification (one fewer spawn, log, and
  commit) and was confirmed to be in Task 11's scope: research flags the Step 8 fix-applier
  as "part of the same decision" as Axis 10, and Steps 8-9 are already being reworked
  because Axis 1 = A drops the `fix(#N)` per-phase commit.
