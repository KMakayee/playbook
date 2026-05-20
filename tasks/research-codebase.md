# Research: Task 11 — Restructure /auto-issues commit/cleanup model + add /issue-finish

## Research Question

Task 11 from `tasks/todo.md` (`:64-115`): the `/auto-issues` pipeline cannot run end-to-end.
A harness block (auto-mode soft-denies "Create Unsafe Agents" for `--dangerously-skip-permissions`
children spawned from an auto-mode parent) triggered an investigation that surfaced **five
cascading bugs in the pipeline's commit/cleanup logic**. The exploratory edits were fully
reverted; the working tree matches `main`. Task 11 restructures the issue-flow commit/cleanup
model: move to a single commit at the end of `/auto-issues` (drop per-phase commits in
`/issue-implement`), add a new `/issue-finish` command for cleanup + deletion commits
(mirroring `/finish` for the RDPI todo flow), gitignore `tasks/logs/`, update
`pipeline-eval.sh`, and reword `/auto-issues` for a per-issue, in-worktree
(`worktree-issue-<N>`) deployment model. Nine open design questions seed the decision space.

## Summary

**The five bugs share one root cause.** `/auto-issues` was built as a thin orchestrator that
delegates commit and cleanup to *general-purpose* surfaces — Phase 5 invokes `/commit` (an
interactive command), Phase 7 uses bare `rm -f` — neither designed for non-interactive,
issue-flow staging. The RDPI todo flow already solved this with a dedicated finalizer
(`/finish`): it owns Pattern A staging and a local `git rm` cleanup commit. Task 11's
direction (single end-commit + new `/issue-finish`) is structurally the same move — replace
delegation-to-general-commands with issue-flow-specific finalize logic. Most of the work is
mechanical mirroring of `/finish` + `pipeline-eval.sh` + `.gitignore`; the genuine design
content lives in nine axes, of which **Axis 1 (standalone commit ownership)**, **Axis 2
(untracked source-file staging)**, and **Axis 10 (child permission mode)** carry real
trade-offs.

**The strongest precedent for the hardest axis already exists.** Axis 2 — how
`/issue-implement` stages new *source* files (out of Pattern A's artifact-only scope) — was
solved last month by `/implement-codex` Step 4n (`implement-codex.md:267-279`): a "real diff"
set computed by `git status --porcelain --ignored` baseline subtraction, then explicit
`git add <real-diff source files>` with **no `git add -A`**. Task 11's "Decided up front"
section explicitly invites mirroring `/implement-codex`'s staging patterns. The design
question is how much of that machinery `/issue-implement` needs.

**Two couplings reshape the open questions.** (1) In the new pipeline, Phase 4
(`/issue-update`) runs *before* the Phase 5 commit, so under a single-end-commit model
`/issue-update` has **no commit at all** to read for impact analysis (OQ2) — working-tree
diff becomes the only viable signal, not merely a "nice to add". (2) Gitignoring `tasks/logs/`
(Bug 2) also hides `tasks/logs/pipeline-eval-index.md` (OQ7) — the eval run-history file
silently stops being tracked unless it moves.

## Detailed Findings

### `/auto-issues` pipeline — the broken commit/cleanup surface

`.claude/commands/auto-issues.md` (`auto-issues.md:3`) frames itself as an unattended
end-to-end pipeline. Setup computes one `$TIMESTAMP` (`:23`), then phases run sequentially,
each verifying its artifact before the next:

- **Phases 1-4** spawn `claude -p "...read .claude/commands/issue-{research,plan,implement,update}.md..."
  --dangerously-skip-permissions </dev/null > tasks/logs/auto-issue-N-{phase}-$TIMESTAMP.log`
  (`:33, :45, :57, :69`). Phases 1-3 are headed "Run with `run_in_background`"; Phase 4 says
  "Timeout: 600000ms" (foreground — a Task 10 inconsistency, out of Task 11 scope but noted).
- **Phase 5: Commit & Push** (`:76-86`) — spawns a `claude -p` child told to read `/commit`,
  "stage all tracked changes and any new untracked files in tasks/", commit, push. **Bug 1:**
  this conflicts with `commit.md:9`, which *asks the developer* which untracked files to
  include — a non-interactive child cannot answer, so untracked artifacts/logs are left
  unstaged and the clean-tree check at `:84` fails.
- **Phase 6: Evaluate** (`:88-98`) — runs `pipeline-eval.sh N $TIMESTAMP` directly in-session.
- **Phase 7: Cleanup** (`:100-123`) — `rm -f` on issue artifacts + temp files, then "commit
  with message `chore: clean up issue #N artifacts`" and `git push origin HEAD`. **Bug 3:**
  no `git add`/`git rm` stages the deletions, so the commit is empty (or commits whatever
  else happens to be staged).

### `/issue-implement` — per-phase commit step (Bug 5)

`issue-implement.md` Step 4f "Commit the phase" (`:69-72`): "Commit with a conventional
message... Each phase should be a separate commit." **It never says what to stage.** A
non-interactive child defaults to bare `git commit` (whatever is staged) or `git add -u`
(misses new untracked source files). New source files the implementation creates land in *no*
per-phase commit and are not rescued by Phase 5's catch-all either (Pattern A stages only
known issue artifacts). Step 9 (`:166`) has a second commit, `fix(#N): apply code review
revisions`, with the same staging-unspecified gap. Codex review at Step 6 (`:83-109`) reviews
"the recent implementation" and a multi-batch PRELUDE inspects "recent git log on this branch"
— both assume per-phase commits exist.

