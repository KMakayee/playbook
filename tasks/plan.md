# Plan: Task 11 — Restructure `/auto-issues` commit/cleanup model + add `/issue-finish`

## Design decision reference

Implements **Option B** from `tasks/design-decision.md` — inline Phase 5 finalize with
working-tree real-diff staging (Axis 11 = B, Axis 2 = B, Axis 10 = A; all forced axes as
listed in the design's *Forced axis choices*). The full axis rationale lives in
`tasks/design-decision.md`; research ground truth in `tasks/research-codebase.md`.

Net effect of the chosen axes:
- The three `issue-*` commands leave the working tree **uncommitted** (Axis 1 = A). The
  single commit per `/auto-issues` run is owned by the inline Phase 5 (Axis 11 = B).
- Source-file discovery for staging reads the **working tree** (`git status --porcelain
  --untracked-files=all`), not the plan or git history (Axis 2 = B).
- Every `claude -p` child uses `--permission-mode auto` (Axis 10 = A). This caps `claude
  -p` nesting depth at 1, which **requires eliminating** `/issue-implement`'s Step 8
  nested fix-applier child — fixes are applied inline instead.
- `/issue-implement` Codex review and `/issue-update` impact analysis read the
  working-tree diff, not git history (Axis 4 = B, Axis 3 = D).

## Scope boundaries — what we are NOT doing

- **Not editing `commit.md`** — the fix removes `/auto-issues`' *dependency* on `/commit`,
  not `/commit` itself.
- **Not changing the RDPI todo flow's per-phase commits** — only the issue flow
  restructures. `/implement` and `/implement-codex` stay as-is, including their use of
  `--dangerously-skip-permissions` (`implement.md:146`, `implement-codex.md:447`).
- **Not changing the `tasks/issues.md` board format**, nor `/issue-research` /
  `/issue-plan` research/plan internals (their commit behavior already matches Axis 1 = A
  — they write artifacts and do not commit, so they need no functional change; only a
  stale prose reference is corrected in Phase 8).
- **Not building a migration/compatibility subsystem** (Axis 5 = A). Old in-flight
  branches under the per-phase-commit model finish manually or restart — communicated as
  a one-line note in the handoff/PR, not a code change.
- **Not having `/auto-issues` create the `worktree-issue-<N>` worktree** — it assumes one
  exists and verifies its branch matches the pattern.
- **Not triaging issues** — `/auto-issues` assumes the issue is already on
  `tasks/issues.md`.
- **Not changing `/catchup`** — it is already worktree-safe and branch-name-agnostic
  (`research-codebase.md:128-133`).

## Cross-cutting constraints (apply to every phase)

- **`</dev/null` discipline (Issue #2).** Every `codex exec` / `claude -p` invocation in
  every rewritten file keeps `</dev/null`. No automated lint exists — verify by spot-check.
- **No `git add -A` / `git add .`** for any staging path. Pattern A artifacts staged
  explicitly; source files staged from the filtered real-diff set.
- **Pattern A is fixed**: `git add -u` + explicit `git add` of `tasks/research-issue-N.md`
  and `tasks/plan-issue-N.md`; no interactive untracked prompt for non-interactive callers.

## Phase ordering note

Phase 3 (`/auto-issues` rewrite) runs **before** Phase 4 (`/issue-implement` rewrite).
The inline Phase 5 commit added in Phase 3 sweeps the entire working tree via the real
diff, so it is correct whether or not `/issue-implement` still commits per-phase — making
Phase 3 safe in isolation. Doing it the other way (dropping `/issue-implement`'s commits
first) would leave `/auto-issues` momentarily relying on its old `/commit`-child Phase 5,
which never staged source files outside `tasks/` (Bug 1) — a strictly more broken
intermediate state. (Codex review, RISK on phase ordering — absorbed.)

---

## Phase 1 — Infrastructure: gitignore `tasks/logs/` + fix `pipeline-eval.sh`

Closes Bug 2 and Bug 4. Foundational — later phases depend on the index's new location.

**Files:**

- **`.gitignore`** (`.gitignore:1-5`) — add a `tasks/logs/` entry. Place it after the
  existing `.claude/worktrees/` line. (No tracked files currently live under
  `tasks/logs/`, so no `git rm --cached` is needed — verified.)
- **`.claude/scripts/pipeline-eval.sh`**:
  - **Expected-phase list** (`pipeline-eval.sh:13-28`) — both `for phase in ...` loops
    hardcode `1-research 2-plan 3-implement 4-update 5-commit`. The restructured
    pipeline's Phase 5 is an inline Bash commit that produces **no child log** (Bug 4).
    Per Axis 9 (choice C — "the expected phase list becomes explicit/configurable"),
    define a single named array near the top of the script, e.g.
    `EXPECTED_PHASES=(1-research 2-plan 3-implement 4-update)`, and iterate it with
    `for phase in "${EXPECTED_PHASES[@]}"; do` in **both** loops. This drops `5-commit`
    and removes the duplicated literal. Update the `# 1. Log completeness` comment
    (`:13`) and the `# All 5 phases` comment (`:21`) to reflect the 4-phase list.
  - **Index path** (`pipeline-eval.sh:42`) — change `INDEX="tasks/logs/pipeline-eval-index.md"`
    to `INDEX="tasks/pipeline-eval-index.md"`. Once `tasks/logs/` is gitignored, an index
    inside it stops being tracked and run history is silently lost (Axis 9, choice D).
    `tasks/` itself is tracked (`todo.md`, `issues.md`, `errors.md`), so the new path
    stays under version control. **Judgment call 1.**

**Success criteria:**
- `bash -n .claude/scripts/pipeline-eval.sh` exits 0 (syntax valid).
- `git check-ignore tasks/logs/x.log` prints `tasks/logs/x.log` (directory is ignored).
- `git check-ignore tasks/pipeline-eval-index.md` exits non-zero (index NOT ignored).
- `grep -c '5-commit' .claude/scripts/pipeline-eval.sh` returns `0`.
- `grep -c 'tasks/logs/pipeline-eval-index' .claude/scripts/pipeline-eval.sh` returns `0`.
- `grep -q 'EXPECTED_PHASES' .claude/scripts/pipeline-eval.sh` succeeds (named list present).

---

## Phase 2 — Create `/issue-finish` command

New finalizer mirroring `/finish` (`finish.md:1-44`) for the issue flow. Referenced by
Phases 3 and 6, so it must exist first.

**File:** new `.claude/commands/issue-finish.md`.

**Structure (mirror `/finish`):**

1. **Title + intro.** "Issue Finish — wrap up issue #N: commit remaining work, then clean
   up issue artifacts." Takes optional `$ARGUMENTS` (issue number override).
2. **Step 1 — Resolve issue number + verify Done:**
   - Detect the branch: `git rev-parse --abbrev-ref HEAD` (the idiom `finish.md:16`
     uses). If it matches `worktree-issue-<N>`, derive `N` from the branch name.
   - If `$ARGUMENTS` is non-empty, it overrides the derived `N` (the off-worktree /
     regular-branch case — there is no issue analog of `/finish`'s "first unchecked
     task" fallback, so an explicit `N` is required when not on a `worktree-issue-<N>`
     branch).
   - If neither yields an `N`, stop and tell the developer to re-invoke with an issue
     number.
   - If the branch is a `worktree-issue-<M>` branch but `$ARGUMENTS` names a different
     `N`, warn about the mismatch and proceed with `$ARGUMENTS`.
   - Locate issue `#N` in `tasks/issues.md`. **Hard-stop unless its status is `Done`**
     (Axis 8 = A — mirrors `/finish`'s plan-completion hard-stop at `finish.md:11-14`;
     `Done` is set by `/issue-update`, `issue-update.md:25`).
3. **Step 2 — Finalize commit (commit + push remaining work):**
   - Run `git status --porcelain` to see whether the working tree has uncommitted work.
   - **Treat `tasks/pipeline-eval-index.md` as NOT "remaining work"** for this decision.
     `/auto-issues` Phase 6 appends to that index *after* Phase 5's commit, so on the
     `/auto-issues` path the index is the *only* dirty path at `/issue-finish` time —
     committing+pushing it as standalone work would be wrong. The index is owned by
     Step 3's cleanup commit (design Axis 9 caveat, `design-decision.md:57-60`).
     **Judgment call 4.**
   - **If the only dirty path is the eval index, or the tree is clean** (the
     `/auto-issues` path — Phase 5 already committed + pushed the real work): skip to
     Step 3.
   - **If there is real uncommitted work** (the standalone path — developer ran
     `/issue-implement` directly, so the whole issue is uncommitted): stage and commit
     using the same logic as `/auto-issues` Phase 5 (see Phase 3 below):
     - `git add -u` (tracked modifications + deletions).
     - Compute the real-diff source set: `git status --porcelain --untracked-files=all`,
       exclude command-owned `tasks/*.tmp` and anything under `tasks/logs/`. `git add`
       each remaining path explicitly.
     - Explicitly `git add tasks/research-issue-N.md tasks/plan-issue-N.md` (Pattern A
       artifacts) if they exist.
     - Show `git diff --staged`. Draft a conventional commit message referencing the
       issue (`feat(#N): <subject>` / `fix(#N): <subject>`). `git commit`.
     - Push: `git push -u origin HEAD` if no upstream tracking branch exists, plain
       `git push` otherwise (Axis 6 = B form).
4. **Step 3 — Cleanup commit (local, no push):**
   - After Step 2, `git rm` whichever issue artifacts exist:
     `tasks/research-issue-N.md`, `tasks/plan-issue-N.md`. (Mirrors `finish.md:30`.)
   - If `tasks/pipeline-eval-index.md` shows as modified (Phase 6 of `/auto-issues`
     appended to it after Phase 5's commit), `git add` it into this commit.
   - Defensive `rm -f` of leftover temp files (untracked, not committed) — carry the list
     from the current `auto-issues.md:108-113`: `tasks/codex-issue-prompt-N.tmp`,
     `tasks/codex-issue-research-N.tmp`, `tasks/codex-issue-plan-review-N.tmp`,
     `tasks/codex-issue-code-review-N.tmp`, `tasks/code-review-fixes-issue-N.tmp`,
     `tasks/codex-debug-issue-N-*.tmp`.
   - Commit the staged deletions + index update with message
     `chore: clean up issue #N artifacts`.
   - **Do not push** this commit — it rides the next push (`/push-pr` / `/push-pr-light`),
     mirroring `finish.md:32`.
   - If no artifacts exist and the index is unmodified, skip this step.
5. **Step 4 — Report:** issue number finished, the Step 2 commit hash + message (or "no
   work to commit"), which artifacts were removed in Step 3, and the next-step hint:
   "Run `/catchup` if behind, then `/push-pr` or `/push-pr-light`."

**Worktree-awareness note:** unlike `/finish` (which uses `worktree-todo-<N>` detection to
*disambiguate which task* to mark done), `/issue-finish` already has `N`. Worktree
detection here only resolves `N` and warns on mismatch — per `research-codebase.md:404-408`.

**Success criteria:**
- `test -f .claude/commands/issue-finish.md` succeeds.
- `grep -c 'git add -A' .claude/commands/issue-finish.md` returns `0`.
- `grep -q 'worktree-issue' .claude/commands/issue-finish.md` succeeds.
- `grep -q 'git add -u' .claude/commands/issue-finish.md` succeeds (Pattern A staging).
- `grep -q 'git rm' .claude/commands/issue-finish.md` succeeds (cleanup deletions staged).
- `grep -q 'git push -u origin HEAD' .claude/commands/issue-finish.md` succeeds.
- `grep -q 'chore: clean up issue' .claude/commands/issue-finish.md` succeeds.
- `grep -q 'pipeline-eval-index' .claude/commands/issue-finish.md` succeeds (index handled).
- `grep -q 'Done' .claude/commands/issue-finish.md` succeeds (status hard-stop present).
- Manual read: Step 3's cleanup commit is explicitly NOT pushed.

---

## Phase 3 — Rewrite `/auto-issues`: per-issue worktree model + inline Phase 5

Closes Bug 1 and Bug 3; applies Axis 11 = B, Axis 2 = B, Axis 10 = A. Moves cleanup to
`/issue-finish` (old Phase 7 removed). Runs before the `/issue-implement` rewrite — see
*Phase ordering note* above.

**File:** `.claude/commands/auto-issues.md`.

**Changes:**

- **Top-of-file framing** (`auto-issues.md:1-3`) — reframe as a per-issue, in-worktree
  automated pipeline (not a "process all issues" batch tool). State the precondition: it
  runs inside a dedicated `worktree-issue-<N>` worktree; it does **not** create the
  worktree.
- **Issue-number derivation** — replace the `$ARGUMENTS`-based issue number. Add a step
  before Prerequisites: derive `N` from the branch via `git rev-parse --abbrev-ref HEAD`;
  if the branch does not match `worktree-issue-<N>`, stop and tell the developer to run
  from the correct worktree. No issue-number argument is needed (design Open Question,
  resolved — `design-decision.md:201-209`). Pass the literal derived `N` into every phase
  child's prompt (children keep their existing empty-`$ARGUMENTS` hard-stops). Replace
  all remaining `$ARGUMENTS` occurrences in the file with `N`.
- **Prerequisites** (`auto-issues.md:7-11`) — keep the "issue #N exists in
  `tasks/issues.md`" check and the leftover-artifact check (update artifact names to use
  `N`).
- **Per-phase verification** (`auto-issues.md:15`) — reduce the elaborate "verify the
  expected artifact exists" framing to a one-line `test -f` after Phase 1 and Phase 2 only
  (the artifact-producing phases), kept for fail-fast phase attribution. Downstream
  commands already hard-stop on missing inputs; Phase 6 `pipeline-eval.sh` is the real
  backstop (per design Open Questions, resolved).
- **Phases 1-4 `claude -p` spawns** (`auto-issues.md:33,45,57,69`) — change
  `--dangerously-skip-permissions` to `--permission-mode auto` on all four. **Keep
  `</dev/null`** and the existing log redirection on every site.
- **Phase 5 "Commit & Push"** (`auto-issues.md:76-86`) — **rewrite as inline Bash run
  directly in the orchestrator session** (no `claude -p` child, no Phase 5 log). The
  orchestrator session holds full permissions. Spell out every command inline — the
  recurring Bug 1/Bug 3 failure mode is prose that says "commit" without naming what to
  stage (`research-codebase.md:374-377`):
  - `git add -u` — stage tracked modifications + deletions (covers `tasks/issues.md`
    status edits).
  - Compute the real-diff source set: `git status --porcelain --untracked-files=all`,
    exclude `tasks/*.tmp` and anything under `tasks/logs/`. `git add` each remaining path
    explicitly. This discovers agent-created source files robustly, independent of plan
    accuracy (Axis 2 = B; mirrors `implement-codex.md:267-279`).
  - Explicitly `git add tasks/research-issue-N.md tasks/plan-issue-N.md` (Pattern A).
  - Draft a conventional commit message referencing issue #N. `git commit`.
  - `git push -u origin HEAD` (worktree branch's first push sets upstream tracking;
    Axis 6 = B form).
  - Keep the post-phase clean-tree check (`auto-issues.md:84`).
- **Phase 6 "Evaluate"** (`auto-issues.md:88-98`) — unchanged; still runs
  `pipeline-eval.sh N $TIMESTAMP`. (Note: the index it writes is now
  `tasks/pipeline-eval-index.md` per Phase 1; the eval runs after Phase 5's commit, so the
  index update is left uncommitted for `/issue-finish` Step 3 to absorb.)
- **Phase 7 "Cleanup"** (`auto-issues.md:100-123`) — **delete entirely.** Cleanup moves to
  `/issue-finish`. The pipeline now ends at Phase 6 (no renumbering needed — Phase 7 was
  last, per `todo.md:89`).
- **"After All Phases"** (`auto-issues.md:125-131`) — keep the final summary; append the
  manual handoff: "Run `/issue-finish` (then `/catchup` if behind, then `/push-pr` or
  `/push-pr-light`) from this worktree to clean up artifacts and open the PR."
- **Rules** (`auto-issues.md:134-141`) — update the bullet at `:139` that mandates
  `--dangerously-skip-permissions` to describe `--permission-mode auto` and the
  nesting-depth-1 constraint instead.

**Success criteria:**
- `grep -c 'dangerously-skip-permissions' .claude/commands/auto-issues.md` returns `0`.
- `grep -c 'permission-mode auto' .claude/commands/auto-issues.md` returns `5` (4 phase
  spawns + the Rules bullet at `:139`).
- `grep -c '</dev/null' .claude/commands/auto-issues.md` returns `4` (Phases 1-4 children).
- `grep -c 'Phase 7' .claude/commands/auto-issues.md` returns `0`.
- `grep -c 'commit.md' .claude/commands/auto-issues.md` returns `0` (dependency removed).
- `grep -q 'worktree-issue' .claude/commands/auto-issues.md` succeeds.
- `grep -c 'git add -A' .claude/commands/auto-issues.md` returns `0`.
- `grep -q 'git status --porcelain --untracked-files=all' .claude/commands/auto-issues.md`
  succeeds (real-diff discovery present).
- `grep -q 'git push -u origin HEAD' .claude/commands/auto-issues.md` succeeds.
- Manual read of the rewritten Phase 5: `git add -u`, the real-diff exclusion of
  `tasks/*.tmp` + `tasks/logs/`, and the explicit `git add` of both Pattern A artifacts
  are all spelled out.

---

## Phase 4 — Rewrite `/issue-implement`: drop commits, eliminate nested child

Closes Bug 5; applies Axis 1 = A, Axis 4 = B, Axis 10 = A.

**File:** `.claude/commands/issue-implement.md`.

**Changes:**

- **Intro** (`issue-implement.md:3`) — reword "Codex code review and fix application are
  offloaded" — fix application is no longer offloaded to a child. New framing: Codex
  reviews; Claude triages and applies fixes inline.
- **Step 4f "Commit the phase"** (`issue-implement.md:69-72`) — **delete entirely.**
  Axis 1 = A: `/issue-implement` makes no commits. The phase loop ends after Step 4e
  (checkmarks). Plan-file checkmark/deviation edits remain on disk uncommitted; the
  eventual single commit (`/auto-issues` Phase 5, or `/issue-finish` Step 2) picks them up
  via Pattern A staging of `tasks/plan-issue-N.md`.
- **Step 6 Codex review prompt** (`issue-implement.md:83-109`):
  - `:86` — change "Review the recent implementation" to review the **working-tree diff**
    (`git diff` plus untracked files). With per-phase commits dropped, the entire issue is
    uncommitted; "recent implementation" has no commit basis (Axis 4 = B).
  - `:90-91` PRELUDE multi-batch coherence — currently inspects "the recent git log on
    this branch". Reword to inspect the plan's checked-off items in
    `tasks/plan-issue-N.md` and the working-tree diff for cross-batch coherence, since no
    per-batch commits exist.
  - Keep `</dev/null`, `run_in_background`, the 10-min timeout, and the
    `codex-output-check.sh` verification (`:114`) unchanged.
- **Step 8 "Apply fixes via child process"** (`issue-implement.md:147-160`) — **remove the
  nested `claude -p` child entirely** (Axis 10 = A: max nesting depth must be 1). Replace
  with: Claude applies each fix from `tasks/code-review-fixes-issue-N.tmp` **inline** in
  this session — read each file fully, apply the fix, run relevant tests. Retitle the step
  "Apply fixes". No `mkdir -p tasks/logs`, no `TIMESTAMP`, no child log.
- **Step 9 "Final verification"** (`issue-implement.md:162-166`) — keep the verification
  paragraph; **delete the final line** "commit with message `fix(#$ARGUMENTS): apply code
  review revisions`" (Axis 1 = A — no commits).
- **Step 10 cleanup** (`issue-implement.md:168-173`) — unchanged (still deletes the Codex
  review tmp + fixes tmp + debug tmps).
- **Step 11 "Present results"** (`issue-implement.md:179-187`) — reword the "Implemented"
  bullet (`:182`): it currently says "Phases completed and commits made"; change to
  "Phases completed" (no commits). "Fixed" bullet (`:183`) — reword "the child process
  fixed" to "applied inline".
- **Step 4c** structural-mismatch `codex exec` (`issue-implement.md:46-57`) — unchanged;
  keep `</dev/null`.

**Standalone behavior check (design Open Question):** after these edits, confirm
`/issue-implement` run directly by a developer (not via `/auto-issues`) still terminates
cleanly — it implements, reviews, applies fixes inline, sets status `Implemented`, and
leaves the working tree uncommitted for a later `/issue-finish`. No nested child, no
dangling commit step.

**Success criteria:**
- `grep -c 'claude -p' .claude/commands/issue-implement.md` returns `0`.
- `grep -c 'dangerously-skip-permissions' .claude/commands/issue-implement.md` returns `0`.
- `grep -c 'Commit the phase' .claude/commands/issue-implement.md` returns `0`.
- `grep -c 'apply code review revisions' .claude/commands/issue-implement.md` returns `0`.
- `grep -c '</dev/null' .claude/commands/issue-implement.md` returns `2` (Step 4c + Step 6
  `codex exec` sites both retain it).

---

## Phase 5 — `/issue-update`: read the working-tree diff (Axis 3 = D)

**File:** `.claude/commands/issue-update.md`.

**Change:** Step 3 "Analyze impacts" (`issue-update.md:13-17`) currently asks the child to
reason about impacts with no instruction to inspect what actually changed. In the
restructured pipeline `/issue-update` (Phase 4) runs *before* the Phase 5 commit, so there
is no pipeline-produced commit to read — the working tree is the only signal (Axis 3 = D).

Add a step before Step 3 (or fold into Step 1): instruct the command to read the
working-tree diff for the completed issue — `git diff` (tracked changes) and `git status
--porcelain --untracked-files=all` (new files) — and use that concrete change set as the
evidence base for the impact analysis. Diff is the primary signal; `git log` is not
relied on (no per-command commits exist yet).

**Success criteria:**
- `grep -q 'git diff' .claude/commands/issue-update.md` succeeds.
- `grep -q 'git status' .claude/commands/issue-update.md` succeeds.

---

## Phase 6 — `/finish`: detect `worktree-issue-<N>` and redirect (Axis 7 = C)

**File:** `.claude/commands/finish.md`.

**Change:** At the **start of Step 1** (`finish.md:10`), before reading `tasks/plan.md`,
add a branch check: `git rev-parse --abbrev-ref HEAD`. If the branch matches
`worktree-issue-<N>`, **stop** and tell the developer to run `/issue-finish` instead —
`/finish` is for the RDPI todo flow. This is the safe choice (design Axis 7 = C): teaching
`/finish` to `git rm` issue artifacts itself (choice B) would destroy active issue
artifacts if run in a worktree with mid-flight issue work (`research-codebase.md:381-383`).
The existing `worktree-todo-<N>` detection (`finish.md:16`) is unchanged.

**Success criteria:**
- `grep -q 'worktree-issue' .claude/commands/finish.md` succeeds.
- `grep -q 'issue-finish' .claude/commands/finish.md` succeeds.
- `grep -c 'worktree-todo' .claude/commands/finish.md` is unchanged from baseline (still
  present — todo detection intact).

---

## Phase 7 — `/push-pr` + `/push-pr-light`: first-push upstream form (Axis 6 = B)

**Files:** `.claude/commands/push-pr.md`, `.claude/commands/push-pr-light.md`.

**Change:** Step 3 in both files (`push-pr.md:18`, `push-pr-light.md:18`) currently says
"push it now" without specifying the upstream form. A `worktree-issue-<N>` branch with no
upstream needs `git push -u origin HEAD` or the push errors with "no upstream branch".
Reword Step 3 in **both** files identically: when no upstream tracking branch exists, push
with `git push -u origin HEAD`; when tracking already exists, a plain `git push`. The two
files must stay symmetric (identical Step 3 wording).

**Success criteria:**
- `grep -q 'push -u origin HEAD' .claude/commands/push-pr.md` succeeds.
- `grep -q 'push -u origin HEAD' .claude/commands/push-pr-light.md` succeeds.
- Step 3 wording is byte-identical between the two files
  (`diff <(sed -n '/^3\./p' push-pr.md) <(sed -n '/^3\./p' push-pr-light.md)` shows no
  difference, or a manual read confirms parity).

---

## Phase 8 — Doc surface: managed-files list, README, quickref, templates, CLAUDE.md, stale prose

Propagates the new command and corrects stale references so installs do not go stale
(`research-codebase.md:390-392`).

**Files:**

- **`.claude/commands/playbook-update.md`** — add `.claude/commands/issue-finish.md` to
  the managed-files list (`playbook-update.md:13-46`), next to the other `issue-*`
  entries (after `auto-issues.md`, `:31`). Without this, `/playbook-update` never
  propagates the new command to consuming projects.
- **`README.md`** — add an `/issue-finish` row to the commands table (after the
  `/auto-issues` row, `README.md:56`): "`/issue-finish` | Commit remaining issue work,
  then clean up issue artifacts". Tighten the `/auto-issues` description (`:56`) to
  reflect the per-issue, in-worktree model.
- **`quickref.md`** — add an `/issue-finish` row after `/auto-issues` (`quickref.md:36`):
  "`/issue-finish` | Commit remaining work + clean up issue artifacts". Also update the
  argument model to match the design's resolved decision (`design-decision.md:201-210`):
  `/auto-issues` derives `N` from the `worktree-issue-<N>` branch (no argument), and
  `/issue-finish`'s `N` is an optional override — adjust the existing `/auto-issues N`
  cell (`quickref.md:36`) accordingly so the docs are not stale.
- **`templates/new-issues.md`** — the user-facing command list at `templates/new-issues.md:5`
  reads `**Commands:** /issue-research, /issue-plan, /issue-implement, /issue-update`.
  Append `/issue-finish` so the template lists the full issue workflow. (Codex review,
  RISK on doc surface — absorbed.)
- **`CLAUDE.md`** (playbook-repo-local; the top-half Issue Tracking section) — the line
  "Use `/issue-research`, `/issue-plan`, `/issue-implement`, `/issue-update` to move
  issues through the workflow" should also name `/issue-finish`. **Judgment call 2** — this
  edits the team-specific top half, which `/playbook-update` does not propagate; it is
  correct only because this *is* the playbook's own repo and the section is filled in.
- **`.claude/commands/issue-research.md:17`** and **`.claude/commands/issue-plan.md:21`** —
  both contain the prose "`/auto-issues` runs children with
  `--dangerously-skip-permissions`". After Phase 3 that is false. Correct both to
  `--permission-mode auto`. (CORRECTION-class — keeps the rationale for the hard-stop
  intact; only the flag name changes.)

**Migration note (Axis 5 = A):** no file change. Communicated as a one-line note in the
handoff / PR description: issues already in flight under the old per-phase-commit model
should be finished manually under the old flow or restarted; there is no compatibility
shim.

**Success criteria:**
- `grep -q 'issue-finish.md' .claude/commands/playbook-update.md` succeeds.
- `grep -q 'issue-finish' README.md` succeeds.
- `grep -q 'issue-finish' quickref.md` succeeds.
- `grep -q 'issue-finish' templates/new-issues.md` succeeds.
- `grep -q 'issue-finish' CLAUDE.md` succeeds.
- `grep -c 'dangerously-skip-permissions' .claude/commands/issue-research.md` returns `0`.
- `grep -c 'dangerously-skip-permissions' .claude/commands/issue-plan.md` returns `0`.

---

## Final verification (after all phases)

- `grep -rn 'dangerously-skip-permissions' .claude/commands/auto-issues.md
  .claude/commands/issue-research.md .claude/commands/issue-plan.md
  .claude/commands/issue-implement.md .claude/commands/issue-update.md` returns nothing
  (flag fully retired from the **issue flow**; the RDPI todo-flow files `implement.md` and
  `implement-codex.md` keep it — out of scope, see *Scope boundaries*).
- Confirm `</dev/null` count is preserved on every surviving `codex exec` / `claude -p`
  site: 4 in `auto-issues.md`, 2 in `issue-implement.md`.
- `bash -n .claude/scripts/pipeline-eval.sh` exits 0.
- Read `auto-issues.md`, `issue-implement.md`, and `issue-finish.md` end-to-end: the
  pipeline flows research → plan → implement (no commits) → update → inline Phase 5 commit
  → eval, then the manual `/issue-finish` → `/catchup` → `/push-pr*` handoff, with no
  numbering gaps and no dangling references to removed steps.
- **Dogfood smoke run (design Open Question, `design-decision.md:197`).** Before the task
  is considered complete, run `/auto-issues` (or at minimum one backgrounded child site)
  inside a real `worktree-issue-<N>` worktree under `--permission-mode auto`, and confirm
  the background safety checks do not block `git commit` / `git push` / artifact staging.
  This cannot be a pure `grep` check — it requires an actual run. If a full dogfood run is
  not feasible in-session, surface this explicitly to the developer as the one remaining
  unverified item rather than silently marking the task done.

## Judgment Calls

1. **`pipeline-eval-index.md` new path = `tasks/pipeline-eval-index.md`.** Alternatives:
   keep it ignored and accept run-history loss (design rejects this — silent failure), or
   a tracked-summary/ignored-raw split (Axis 9 choice F — more moving parts for no gain).
   `tasks/` is already a tracked directory, so the bare move keeps the index in git with
   the least change. (Codex review: confirmed sound.)
2. **Editing `CLAUDE.md`'s top-half Issue Tracking section.** This section is team-specific
   and not propagated by `/playbook-update`. Editing it is correct here only because this
   is the playbook's own repo and the section is already populated. An alternative is to
   leave it — but then the playbook's own docs would omit a playbook command. (Codex
   review: confirmed appropriate for this repo.)
3. **Phase granularity.** Phases 5-8 are small single-file (or doc-only) edits kept as
   separate phases rather than merged, because each maps to a distinct axis/artifact and
   stays independently verifiable. Phases 3 and 4 (`/auto-issues` and `/issue-implement`
   rewrites) are deliberately ordered `/auto-issues`-first to avoid a more-broken
   intermediate state (see *Phase ordering note*). They could be bundled into one atomic
   unit instead; ordering them resolves the hazard with the same effect and keeps each
   phase reviewable. (Codex review flagged the original ordering — absorbed via the
   reorder.)
4. **`/issue-finish` Step 2 skip-when-clean, excluding the eval index.** The same
   finalizer serves both the `/auto-issues` path (Phase 5 already committed → Step 2 is a
   no-op) and the standalone path (whole issue uncommitted → Step 2 does the full
   finalize). A `git status` gate distinguishes them. The gate must treat
   `tasks/pipeline-eval-index.md` as *not* "remaining work" — on the `/auto-issues` path
   it is the only dirty file at `/issue-finish` time, and it belongs to Step 3's cleanup
   commit, not a standalone finalize commit. (Codex review flagged the naïve "any dirty
   tree" gate — absorbed; Step 2 now explicitly excludes the index.)

## Artifact references

- Research: `tasks/research-codebase.md`
- Design decision: `tasks/design-decision.md`
- Task spec: `tasks/todo.md:64-115` (Task 11)

## Implementation notes

- This is a single-batch plan — all 8 phases run in one `/implement` cycle.
- Every file touched is a Markdown command/doc or a shell script; "leave the codebase in a
  working state" means each phase's file is internally consistent and references no
  removed step. There is no compile/test gate beyond `bash -n` for the shell script and
  the `grep`/`test` success criteria above — plus the final dogfood smoke run.
- Commit after each phase with a conventional message (per `CLAUDE.md` § Phase 4).