### `/finish` — the RDPI-todo-flow finalize precedent

`finish.md` is the structural template for the new `/issue-finish`:

- **Step 1** (`:10-18`): reads `tasks/plan.md`, stops if any `- [ ]` unchecked; detects
  `worktree-todo-<N>` via `git rev-parse --abbrev-ref HEAD` and marks task `<N>` done in
  `tasks/todo.md` (worktree branch name names the task — no sequential assumption); falls back
  to "first unchecked task" on a regular branch.
- **Step 2** (`:20-27`): **Pattern A** — `git add -u` (tracked) + explicit `git add` of named
  RDPI artifacts (`tasks/research-codebase.md`, `tasks/design-decision.md`,
  `tasks/research-patterns.md`, `tasks/plan.md`); `git diff --staged`; checks remaining
  untracked and *asks* the developer (interactive — `/finish` is not run non-interactively);
  conventional commit; **push**.
- **Step 3** (`:29-33`): after the push, `git rm` whichever artifacts exist (+
  `tasks/checkpoint.md`); commit `chore: clean up RDPI artifacts for <subject>`; **do not
  push** — the cleanup commit rides the next task's push.

`/issue-finish`'s "Decided up front" mandate (`todo.md:88`) is exactly Step 3's local-commit
lifecycle, with `/push-pr*` playing the role of "next task's push."

### `pipeline-eval.sh` — Bug 4 and OQ7

`.claude/scripts/pipeline-eval.sh` (`:13-28`) loops over the literal phase list
`1-research 2-plan 3-implement 4-update 5-commit` twice (existence, then ≥10-line substance).
**Bug 4:** it hardcodes a `5-commit` log. Today Phase 5 is a `claude -p` child so the log
exists; an inline-commit Phase 5 produces no child log and the eval `FAIL`s. `:42` writes the
run-history index to `tasks/logs/pipeline-eval-index.md` — once `tasks/logs/` is gitignored
(Bug 2), the index is no longer tracked and run history stops persisting in git (OQ7).

### `commit.md` — out of scope, but the source of Bug 1

`commit.md:9` is the interactive untracked-file prompt incompatible with non-interactive
children. Task 11's "Out of scope" keeps `commit.md` unchanged — the fix is to remove
`/auto-issues`' *dependency* on `/commit` (Phase 5 rewrite), not change `/commit`.
`commit.md:13` (post-push `errors.md` reflection) is also lost when Phase 5 stops invoking
`/commit` — acceptable; reflection is interactive-use behavior.

### `/implement-codex` Step 4n — the untracked-source-staging precedent

`implement-codex.md` Step 4e (`:111-117`) captures a pre-edit baseline
(`git status --porcelain --ignored`, `git diff --name-only`); Step 4g (`:159-176`) computes
the "real diff" = post-state − baseline, filtered to exclude command-owned `tasks/` artifacts;
Step 4n (`:267-279`) stages **explicitly**: `git add <real-diff source files>` then
`git add tasks/plan.md tasks/implement-codex-metrics.md` — "never `git add -A` or `git add .`
(those would sweep up command-owned tmp/log artifacts)". This is a complete, recently-merged
solution to "stage agent-created source files without a blanket add" and directly informs
Axis 2.

### `/catchup` — worktree-safe, no change needed

`catchup.md` is fully worktree-safe (`:5` — never `git checkout <base>`, only `git fetch` +
`git merge origin/<base>`). It is branch-name-agnostic — it does not detect `worktree-*`
patterns. The manual flow `todo.md:79` (`/issue-finish N` → `/catchup` → `/push-pr*`) works
with `/catchup` as-is. No Task 11 change to `/catchup`.

### `playbook-update.md` managed-files list

`playbook-update.md:13-46` enumerates every playbook-managed file, including all
`.claude/commands/*.md`. It does **not** list `issue-finish.md` (does not exist yet). A new
`/issue-finish` must be added to this list or downstream `/playbook-update` runs will not
propagate it to consuming projects.

## Code References

- `.claude/commands/auto-issues.md:76-86` — Phase 5 `/commit`-child (Bug 1)
- `.claude/commands/auto-issues.md:100-123` — Phase 7 `rm -f` + unstaged deletion commit (Bug 3)
- `.claude/commands/issue-implement.md:69-72` — per-phase commit, staging unspecified (Bug 5)
- `.claude/commands/issue-implement.md:83-109` — Codex review prompt (multi-batch coherence)
- `.claude/commands/issue-implement.md:166` — Step 9 `fix(#N): apply code review revisions` commit
- `.claude/commands/issue-research.md:160-164` / `issue-plan.md:128-129` — set status, no commit
- `.claude/commands/issue-update.md:13-16` — impact analysis, board-only, no git diff/log
- `.claude/commands/finish.md:10-33` — plan-check, worktree detect, Pattern A staging, `git rm` cleanup
- `.claude/commands/commit.md:9` — interactive untracked-file prompt (Bug 1 source)
- `.claude/commands/implement-codex.md:111-117,159-176,267-279` — baseline + real-diff + explicit staging
- `.claude/commands/checkpoint.md:88,156-165` — issue artifacts as RDPI artifacts; isolated `git add --`/`git commit --only`
- `.claude/commands/push-pr.md:18` / `push-pr-light.md:18` — first-push prose, no `-u` form (OQ5)
- `.claude/scripts/pipeline-eval.sh:13-28` — hardcoded `5-commit` log loop (Bug 4); `:42` index path (OQ7)
- `.gitignore:1-5` — no `tasks/logs/` entry (Bug 2)
- `.claude/commands/playbook-update.md:13-46` — managed-files list (needs `/issue-finish`)

## Architecture Analysis

The playbook has two parallel workflows. The **RDPI todo flow** (`/research-codebase` →
`/design` → `/create-plan` → `/implement` → `/finish`) is interactive, run by a developer on a
feature branch, with per-phase commits and a dedicated `/finish` finalizer. The **issue flow**
(`/issue-research` → `/issue-plan` → `/issue-implement` → `/issue-update`) has no `/design`
phase (the recommended approach lives in the research artifact) and is wrapped by
`/auto-issues` for unattended runs. The issue flow grew *without* a `/finish` analog —
`/auto-issues` improvised commit/cleanup with `/commit` and `rm -f`. Task 11 closes that
structural asymmetry: `/issue-finish` becomes the issue-flow `/finish`, and `/auto-issues`
becomes a per-issue, in-worktree pipeline symmetric to how `worktree-todo-<N>` worktrees host
the todo flow. The repeated patterns Task 11 must respect: Pattern A staging (`git add -u` +
explicit named artifacts, no `git add -A`, no untracked prompt for non-interactive callers);
local-only cleanup commits that ride the next push; worktree-branch-name → task-number
detection; `</dev/null` on every long-running `codex exec`/`claude -p`.

## Design Axes

### Axis 1 — Standalone commit ownership for the three `issue-*` commands (OQ1)
- **Choices:** (A) all three leave the working tree uncommitted, parent `/auto-issues` (Phase 5)
  or manual `/issue-finish` owns the single commit; (B) each commits its own work at the end;
  (C) hybrid — `/issue-research` + `/issue-plan` leave artifacts uncommitted, `/issue-implement`
  commits source + fixes.
- **Per-axis constraints:** the three must be consistent for predictable standalone use;
  Task 11's direction wants one end-commit under `/auto-issues` (drops `/issue-implement`
  per-phase commits); `commit.md` unchanged; no interactive untracked prompt in any path that
  a non-interactive child runs.
- **Evidence:** `issue-research.md:160-164`, `issue-plan.md:128-129` (no commit today);
  `issue-implement.md:69-72,166` (commits today); `todo.md:77,85,101` (OQ1, Decided-up-front).

### Axis 2 — Untracked source-file staging in `/issue-implement` (OQ1, second half)
- **Choices:** (A) explicit `git add` per source path the plan enumerated; (B) baseline +
  "real diff" subtraction à la `/implement-codex` Step 4e/4g/4n; (C) `git add -A --
  ':(exclude)tasks/'` source-only glob sweep; (D) instruct the child to enumerate created
  files and stage those exact paths.
- **Per-axis constraints:** Pattern A covers only known issue *artifacts*; command-owned
  `tasks/*.tmp` and `tasks/logs/*` must never be swept into a commit; no `git add -A` for
  artifact staging (Decided-up-front).
- **Evidence:** `implement-codex.md:111-117,159-176,267-279` (precedent B);
  `todo.md:86,101` (OQ1; "Likely candidates" list explicitly names A/C/D).

### Axis 3 — `/issue-update` evidence source (OQ2)
- **Choices:** (A) keep board-only analysis; (B) add working-tree `git diff` / `git status`;
  (C) add recent `git log`; (D) read both diff and log, diff primary when no final commit
  exists yet.
- **Per-axis constraints:** in the restructured pipeline Phase 4 (`/issue-update`) runs
  *before* the Phase 5 commit — `git log` alone has no pipeline-produced commit to read.
- **Evidence:** `issue-update.md:13-16`; `auto-issues.md:64-86` (Phase 4 precedes Phase 5);
  `todo.md:102` (OQ2).

### Axis 4 — Codex review basis in `/issue-implement` (OQ3)
- **Choices:** (A) keep current "recent implementation" + recent-git-log wording; (B) reword
  to review the working-tree `git diff` directly; (C) capture a pre-implementation baseline
  and review changes since it; (D) keep git-log coherence only on paths where per-phase
  commits still exist.
- **Per-axis constraints:** dropping per-phase commits makes the current multi-batch PRELUDE
  ("recent git log on this branch", "prior batches' commits") stale; the review must operate
  on uncommitted work.
- **Evidence:** `issue-implement.md:83-109` (esp. `:91` PRELUDE, `:86` "recent implementation");
  `todo.md:103` (OQ3).

### Axis 5 — Mid-pipeline migration handling (OQ4)
- **Choices:** (A) one-line note — old in-flight branches finish manually under the old model
  or restart; (B) `/issue-finish` supports both old (per-phase-committed) and new states; (C)
  detect old per-phase commits/artifacts and emit a tailored handoff.
- **Per-axis constraints:** Task 11 scopes this only as a migration *note* question, not a
  compatibility subsystem (`todo.md:104`).
- **Evidence:** `todo.md:104` (OQ4).

### Axis 6 — First-push form in `/push-pr*` (OQ5)
- **Choices:** (A) leave the prose "push it now"; (B) specify `git push -u origin HEAD` when
  no upstream exists, normal `git push` when tracking exists; (C) always `git push -u origin HEAD`.
- **Per-axis constraints:** `/push-pr` and `/push-pr-light` must stay symmetric (identical
  step 3 wording); the old `/auto-issues` Phase 7 used an explicit `git push origin HEAD` to
  dodge "no upstream branch" errors on worktree branches.
- **Evidence:** `push-pr.md:18`, `push-pr-light.md:18`; `auto-issues.md:123`; `todo.md:105` (OQ5).

### Axis 7 — `/finish` symmetry with issue artifacts (OQ6)
- **Choices:** (A) keep `/finish` and `/issue-finish` fully separate; (B) add
  `tasks/research-issue-*.md` / `tasks/plan-issue-*.md` to `/finish`'s `git rm` cleanup list;
  (C) make `/finish` detect a `worktree-issue-<N>` branch and redirect to `/issue-finish N`.
- **Per-axis constraints:** `/finish` must not delete *active* issue artifacts during an
  ordinary RDPI-todo finish; the per-issue worktree model means todo-flow and issue-flow
  artifacts normally live in different worktrees.
- **Evidence:** `finish.md:16,30`; `todo.md:106` (OQ6).

### Axis 8 — `/issue-finish` Done-check (OQ8)
- **Choices:** (A) require issue status `Done` in `tasks/issues.md` before cleanup; (B) warn
  but allow cleanup with explicit developer confirmation; (C) no status check.
- **Per-axis constraints:** `/finish` already hard-stops on incomplete plan checkboxes
  (`finish.md:11-14`); the issue analogue is the `Done` status set by `/issue-update`.
- **Evidence:** `finish.md:11-14`; `issue-update.md:25`; `todo.md:108` (OQ8).

### Axis 9 — Pipeline-eval log/index model (Bug 4, OQ7)
- **Choices (log loop):** (A) expect only Phase 1-4 child logs after an inline final commit;
  (B) keep/synthesize a Phase 5 commit log; (C) make the expected phase list explicit or
  configurable. **Choices (index):** (D) move `pipeline-eval-index.md` out of `tasks/logs/`
  to keep it tracked; (E) leave it ignored and accept loss of run history; (F) split a
  tracked summary from the ignored raw logs.
- **Per-axis constraints:** `tasks/logs/` will be gitignored (Bug 2 fix); the current index
  path is inside it.
- **Evidence:** `pipeline-eval.sh:13-28,42`; `todo.md:69,107` (Bug 4, OQ7).

### Axis 10 — Child permission mode for `/auto-issues` spawns (OQ9)
- **Choices:** (A) `--permission-mode auto` on every child; (B) `--allowedTools "<explicit
  list>"` per spawn; (C) keep `--dangerously-skip-permissions` and document that
  `/auto-issues` must be launched from a non-auto parent.
- **Per-axis constraints:** `</dev/null` preserved on every site; non-interactive children
  cannot answer permission prompts; the nested fix-applier child at `issue-implement.md:154-159`
  is part of the same decision; the originating block was the harness soft-denying
  `--dangerously-skip-permissions` children spawned from an auto-mode parent.
- **Evidence:** `auto-issues.md:33,45,57,69,81` + `:139`; `issue-implement.md:154-159`;
  `todo.md:109` (OQ9); External Research below.

### Axis 11 — `/auto-issues` Phase 5 commit mechanism (implicit; not an OQ but a real decision)
- **Choices:** (A) a `claude -p` child reading a new commit-directive command/spec; (B) an
  inline commit run directly via Bash in the `/auto-issues` session; (C) fold the single
  commit into the rewritten `/issue-implement`'s own final commit.
- **Per-axis constraints:** Bug 1 rules out the *current* `/commit`-child; "a naïve inline
  `git add -u` rewrite" (todo.md Bug 1) is also called out as broken — the mechanism must
  carry full Pattern A + Axis 2 staging; the choice determines whether a Phase 5 log exists
  (couples to Axis 9).
- **Evidence:** `auto-issues.md:76-86`; `todo.md:66,77` (Bug 1, Direction).

## Axis Coupling

- **Axis 1 = A (issue commands don't commit)** → Axis 3 and Axis 4 must use the working-tree
  diff, not git history — there are no per-command commits to read. Reason: a `/issue-update`
  or Codex review with nothing committed has only the working tree as signal.
- **Axis 1 = A** also means **Axis 11 ≠ C** is unconstrained but **Axis 11 must own the
  single commit** for the whole `/auto-issues` run.
- **Axis 11 = B (inline Bash commit)** → no `5-commit` child log exists → **Axis 9 (log loop)
  must be A or C** (drop or generalize `5-commit`). Axis 11 = A (child) → a Phase 5 log
  exists → Axis 9 (log loop) = B stays viable.
- **Axis 2 = C (`git add -A -- ':(exclude)tasks/'`)** → **Axis 9 must ensure `tasks/logs/`
  and the index are ignored or excluded**, since command-owned logs live under `tasks/` and
  the glob's exclude already covers them — but a non-`tasks/` index location would re-expose
  the risk.
- **Axis 8 = A (require `Done`)** → `/auto-issues` must keep Phase 4 (`/issue-update`, which
  sets `Done`) *before* the final commit and before `/issue-finish`.
- **Axis 10 = B (`--allowedTools`)** → every child's tool surface (Bash subcommands, Edit,
  Write, Read, nested `claude -p`, `codex exec`, `git commit`, possibly `git push`) must be
  catalogued, or `-p` aborts on the first un-allowlisted prompt; compound Bash commands
  require *every* subcommand to match a rule.
- **Axis 10 = C (keep bypass)** → `/auto-issues` cannot be launched from an auto-mode parent
  under the observed harness rule — an operational constraint that must be documented in the
  reworded top-of-file framing.

## Cross-Cutting Constraints

- **`</dev/null` discipline (Issue #2).** Every long-running `codex exec` / `claude -p`
  invocation in every file Task 11 rewrites must keep `</dev/null`. No automated lint exists —
  verify by spot-check + a smoke run of one backgrounded site (`issues.md:144`).
- **`commit.md` is out of scope** — remove `/auto-issues`' dependency on it, do not edit it.
- **RDPI `/implement` keeps per-phase commits** — only the issue flow restructures
  (`todo.md:93`).
- **`tasks/issues.md` board format unchanged**; `/issue-research` and `/issue-plan` internals
  unchanged except their commit-behavior decision (Axis 1).
- **Worktree naming `worktree-issue-<N>` is fixed** (Decided-up-front); detection reuses
  `/finish`'s `git rev-parse --abbrev-ref HEAD` idiom (`finish.md:16`).
- **Pattern A is fixed**: `git add -u` + explicit `git add` of `tasks/research-issue-N.md` and
  `tasks/plan-issue-N.md`; no `git add -A`; no interactive untracked prompt for non-interactive
  callers.
- **Slash commands cannot programmatically invoke other slash commands** — `/auto-issues`'
  children correctly read the target command file and follow it; the manual post-pipeline flow
  (`/issue-finish` → `/catchup` → `/push-pr*`) is developer-run, not chained.
- **`playbook-update.md` managed-files list** must gain `.claude/commands/issue-finish.md`
  (`playbook-update.md:13-46`), or consuming projects never receive the new command.
- **Phase 7 → `/issue-finish` leaves no numbering gap** — Phase 7 is currently last; the
  restructured pipeline ends at Phase 6 (Decided-up-front, `todo.md:89`).
- **Worktree creation is external.** No playbook command creates worktrees (`.claude/worktrees/`
  is gitignored; the dev/harness creates them). `/auto-issues` should *assume* it runs inside
  the correct `worktree-issue-<N>`, not create one — surfaced as an Open Question.

## Related Precedents

**The RDPI todo flow end-to-end** (`/implement` per-phase commits → `/finish` finalize →
`/catchup` → `/push-pr*`) is the multi-axis precedent Task 11 mirrors onto the issue flow:
- Axis 1/11 analog: `/implement` commits per-phase; `/finish` does the artifact commit +
  cleanup. Task 11 *diverges* here — it consolidates `/issue-implement`'s per-phase commits
  into one `/auto-issues` end-commit (todo flow keeps per-phase; issue flow does not).
- Axis 7/8 analog: `/finish` plan-completion hard-stop (`finish.md:11-14`) → `/issue-finish`
  `Done`-status check (Axis 8); `/finish` `worktree-todo-<N>` detection → `/issue-finish`
  `worktree-issue-<N>` detection.
- Axis 2 analog: `/implement-codex` Step 4n (`implement-codex.md:267-279`) already solved
  agent-created-source-file staging without `git add -A` — a single-axis precedent that
  directly seeds Axis 2 choice B.

## External Research

Permission-flag semantics (Axis 10 / OQ9), confirmed against official Claude Code docs:

- **`--dangerously-skip-permissions` ≡ `--permission-mode bypassPermissions`** — skips all
  prompts; retains root/home-deletion circuit breakers. Source:
  https://code.claude.com/docs/en/cli-usage , https://code.claude.com/docs/en/permissions
  **Unblocks:** Axis 10, choice C.
- **`--permission-mode` accepts `auto`, `dontAsk`, `bypassPermissions`, etc.; works with
  `-p`.** `auto` is described as a *research preview* with background safety checks. Source:
  https://code.claude.com/docs/en/permission-modes — **Unblocks:** Axis 10, choice A.
- **`--allowedTools` auto-approves named tools/rules; `dontAsk` denies tools not
  pre-approved.** Permission rule syntax supports `Bash(...)`, `Read`, `Edit`, `WebFetch`,
  `Agent(...)`; compound Bash commands require *every* subcommand to match. Sources:
  https://code.claude.com/docs/en/headless , https://code.claude.com/docs/en/permissions —
  **Unblocks:** Axis 10, choice B (and confirms the cataloguing cost).
- **No official doc covers the harness-specific "Create Unsafe Agents" soft-deny** or whether
  a nested `claude -p --dangerously-skip-permissions` spawned from an auto-mode parent is
  treated as unsafe-agent creation. This is repo-empirical evidence only (`todo.md:64,109`).
  **Consequence:** Axis 10 cannot be fully resolved from docs — choice A's end-to-end behavior
  under `Bash(codex *)` + nested `Bash(claude -p *)` is unverified, and choice C's
  non-auto-parent requirement rests on the empirical block. The design phase (or a dogfood
  run) must close this empirically; it is not a codebase gap.

## Risk Analysis

- **Empty-commit risk persists if Axis 11 is underspecified.** Bug 1 *and* Bug 3 are both
  "commit message specified, staging not" failures. Whatever Axis 11 + Axis 2 + Pattern A
  resolve to, the spec must state the exact `git add`/`git rm` commands inline — the recurring
  failure mode is prose that says "commit" without naming what to stage.
- **`tasks/logs/` gitignore silently hides `pipeline-eval-index.md`** (OQ7/Axis 9). If Axis 9
  picks E (accept loss), run history vanishes from git with no warning — easy to ship without
  noticing.
- **`/finish` Axis 7 = B could delete active issue artifacts.** If `/finish` is taught to
  `git rm tasks/research-issue-*.md`, a developer who runs `/finish` in a worktree that also
  has a mid-flight issue loses that issue's artifacts. Choice C (detect + redirect) is safer.
- **Axis 10 = A is unverified end-to-end.** `--permission-mode auto` escaping the soft-deny is
  a research-preview feature; shipping it as the default without a dogfood run risks
  `/auto-issues` still not running end-to-end — the exact failure Task 11 exists to fix.
- **`</dev/null` discipline rot.** Task 11 rewrites the most `codex exec`/`claude -p`-dense
  files; with no lint, a dropped `</dev/null` reintroduces the Issue #2 hang silently. The
  reviewer is the only guard (`issues.md:144`).
- **Doc-surface drift.** `README.md`, `quickref.md`, `playbook-update.md`'s managed list, and
  CLAUDE.md's issue-tracking section all reference the issue commands; a new `/issue-finish`
  and a reworded `/auto-issues` must propagate to all of them or installs go stale.

## Open Questions

- **Does `/auto-issues` create the `worktree-issue-<N>` worktree, or assume it?** No playbook
  command creates worktrees today. Task 11 says `/auto-issues` is "repositioned to run inside"
  a per-issue worktree — research reads this as *assume*, but the reworded top-of-file framing
  must state the precondition explicitly (and `/auto-issues` should arguably verify its branch
  matches `worktree-issue-<N>` and warn if not). Design decision.
- **OQ9 / Axis 10 cannot be closed from the codebase or docs alone** — the harness soft-deny
  behavior is empirical. The design phase should either pick a choice and flag it for a
  dogfood smoke run, or run that smoke check before finalizing.
- **`/issue-finish` worktree-awareness is lighter than `/finish`'s.** `/finish` uses
  `worktree-todo-<N>` detection to *disambiguate which task* to mark done; `/issue-finish N`
  already has `N` from `$ARGUMENTS`. So worktree-awareness here is mainly: confirm the branch
  matches `worktree-issue-<N>`, warn on mismatch, and adjust the "next up" hint. Design should
  decide how much of `/finish`'s worktree logic actually transfers.

## Verification Notes

- Spot-checked and confirmed: `finish.md:10-33`, `auto-issues.md:76-123`,
  `issue-implement.md:69-72,166`, `pipeline-eval.sh:13-28,42`, `commit.md:9`,
  `checkpoint.md:88,156-165`, `implement-codex.md:267-279`, `.gitignore` (no `tasks/logs/`),
  `playbook-update.md:13-46` (no `issue-finish.md`). All Codex file:line citations held up.
- Codex flagged `tasks/codex-prompt.tmp` as an unexpected untracked file "despite the
  clean-baseline expectation" — this is **not a finding**: it is `/research-codebase`'s own
  composed-prompt temp file, created by this research run and removed in the command's
  cleanup step. The working tree was clean at task start.
